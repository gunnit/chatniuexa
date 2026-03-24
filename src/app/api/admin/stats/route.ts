import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLANS } from '@/lib/plans'

// GET /api/admin/stats - Platform-wide statistics
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalUsers,
    totalTenants,
    planCounts,
    totalChatbots,
    totalConversations,
    totalMessages,
    monthlyUsage,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.tenant.groupBy({
      by: ['plan'],
      _count: true,
    }),
    prisma.chatbot.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { tokens: true, cost: true },
    }),
  ])

  // Calculate revenue from plan distribution
  const planDistribution: Record<string, number> = { free: 0, pro: 0, business: 0 }
  for (const pc of planCounts) {
    planDistribution[pc.plan] = pc._count
  }

  const monthlyRevenue =
    (planDistribution.pro || 0) * PLANS.pro.price +
    (planDistribution.business || 0) * PLANS.business.price

  return NextResponse.json({
    totalUsers,
    totalTenants,
    paidTenants: (planDistribution.pro || 0) + (planDistribution.business || 0),
    monthlyRevenue,
    totalChatbots,
    totalConversations,
    totalMessages,
    monthlyTokens: monthlyUsage._sum.tokens || 0,
    monthlyCost: monthlyUsage._sum.cost || 0,
    planDistribution,
  })
}
