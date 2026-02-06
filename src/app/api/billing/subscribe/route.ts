import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createSubscription } from '@/lib/paypal'
import { z } from 'zod'

const subscribeSchema = z.object({
  plan: z.enum(['pro', 'business']),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { plan } = subscribeSchema.parse(body)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${appUrl}/dashboard/billing/success?plan=${plan}`
    const cancelUrl = `${appUrl}/dashboard/billing/cancelled`

    const { subscriptionId, approveUrl } = await createSubscription(
      plan,
      session.user.email,
      returnUrl,
      cancelUrl
    )

    // Save subscription record so the webhook can find and activate it
    await prisma.subscription.create({
      data: {
        tenantId: session.user.tenantId,
        planId: plan,
        paypalSubscriptionId: subscriptionId,
        status: 'PENDING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      },
    })

    return NextResponse.json({ approveUrl })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid plan', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
