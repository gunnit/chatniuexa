import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/admin/users - List all users with tenant and usage info
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
  const search = searchParams.get('search') || ''
  const planFilter = searchParams.get('plan') || ''

  // Build where clause
  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (planFilter) {
    where.profile = { tenant: { plan: planFilter } }
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            tenant: {
              select: {
                id: true,
                name: true,
                plan: true,
                chatbots: { select: { id: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  // Fetch usage limits for all tenants in the result
  const tenantIds = users
    .map((u) => u.profile?.tenant?.id)
    .filter((id): id is string => !!id)

  const usageLimits = tenantIds.length > 0
    ? await prisma.usageLimit.findMany({
        where: { tenantId: { in: tenantIds } },
      })
    : []

  const usageMap = new Map(usageLimits.map((ul) => [ul.tenantId, ul]))

  const enrichedUsers = users.map((user) => {
    const tenantId = user.profile?.tenant?.id
    const usage = tenantId ? usageMap.get(tenantId) : null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      tenant: user.profile?.tenant
        ? {
            id: user.profile.tenant.id,
            name: user.profile.tenant.name,
            plan: user.profile.tenant.plan,
            chatbotCount: user.profile.tenant.chatbots.length,
          }
        : null,
      usage: usage
        ? {
            currentMonthTokens: usage.currentMonthTokens,
            currentDayMessages: usage.currentDayMessages,
            currentMonthCost: usage.currentMonthCost,
            monthlyTokenLimit: usage.monthlyTokenLimit,
            dailyMessageLimit: usage.dailyMessageLimit,
            monthlyCostLimit: usage.monthlyCostLimit,
          }
        : null,
    }
  })

  return NextResponse.json({
    users: enrichedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
