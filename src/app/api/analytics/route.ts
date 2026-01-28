import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUsageStats } from '@/lib/usage'

// GET /api/analytics - Get usage analytics for the tenant
export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = await getUsageStats(session.user.tenantId)

  if (!stats) {
    // Return default stats if no usage yet
    return NextResponse.json({
      stats: {
        limits: {
          monthlyTokenLimit: 100000,
          dailyMessageLimit: 1000,
          monthlyCostLimit: 10,
        },
        usage: {
          currentMonthTokens: 0,
          currentMonthCost: 0,
          currentDayMessages: 0,
        },
        breakdown: [],
        totals: {
          conversations: 0,
          messages: 0,
        },
      },
    })
  }

  return NextResponse.json({ stats })
}
