import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { syncSubscription } from '@/lib/subscriptions'

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

    // Check PayPal for actual status. This applies the plan and sends the
    // confirmation email if the subscription has gone live (the webhook does
    // the same, and whichever gets there first sends the one email).
    const result = await syncSubscription(subscriptionId)

    if (result?.status === 'ACTIVE') {
      return NextResponse.json({ activated: true })
    }

    // Not yet active on PayPal's side
    return NextResponse.json({ activated: false, paypalStatus: result?.paypalStatus })
  } catch (error) {
    console.error('Activate error:', error)
    return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
  }
}
