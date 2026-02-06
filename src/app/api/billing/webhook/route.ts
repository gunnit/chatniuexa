import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyWebhookSignature, getSubscription } from '@/lib/paypal'
import { applyPlanLimits, type PlanId } from '@/lib/plans'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  // Verify webhook signature
  const isValid = await verifyWebhookSignature(headers, body)
  if (!isValid) {
    console.error('Invalid PayPal webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const eventType = event.event_type as string
  const resource = event.resource

  console.log(`PayPal webhook: ${eventType}`, resource?.id)

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId = resource.id
        const paypalSub = await getSubscription(subscriptionId)

        // Find which subscription record this belongs to
        const existing = await prisma.subscription.findUnique({
          where: { paypalSubscriptionId: subscriptionId },
        })

        if (existing) {
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
        }
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subscriptionId = resource.id
        const sub = await prisma.subscription.findUnique({
          where: { paypalSubscriptionId: subscriptionId },
        })

        if (sub) {
          await prisma.subscription.update({
            where: { paypalSubscriptionId: subscriptionId },
            data: { status: 'CANCELLED' },
          })

          // Downgrade to free at period end (or immediately if past period)
          const now = new Date()
          if (sub.currentPeriodEnd <= now) {
            await applyPlanLimits(sub.tenantId, 'free')
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

      case 'PAYMENT.SALE.COMPLETED': {
        // Payment received - extend the period
        const billingAgreementId = resource.billing_agreement_id
        if (billingAgreementId) {
          const sub = await prisma.subscription.findUnique({
            where: { paypalSubscriptionId: billingAgreementId },
          })

          if (sub) {
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
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
