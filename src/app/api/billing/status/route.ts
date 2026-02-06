import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLANS } from '@/lib/plans'

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { plan: true },
  })

  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId: session.user.tenantId,
      status: { in: ['ACTIVE', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  const plan = (tenant?.plan || 'free') as keyof typeof PLANS
  const planInfo = PLANS[plan] || PLANS.free

  return NextResponse.json({
    plan,
    planName: planInfo.name,
    price: planInfo.price,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          planId: subscription.planId,
        }
      : null,
  })
}
