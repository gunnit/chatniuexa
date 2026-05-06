import { prisma } from '@/lib/db'

// Cost per 1K tokens (USD) - averaged (input+output)/2 from official OpenAI pricing
const COST_PER_1K_TOKENS = {
  'gpt-5.4': 0.00875,       // Flagship: $2.50 in / $15.00 out per 1M
  'gpt-5.4-mini': 0.002625, // Recommended: $0.75 in / $4.50 out per 1M
  'gpt-5.4-nano': 0.000725, // Cheapest: $0.20 in / $1.25 out per 1M
  'gpt-5.2': 0.007875,      // Prev frontier: $1.75 in / $14.00 out per 1M
  'gpt-5-mini': 0.001125,   // Legacy: $0.25 in / $2.00 out per 1M
  'gpt-5-nano': 0.0002,     // Legacy budget
  // Deprecated
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'text-embedding-3-small': 0.00002,
}

/**
 * Log usage and check limits
 */
export async function logUsage(params: {
  tenantId: string
  chatbotId?: string
  type: 'chat' | 'embedding' | 'crawl'
  tokens: number
  model?: string
}): Promise<{ allowed: boolean; reason?: string }> {
  const { tenantId, chatbotId, type, tokens, model } = params

  // Calculate estimated cost
  const costRate = model
    ? COST_PER_1K_TOKENS[model as keyof typeof COST_PER_1K_TOKENS] || 0.001
    : 0.001
  const cost = (tokens / 1000) * costRate

  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
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
  await prisma.usageLog.create({
    data: { tenantId, chatbotId, type, tokens, cost },
  })

  return { allowed: true }
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
