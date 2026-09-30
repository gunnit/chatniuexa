import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyWebhookSignature, getSubscription } from '@/lib/paypal'
import { applyPlanLimits, PLANS, type PlanId } from '@/lib/plans'
import { sendBillingConfirmation } from '@/lib/email'
import { logger } from '@/lib/logger'
import { expireIfPaidPeriodOver, expireSubscription } from '@/lib/subscription-expiry'

// PayPal sends these with every delivery, and verification needs all of them.
const PAYPAL_SIGNATURE_HEADERS = [
  'paypal-auth-algo',
  'paypal-cert-url',
  'paypal-transmission-id',
  'paypal-transmission-sig',
  'paypal-transmission-time',
]

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  // This route is public, and verifying costs two PayPal API calls: turn away
  // requests that can't be a PayPal delivery before making them.
  if (PAYPAL_SIGNATURE_HEADERS.some((name) => !headers[name])) {
    return NextResponse.json({ error: 'Missing PayPal signature headers' }, { status: 400 })
  }
  let event
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify webhook signature
  const isValid = await verifyWebhookSignature(headers, body)
  if (!isValid) {
    logger.error('Invalid PayPal webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventType = event.event_type as string
  const resource = event.resource

  logger.info('PayPal webhook received', { eventType, resourceId: resource?.id })

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId = resource.id
        const paypalSub = await getSubscription(subscriptionId)

        // Find which subscription record this belongs to
        const existing = await prisma.subscription.findUnique({
          where: { paypalSubscriptionId: subscriptionId },
        })

        // PayPal can't reactivate a cancelled or expired subscription, so an
        // ACTIVATED for one is a late or repeated delivery. Applying it would
        // put the tenant back on a paid plan with nothing left to end it.
        if (existing && existing.status !== 'CANCELLED' && existing.status !== 'EXPIRED') {
          // Update status
          await prisma.subscription.update({
            where: { paypalSubscriptionId: subscriptionId },
            data: {
              status: 'ACTIVE',
              currentPeriodStart: new Date(paypalSub.billing_info?.last_payment?.time || new Date()),
              currentPeriodEnd: new Date(paypalSub.billing_info?.next_billing_time || new Date()),
            },
          })

          // Apply plan limits
          await applyPlanLimits(existing.tenantId, existing.planId as PlanId)

          // Send billing confirmation email
          try {
            const profile = await prisma.profile.findFirst({
              where: { tenantId: existing.tenantId },
              include: { user: true },
            })
            if (profile?.user?.email) {
              const plan = PLANS[existing.planId as PlanId]
              await sendBillingConfirmation(
                profile.user.email,
                profile.fullName || profile.user.name || 'there',
                plan?.name || existing.planId,
                plan?.price || 0
              )
            }
          } catch {
            // Don't fail webhook on email error
          }
        }
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subscriptionId = resource.id
        const sub = await prisma.subscription.findUnique({
          where: { paypalSubscriptionId: subscriptionId },
        })

        if (sub) {
          // An expired subscription has already ended; a late CANCELLED leaves it be.
          const { count } = await prisma.subscription.updateMany({
            where: { id: sub.id, status: { not: 'EXPIRED' } },
            data: { status: 'CANCELLED' },
          })

          // The tenant keeps its plan until the paid period ends. If that's
          // already past, end it now; otherwise the expiry sweep does it then.
          if (count > 0) {
            await expireIfPaidPeriodOver({ ...sub, status: 'CANCELLED' })
          }
        }
        break
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subscriptionId = resource.id
        const sub = await prisma.subscription.findUnique({
          where: { paypalSubscriptionId: subscriptionId },
        })

        if (sub) {
          await prisma.subscription.update({
            where: { paypalSubscriptionId: subscriptionId },
            data: { status: 'SUSPENDED' },
          })
          // Downgrade to free on suspension
          await applyPlanLimits(sub.tenantId, 'free')
        }
        break
      }

      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        // Ours renew until cancelled, so this can't be relied on to end a
        // cancelled subscription: the expiry sweep
        // (src/lib/subscription-expiry.ts) does that. If it does arrive, the
        // subscription is over whatever its status.
        const subscriptionId = resource.id
        const sub = await prisma.subscription.findUnique({
          where: { paypalSubscriptionId: subscriptionId },
        })

        if (sub) {
          await expireSubscription(sub, ['PENDING', 'ACTIVE', 'CANCELLED', 'SUSPENDED'])
        }
        break
      }

      case 'PAYMENT.SALE.COMPLETED': {
        // Payment received - extend the period
        const billingAgreementId = resource.billing_agreement_id
        if (billingAgreementId) {
          const sub = await prisma.subscription.findUnique({
            where: { paypalSubscriptionId: billingAgreementId },
          })

          // A payment reported after the cancellation (deliveries can arrive
          // late or out of order) renews nothing: the subscription still ends
          // with its paid period, which the expiry sweep checks with PayPal.
          if (sub && sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED') {
            const paypalSub = await getSubscription(billingAgreementId)
            await prisma.subscription.update({
              where: { paypalSubscriptionId: billingAgreementId },
              data: {
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(paypalSub.billing_info?.next_billing_time || new Date()),
              },
            })

            // Ensure plan is still applied
            await applyPlanLimits(sub.tenantId, sub.planId as PlanId)
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Webhook processing error', { error: String(error) })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
