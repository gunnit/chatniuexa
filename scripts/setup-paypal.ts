/**
 * PayPal Setup Script
 *
 * Creates the PayPal product and subscription plans for niuexa.ai.
 * Run once with: npx tsx scripts/setup-paypal.ts
 *
 * Prerequisites:
 * - PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables set
 * - PAYPAL_API_BASE set (defaults to sandbox)
 */

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error('Error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set')
  process.exit(1)
}

async function getAccessToken(): Promise<string> {
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
    throw new Error(`OAuth failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return data.access_token
}

async function createProduct(token: string): Promise<string> {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name: 'niuexa.ai AI Chatbot Platform',
      description: 'AI-powered chatbot platform with RAG capabilities',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  })

  if (!res.ok) {
    throw new Error(`Create product failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  console.log(`Product created: ${data.id}`)
  return data.id
}

async function createPlan(
  token: string,
  productId: string,
  name: string,
  price: string
): Promise<string> {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      product_id: productId,
      name: `niuexa.ai ${name} Plan`,
      description: `${name} subscription plan for niuexa.ai`,
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite
          pricing_scheme: {
            fixed_price: {
              value: price,
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Create plan failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  console.log(`${name} plan created: ${data.id}`)
  return data.id
}

async function createWebhook(token: string, webhookUrl: string): Promise<string> {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      event_types: [
        { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
        { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
        { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
        { name: 'PAYMENT.SALE.COMPLETED' },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Create webhook failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  console.log(`Webhook created: ${data.id}`)
  return data.id
}

async function main() {
  const command = process.argv[2] || 'all'
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/webhook`
    : 'https://chatniuexa.onrender.com/api/billing/webhook'

  console.log('Setting up PayPal billing...')
  console.log(`API Base: ${PAYPAL_API_BASE}`)
  console.log(`Command: ${command}\n`)

  const token = await getAccessToken()
  console.log('Authenticated with PayPal\n')

  if (command === 'webhook-only') {
    // Just create the webhook (bypasses sandbox dashboard UI bug)
    console.log(`Creating webhook for: ${webhookUrl}`)
    const webhookId = await createWebhook(token, webhookUrl)
    console.log('\n--- Add this to your environment variables ---')
    console.log(`PAYPAL_WEBHOOK_ID=${webhookId}`)
    return
  }

  // Full setup: product + plans + webhook
  const productId = await createProduct(token)
  const proPlanId = await createPlan(token, productId, 'Pro', '29.00')
  const businessPlanId = await createPlan(token, productId, 'Business', '149.00')

  console.log(`\nCreating webhook for: ${webhookUrl}`)
  const webhookId = await createWebhook(token, webhookUrl)

  console.log('\n--- Add these to your environment variables ---')
  console.log(`PAYPAL_PLAN_PRO_ID=${proPlanId}`)
  console.log(`PAYPAL_PLAN_BUSINESS_ID=${businessPlanId}`)
  console.log(`PAYPAL_WEBHOOK_ID=${webhookId}`)
  console.log('\nDone! All set up.')
}

main().catch((err) => {
  console.error('Setup failed:', err)
  process.exit(1)
})
