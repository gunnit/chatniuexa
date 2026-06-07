import { prisma } from '@/lib/db'
import {
  REALTIME_CLIENT_SECRETS_URL,
  VOICE_MODEL,
  VOICE_COST_PER_MINUTE,
  normalizeVoice,
  clampSpeed,
} from './config'
import { buildVoiceInstructions } from './instructions'
import { VOICE_TOOLS } from './tools'

export interface VoiceSessionPayload {
  token: string
  sessionId: string
  model: string
  voice: string
  speakGreeting: boolean
  maxSessionSeconds: number
  expiresAt: string
}

interface MintParams {
  chatbot: {
    id: string
    tenantId: string
    name: string
    systemPrompt: string | null
    voiceName: string | null
    voiceGreeting: string | null
    voiceSpeakGreeting: boolean
    voiceTone: string | null
    voiceLanguage: string | null
    voiceSpeed: number | null
  }
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
  const speed = clampSpeed(chatbot.voiceSpeed)
  const instructions = buildVoiceInstructions(chatbot)
  // Only speak first when the tenant opted in AND actually provided a greeting line.
  const speakGreeting = Boolean(chatbot.voiceSpeakGreeting && chatbot.voiceGreeting?.trim())

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
          audio: { output: { voice, speed } },
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
    speakGreeting,
    maxSessionSeconds,
    expiresAt: expiresAt.toISOString(),
  }
}

// Most concurrent live voice calls a single tenant may run at once. Bounds the
// worst-case cost exposure between minting and the first heartbeat (each session is
// independently capped at maxVoiceSessionSeconds).
export const MAX_ACTIVE_VOICE_SESSIONS = 3

export interface ActiveVoiceSession {
  id: string
  chatbotId: string
  tenantId: string
  secondsUsed: number
  createdAt: Date
}

/** Load a voice session and confirm it is active and unexpired. */
export async function validateVoiceSession(sessionId: string): Promise<ActiveVoiceSession | null> {
  if (!sessionId) return null
  const s = await prisma.voiceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, chatbotId: true, tenantId: true, secondsUsed: true, createdAt: true, status: true, expiresAt: true },
  })
  if (!s || s.status !== 'active' || s.expiresAt.getTime() < Date.now()) return null
  return { id: s.id, chatbotId: s.chatbotId, tenantId: s.tenantId, secondsUsed: s.secondsUsed, createdAt: s.createdAt }
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

  // Cap concurrent live sessions so a burst of mint requests can't open many paid
  // streams before any of them is metered.
  const activeCount = await prisma.voiceSession.count({
    where: { tenantId, status: 'active', expiresAt: { gt: new Date() } },
  })
  if (activeCount >= MAX_ACTIVE_VOICE_SESSIONS) {
    return { allowed: false, remainingSeconds, reason: 'Too many active voice calls' }
  }

  return { allowed: true, remainingSeconds }
}

export interface MeterResult {
  stop: boolean
  remainingSeconds: number
}

/**
 * Meter a session. Elapsed time is computed SERVER-SIDE from the session's createdAt
 * (the client's reported value is not trusted — a malicious client could otherwise report
 * 0 forever to get free minutes). Computes the delta since the last heartbeat, then
 * persists the ledger and increments the tenant's monthly voice seconds + cost atomically
 * (single transaction, with monthly reset). Returns stop=true once the minute budget or
 * cost cap is exhausted (or on final), so the client disconnects.
 */
export async function meterVoiceSession(
  session: ActiveVoiceSession,
  _clientElapsedSeconds: number,
  final: boolean,
): Promise<MeterResult> {
  // Server-authoritative wall-clock duration since the session was minted.
  const elapsed = Math.max(0, Math.floor((Date.now() - session.createdAt.getTime()) / 1000))
  const delta = Math.max(0, elapsed - session.secondsUsed)
  const costDelta = (delta / 60) * VOICE_COST_PER_MINUTE
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // Persist the ledger and the monthly counters together so a crash can never advance
  // one without the other (which would lose or double-count the delta).
  const row = await prisma.$transaction(async (tx) => {
    await tx.voiceSession.update({
      where: { id: session.id },
      data: { secondsUsed: elapsed, status: final ? 'ended' : 'active' },
    })
    const rows = await tx.$queryRaw<
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
    return rows[0]
  })

  if (!row) return { stop: true, remainingSeconds: 0 }

  const budgetSeconds = row.monthlyVoiceMinutes * 60
  const remainingSeconds = Math.max(0, budgetSeconds - row.currentMonthVoiceSeconds)
  const stop = final || remainingSeconds <= 0 || row.currentMonthCost >= row.monthlyCostLimit

  if (stop && !final) {
    await prisma.voiceSession.update({ where: { id: session.id }, data: { status: 'ended' } }).catch(() => {})
  }

  return { stop, remainingSeconds }
}
