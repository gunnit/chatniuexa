import { prisma } from '@/lib/db'

// Approximate cost per 1K tokens (in USD)
const COST_PER_1K_TOKENS = {
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'gpt-3.5-turbo': 0.0005,
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

  // Get or create usage limits
  let limits = await prisma.usageLimit.findUnique({
    where: { tenantId },
  })

  if (!limits) {
    limits = await prisma.usageLimit.create({
      data: { tenantId },
    })
  }

  // Reset counters if needed
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let needsUpdate = false
  const updates: Parameters<typeof prisma.usageLimit.update>[0]['data'] = {}

  if (limits.lastDayReset < dayStart) {
    updates.currentDayMessages = 0
    updates.lastDayReset = dayStart
    needsUpdate = true
  }

  if (limits.lastMonthReset < monthStart) {
    updates.currentMonthTokens = 0
    updates.currentMonthCost = 0
    updates.lastMonthReset = monthStart
    needsUpdate = true
  }

  if (needsUpdate) {
    limits = await prisma.usageLimit.update({
      where: { tenantId },
      data: updates,
    })
  }

  // Check limits
  if (limits.currentMonthTokens + tokens > limits.monthlyTokenLimit) {
    return { allowed: false, reason: 'Monthly token limit exceeded' }
  }

  if (limits.currentMonthCost + cost > limits.monthlyCostLimit) {
    return { allowed: false, reason: 'Monthly cost limit exceeded' }
  }

  if (type === 'chat' && limits.currentDayMessages >= limits.dailyMessageLimit) {
    return { allowed: false, reason: 'Daily message limit exceeded' }
  }

  // Log the usage
  await prisma.usageLog.create({
    data: {
      tenantId,
      chatbotId,
      type,
      tokens,
      cost,
    },
  })

  // Update counters
  await prisma.usageLimit.update({
    where: { tenantId },
    data: {
      currentMonthTokens: { increment: tokens },
      currentMonthCost: { increment: cost },
      ...(type === 'chat' ? { currentDayMessages: { increment: 1 } } : {}),
    },
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
