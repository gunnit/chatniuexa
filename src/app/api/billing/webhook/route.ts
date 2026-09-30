import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/paypal'
import { syncSubscription } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'

// PayPal sends these with every delivery, and verification needs all of them.
const PAYPAL_SIGNATURE_HEADERS = [
  'paypal-auth-algo',
  'paypal-cert-url',
  'paypal-transmission-id',
  'paypal-transmission-sig',
  'paypal-transmission-time',
]

// Events that change a subscription. Each one only prompts a re-read of the
// subscription from PayPal (see syncSubscription), because deliveries can
// arrive late, twice or out of order.
const SUBSCRIPTION_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'PAYMENT.SALE.COMPLETED',
])

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

  if (!SUBSCRIPTION_EVENTS.has(eventType)) {
    return NextResponse.json({ received: true })
  }

  // A sale names its subscription as billing_agreement_id; subscription
  // events are the subscription itself.
  const subscriptionId: unknown =
    eventType === 'PAYMENT.SALE.COMPLETED' ? resource?.billing_agreement_id : resource?.id
  if (typeof subscriptionId !== 'string' || !subscriptionId) {
    return NextResponse.json({ received: true })
  }

  try {
    await syncSubscription(subscriptionId)
    return NextResponse.json({ received: true })
  } catch (error) {
    // 500 makes PayPal retry the delivery later.
    logger.error('Webhook processing error', { eventType, subscriptionId, error: String(error) })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
