import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { CHAT_MODELS, getChatModel, type ChatModelInfo } from '@/lib/models'

/** USD per 1M tokens, billed separately for input and output. */
type TokenPrices = Pick<ChatModelInfo, 'inputPer1M' | 'outputPer1M'>

// Chat models no longer offered; kept so leftover usage is still priced correctly
const RETIRED_CHAT_MODEL_PRICES = new Map<string, TokenPrices>([
  ['gpt-5-mini', { inputPer1M: 0.25, outputPer1M: 2.0 }], // shut down 2026-12-11
  ['gpt-5-nano', { inputPer1M: 0.05, outputPer1M: 0.4 }], // shut down 2026-12-11
  ['gpt-4o', { inputPer1M: 2.5, outputPer1M: 10.0 }],
  ['gpt-4o-mini', { inputPer1M: 0.15, outputPer1M: 0.6 }],
])

// Any model priced nowhere else: $1 per 1M tokens either way.
const FALLBACK_PRICES: TokenPrices = { inputPer1M: 1, outputPer1M: 1 }

const blendedPer1K = (prices: TokenPrices) => (prices.inputPer1M + prices.outputPer1M) / 2 / 1000

// Cost per 1K tokens (USD) for up-front reservations, whose input/output split is
// unknown - averaged (input+output)/2 from official OpenAI pricing. Chat model
// rates come from the model registry, so every selectable model is priced and
// none can fall through to the generic fallback rate.
const COST_PER_1K_TOKENS: Record<string, number> = {
  ...Object.fromEntries(CHAT_MODELS.map((m) => [m.id, blendedPer1K(m)])),
  ...Object.fromEntries([...RETIRED_CHAT_MODEL_PRICES].map(([id, prices]) => [id, blendedPer1K(prices)])),
  'text-embedding-3-small': 0.00002,
}

function chatModelPrices(model: string | undefined): TokenPrices {
  return (model && (getChatModel(model) ?? RETIRED_CHAT_MODEL_PRICES.get(model))) || FALLBACK_PRICES
}

/** Tokens OpenAI reported for one request. */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** What an allowed `logUsage` call booked, so the caller can settle it once the real usage is known. */
export interface UsageReservation {
  tenantId: string
  /** The usage_logs row that records this request. */
  logId: string
  model?: string
  tokens: number
  cost: number
  /** Start of the next billing month; counters reset at or after it belong to a newer month. */
  monthEnd: Date
}

export type UsageCheck =
  | { allowed: true; reservation: UsageReservation }
  | { allowed: false; reason: string }

/**
 * Log usage and check limits
 */
