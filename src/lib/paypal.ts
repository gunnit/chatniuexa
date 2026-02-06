const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!

const PLAN_IDS: Record<string, string> = {
  pro: process.env.PAYPAL_PLAN_PRO_ID || '',
  business: process.env.PAYPAL_PLAN_BUSINESS_ID || '',
}

export function getPayPalPlanId(plan: 'pro' | 'business'): string {
  const id = PLAN_IDS[plan]
  if (!id) throw new Error(`PayPal plan ID not configured for ${plan}`)
  return id
}

export async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal OAuth failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.access_token
}

export async function createSubscription(
  planId: 'pro' | 'business',
  email: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ subscriptionId: string; approveUrl: string }> {
  const token = await getPayPalAccessToken()
  const paypalPlanId = getPayPalPlanId(planId)

  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      plan_id: paypalPlanId,
      subscriber: {
        email_address: email,
      },
      application_context: {
        brand_name: 'niuexa.ai',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal create subscription failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  const approveLink = data.links?.find(
    (l: { rel: string; href: string }) => l.rel === 'approve'
  )

  return {
    subscriptionId: data.id,
    approveUrl: approveLink?.href || '',
  }
}

export async function getSubscription(subscriptionId: string) {
  const token = await getPayPalAccessToken()

  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal get subscription failed: ${res.status} ${text}`)
  }

  return res.json()
}

export async function cancelSubscription(
  subscriptionId: string,
  reason = 'Customer requested cancellation'
) {
  const token = await getPayPalAccessToken()

  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal cancel subscription failed: ${res.status} ${text}`)
  }
}

export async function verifyWebhookSignature(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('PAYPAL_WEBHOOK_ID not configured')
    return false
  }

  const token = await getPayPalAccessToken()

  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    }
  )

  if (!res.ok) return false

  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}
