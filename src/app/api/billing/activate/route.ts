import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSubscription } from '@/lib/paypal'
import { applyPlanLimits, type PlanId } from '@/lib/plans'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { subscriptionId } = body

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    // Find our pending subscription record
    const sub = await prisma.subscription.findUnique({
      where: { paypalSubscriptionId: subscriptionId },
    })

    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Verify ownership
    if (sub.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Already active? Return success
    if (sub.status === 'ACTIVE') {
      return NextResponse.json({ activated: true })
    }

    // Check PayPal for actual status
    const paypalSub = await getSubscription(subscriptionId)

    if (paypalSub.status === 'ACTIVE') {
      // Activate in our database
      await prisma.subscription.update({
        where: { paypalSubscriptionId: subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(paypalSub.billing_info?.last_payment?.time || new Date()),
          currentPeriodEnd: new Date(paypalSub.billing_info?.next_billing_time || new Date()),
        },
      })

      // Apply plan limits
      await applyPlanLimits(sub.tenantId, sub.planId as PlanId)

      return NextResponse.json({ activated: true })
    }

    // Not yet active on PayPal's side
    return NextResponse.json({ activated: false, paypalStatus: paypalSub.status })
  } catch (error) {
    console.error('Activate error:', error)
    return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
  }
}