export async function logUsage(params: {
  tenantId: string
  chatbotId?: string
  type: 'chat' | 'embedding' | 'crawl'
  tokens: number
  model?: string
}): Promise<UsageCheck> {
  const { tenantId, chatbotId, type, tokens, model } = params

  // Calculate estimated cost
  const costRate = (model && COST_PER_1K_TOKENS[model]) || blendedPer1K(FALLBACK_PRICES)
  const cost = (tokens / 1000) * costRate

  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const isChat = type === 'chat'

  // Ensure the row exists (idempotent — concurrent first-call from same tenant
  // is safe because @unique on tenantId rejects the second insert).
  await prisma.usageLimit.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  })

  // Atomic conditional UPDATE: counters are reset and incremented in a single
  // statement, and the WHERE clause refuses the update if any cap would be
  // exceeded. This eliminates the read-then-check-then-write race that allowed
  // concurrent requests to both pass the cap check and both increment.
  const isChatInt = isChat ? 1 : 0
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE usage_limits SET
      "currentMonthTokens" = CASE
        WHEN "lastMonthReset" < ${monthStart} THEN ${tokens}
        ELSE "currentMonthTokens" + ${tokens}
      END,
      "currentMonthCost" = CASE
        WHEN "lastMonthReset" < ${monthStart} THEN ${cost}
        ELSE "currentMonthCost" + ${cost}
      END,
      "lastMonthReset" = CASE
        WHEN "lastMonthReset" < ${monthStart} THEN ${monthStart}
        ELSE "lastMonthReset"
      END,
      "currentDayMessages" = CASE
        WHEN "lastDayReset" < ${dayStart} THEN ${isChatInt}
        WHEN ${isChat} THEN "currentDayMessages" + 1
        ELSE "currentDayMessages"
      END,
      "lastDayReset" = CASE
        WHEN "lastDayReset" < ${dayStart} THEN ${dayStart}
        ELSE "lastDayReset"
      END,
      "updatedAt" = NOW()
    WHERE "tenantId" = ${tenantId}
      AND (
        "lastMonthReset" < ${monthStart}
        OR "currentMonthTokens" + ${tokens} <= "monthlyTokenLimit"
      )
      AND (
        "lastMonthReset" < ${monthStart}
        OR "currentMonthCost" + ${cost} <= "monthlyCostLimit"
      )
      AND (
        NOT ${isChat}
        OR "lastDayReset" < ${dayStart}
        OR "currentDayMessages" < "dailyMessageLimit"
      )
    RETURNING id
  `

  if (result.length === 0) {
    // Determine which limit was hit so we can surface a helpful reason.
    const limits = await prisma.usageLimit.findUnique({ where: { tenantId } })
    if (!limits) return { allowed: false, reason: 'Failed to create usage limits' }
    if (limits.currentMonthTokens + tokens > limits.monthlyTokenLimit) {
      return { allowed: false, reason: 'Monthly token limit exceeded' }
    }
    if (limits.currentMonthCost + cost > limits.monthlyCostLimit) {
      return { allowed: false, reason: 'Monthly cost limit exceeded' }
    }
    if (isChat && limits.currentDayMessages >= limits.dailyMessageLimit) {
      return { allowed: false, reason: 'Daily message limit exceeded' }
    }
    return { allowed: false, reason: 'Usage limit exceeded' }
  }

  // Log the usage event (best effort — counters are already committed)
  const log = await prisma.usageLog.create({
    data: { tenantId, chatbotId, type, tokens, cost },
    select: { id: true },
  })

  return { allowed: true, reservation: { tenantId, logId: log.id, model, tokens, cost, monthEnd } }
}

const isTokenCount = (n: number) => Number.isSafeInteger(n) && n >= 0

/**
 * Replace a chat reservation's estimate with the tokens OpenAI actually
 * reported: moves the month's token and cost counters by (actual − reserved)
 * and rewrites the reservation's usage_logs row, so each request is still one
 * row. Input and output are priced separately at the model's rates; cached
 * input is charged at the full input rate.
 *
 * Not capped: the tokens are already spent, so this can take the tenant past a
 * limit, and its next reservation is then refused. Leaves the counters alone
 * once they have been reset for a newer month (the log row is still corrected).
 *
 * Best effort: never throws, so metering can't fail the user's response.
 */
export async function settleChatUsage(reservation: UsageReservation, usage: TokenUsage): Promise<void> {
  const { tenantId, logId, monthEnd } = reservation
  try {
    if (!isTokenCount(usage.inputTokens) || !isTokenCount(usage.outputTokens)) {
      logger.warn('Ignoring malformed token usage', { tenantId, logId, usage })
      return
    }

    const prices = chatModelPrices(reservation.model)
    const tokens = usage.inputTokens + usage.outputTokens
    const cost = (usage.inputTokens * prices.inputPer1M + usage.outputTokens * prices.outputPer1M) / 1_000_000
    const tokenDelta = tokens - reservation.tokens
    const costDelta = cost - reservation.cost

    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE usage_limits SET
          "currentMonthTokens" = GREATEST("currentMonthTokens" + ${tokenDelta}, 0),
          "currentMonthCost" = GREATEST("currentMonthCost" + ${costDelta}, 0),
          "updatedAt" = NOW()
        WHERE "tenantId" = ${tenantId}
          AND "lastMonthReset" < ${monthEnd}
      `,
      prisma.usageLog.updateMany({
        where: { id: logId, tenantId },
        data: { tokens, cost },
      }),
    ])
  } catch (error) {
    logger.error('Failed to record actual chat usage', { tenantId, logId, error: String(error) })
  }
}

/**
 * Get usage statistics for a tenant
 */
export async function getUsageStats(tenantId: string) {
  const limits = await prisma.usageLimit.findUnique({
    where: { tenantId },
  })

  if (!limits) {
    return null
  }

  // Get daily breakdown for the current month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const dailyUsage = await prisma.usageLog.groupBy({
    by: ['type'],
    where: {
      tenantId,
      createdAt: { gte: monthStart },
    },
    _sum: {
      tokens: true,
      cost: true,
    },
    _count: true,
  })

  // Get total conversations and messages
  const conversationCount = await prisma.conversation.count({
    where: {
      chatbot: { tenantId },
    },
  })

  const messageCount = await prisma.message.count({
    where: {
      conversation: {
        chatbot: { tenantId },
      },
    },
  })

  return {
    limits: {
      monthlyTokenLimit: limits.monthlyTokenLimit,
      dailyMessageLimit: limits.dailyMessageLimit,
      monthlyCostLimit: limits.monthlyCostLimit,
    },
    usage: {
      currentMonthTokens: limits.currentMonthTokens,
      currentMonthCost: limits.currentMonthCost,
      currentDayMessages: limits.currentDayMessages,
    },
    breakdown: dailyUsage.map((d) => ({
      type: d.type,
      totalTokens: d._sum.tokens || 0,
      totalCost: d._sum.cost || 0,
      count: d._count,
    })),
    totals: {
      conversations: conversationCount,
      messages: messageCount,
    },
  }
}
