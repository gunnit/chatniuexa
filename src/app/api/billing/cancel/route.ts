import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { cancelSubscription } from '@/lib/paypal'

export async function POST() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId: session.user.tenantId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!subscription) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 404 }
    )
  }

  try {
    await cancelSubscription(subscription.paypalSubscriptionId)

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({
      message: 'Subscription cancelled. Access continues until period end.',
      periodEnd: subscription.currentPeriodEnd,
    })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
