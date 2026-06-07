import { prisma } from '@/lib/db'
import {
  REALTIME_CLIENT_SECRETS_URL,
  VOICE_MODEL,
  VOICE_COST_PER_MINUTE,
  normalizeVoice,
} from './config'
import { buildVoiceInstructions } from './instructions'
import { VOICE_TOOLS } from './tools'

export interface VoiceSessionPayload {
  token: string
  sessionId: string
  model: string
  voice: string
  maxSessionSeconds: number
  expiresAt: string
}

interface MintParams {
  chatbot: { id: string; tenantId: string; name: string; systemPrompt: string | null; voiceName: string | null }
  maxSessionSeconds: number
}

/**
 * Mint an ephemeral Realtime client secret with the bot's instructions + tools baked
 * into the session config (so the system prompt never reaches the browser), and record
 * a VoiceSession ledger row whose id is the opaque sessionId the client uses to call the
 * other voice endpoints.
 */
export async function mintVoiceSession({ chatbot, maxSessionSeconds }: MintParams): Promise<VoiceSessionPayload> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY environment variable')

  const voice = normalizeVoice(chatbot.voiceName)
  const instructions = buildVoiceInstructions(chatbot)

  // Ledger row first — gives us the sessionId and an expiry the endpoints enforce.
  // A small grace buffer beyond the hard cap absorbs clock skew / final heartbeat.
  const expiresAt = new Date(Date.now() + (maxSessionSeconds + 30) * 1000)
  const session = await prisma.voiceSession.create({
    data: { chatbotId: chatbot.id, tenantId: chatbot.tenantId, expiresAt, status: 'active' },
    select: { id: true },
  })

  let res: Response
  try {
    res = await fetch(REALTIME_CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': chatbot.tenantId,
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: VOICE_MODEL,
          instructions,
          audio: { output: { voice } },
          tools: VOICE_TOOLS,
          tool_choice: 'auto',
        },
      }),
    })
  } catch (err) {
    await prisma.voiceSession.update({ where: { id: session.id }, data: { status: 'ended' } }).catch(() => {})
    throw new Error(`Realtime client_secrets request failed: ${(err as Error).message}`)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    await prisma.voiceSession.update({ where: { id: session.id }, data: { status: 'ended' } }).catch(() => {})
    throw new Error(`Realtime client_secrets ${res.status}: ${detail.slice(0, 300)}`)
  }

  const json: any = await res.json()
  // Response shape is { value: "ek_..." }; be defensive about a nested client_secret.
  const token: string | undefined = json?.value ?? json?.client_secret?.value
  if (!token) {
    await prisma.voiceSession.update({ where: { id: session.id }, data: { status: 'ended' } }).catch(() => {})
    throw new Error('Realtime client_secrets response missing token')
  }

  return {
    token,
    sessionId: session.id,
    model: VOICE_MODEL,
    voice,
    maxSessionSeconds,
    expiresAt: expiresAt.toISOString(),
  }
}

export interface ActiveVoiceSession {
  id: string
  chatbotId: string
  tenantId: string
  secondsUsed: number
}

/** Load a voice session and confirm it is active and unexpired. */
export async function validateVoiceSession(sessionId: string): Promise<ActiveVoiceSession | null> {
  if (!sessionId) return null
  const s = await prisma.voiceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, chatbotId: true, tenantId: true, secondsUsed: true, status: true, expiresAt: true },
  })
  if (!s || s.status !== 'active' || s.expiresAt.getTime() < Date.now()) return null
  return { id: s.id, chatbotId: s.chatbotId, tenantId: s.tenantId, secondsUsed: s.secondsUsed }
}

export interface VoiceBudget {
  allowed: boolean
  remainingSeconds: number
  reason?: string
}

/**
 * Pre-mint check: does the tenant have voice budget left this month (minutes + cost cap)?
 * Mirrors the monthly reset semantics used by logUsage.
 */
export async function checkVoiceBudget(tenantId: string): Promise<VoiceBudget> {
  await prisma.usageLimit.upsert({ where: { tenantId }, update: {}, create: { tenantId } })
  const limits = await prisma.usageLimit.findUnique({ where: { tenantId } })
  if (!limits) return { allowed: false, remainingSeconds: 0, reason: 'No usage limits' }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const monthReset = limits.lastMonthReset < monthStart
  const usedSeconds = monthReset ? 0 : limits.currentMonthVoiceSeconds
  const usedCost = monthReset ? 0 : limits.currentMonthCost

  const budgetSeconds = limits.monthlyVoiceMinutes * 60
  const remainingSeconds = Math.max(0, budgetSeconds - usedSeconds)

  if (budgetSeconds <= 0) return { allowed: false, remainingSeconds: 0, reason: 'Voice not available on this plan' }
  if (remainingSeconds <= 0) return { allowed: false, remainingSeconds: 0, reason: 'Monthly voice limit reached' }
  if (usedCost >= limits.monthlyCostLimit) return { allowed: false, remainingSeconds, reason: 'Monthly cost limit reached' }

  return { allowed: true, remainingSeconds }
}

export interface MeterResult {
  stop: boolean
  remainingSeconds: number
}

/**
 * Meter a session against the cumulative elapsed seconds the client reports. Computes the
 * delta since the last heartbeat, persists it on the session, and atomically increments the
 * tenant's monthly voice seconds + cost (with monthly reset). Returns stop=true once the
 * minute budget or cost cap is exhausted (or on final), so the client disconnects.
 */
export async function meterVoiceSession(
  session: ActiveVoiceSession,
  elapsedSeconds: number,
  final: boolean,
): Promise<MeterResult> {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds))
  const delta = Math.max(0, elapsed - session.secondsUsed)
  const costDelta = (delta / 60) * VOICE_COST_PER_MINUTE
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // Persist the new cumulative seconds on the session ledger.
  await prisma.voiceSession.update({
    where: { id: session.id },
    data: { secondsUsed: elapsed, status: final ? 'ended' : 'active' },
  })

  // Atomic monthly increment + reset (mirrors logUsage's conditional UPDATE).
  const rows = await prisma.$queryRaw<
    Array<{ currentMonthVoiceSeconds: number; currentMonthCost: number; monthlyVoiceMinutes: number; monthlyCostLimit: number }>
  >`
    UPDATE usage_limits SET
      "currentMonthVoiceSeconds" = CASE
        WHEN "lastMonthReset" < ${monthStart} THEN ${delta}
        ELSE "currentMonthVoiceSeconds" + ${delta}
      END,
      "currentMonthCost" = CASE
        WHEN "lastMonthReset" < ${monthStart} THEN ${costDelta}
        ELSE "currentMonthCost" + ${costDelta}
      END,
      "lastMonthReset" = CASE
        WHEN "lastMonthReset" < ${monthStart} THEN ${monthStart}
        ELSE "lastMonthReset"
      END,
      "updatedAt" = NOW()
    WHERE "tenantId" = ${session.tenantId}
    RETURNING "currentMonthVoiceSeconds", "currentMonthCost", "monthlyVoiceMinutes", "monthlyCostLimit"
  `

  const row = rows[0]
  if (!row) return { stop: true, remainingSeconds: 0 }

  const budgetSeconds = row.monthlyVoiceMinutes * 60
  const remainingSeconds = Math.max(0, budgetSeconds - row.currentMonthVoiceSeconds)
  const stop = final || remainingSeconds <= 0 || row.currentMonthCost >= row.monthlyCostLimit

  if (stop && !final) {
    await prisma.voiceSession.update({ where: { id: session.id }, data: { status: 'ended' } }).catch(() => {})
  }

  return { stop, remainingSeconds }
}
