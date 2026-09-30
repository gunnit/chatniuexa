/**
 * One-off repair for state lost while the auth middleware blocked PayPal's
 * webhooks (fixed in #9): compare every subscription that isn't EXPIRED with
 * PayPal and, with --apply, re-sync each one (syncSubscription in
 * src/lib/subscriptions.ts). That catches rows PayPal has ended that still
 * show ACTIVE, and checkouts PayPal is billing that never left PENDING.
 *
 * --apply moves tenants' plans to match what PayPal bills, and sends the usual
 * confirmation email for any subscription it activates.
 *
 * Requires the app's DATABASE_URL and PAYPAL_* variables.
 *
 * Usage:
 *   npx tsx scripts/resync-subscriptions.ts           # report only
 *   npx tsx scripts/resync-subscriptions.ts --apply   # re-sync
 */
import { prisma } from '../src/lib/db'
import { getSubscription } from '../src/lib/paypal'
import { syncSubscription } from '../src/lib/subscriptions'

async function main() {
  const apply = process.argv.includes('--apply')
  const subs = await prisma.subscription.findMany({
    where: { status: { not: 'EXPIRED' } },
    include: { tenant: { select: { plan: true } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(
    `${subs.length} subscription(s) not EXPIRED` +
      (apply ? ', re-syncing:\n' : ' (report only; pass --apply to re-sync):\n')
  )

  let failed = 0
  for (const sub of subs) {
    const ours =
      `${sub.paypalSubscriptionId}  tenant ${sub.tenantId} on ${sub.tenant.plan}  ` +
      `${sub.planId} ${sub.status} until ${sub.currentPeriodEnd.toISOString().slice(0, 10)}`
    try {
      if (apply) {
        const result = await syncSubscription(sub.paypalSubscriptionId)
        const tenant = await prisma.tenant.findUnique({ where: { id: sub.tenantId }, select: { plan: true } })
        console.log(`${ours}  ->  PayPal ${result?.paypalStatus}; now ${result?.status}, tenant on ${tenant?.plan}`)
      } else {
        const paypal = await getSubscription(sub.paypalSubscriptionId)
        console.log(
          `${ours}  |  PayPal ${paypal.status}, last payment ${paypal.billing_info?.last_payment?.time ?? '-'}, ` +
            `next billing ${paypal.billing_info?.next_billing_time ?? '-'}`
        )
      }
    } catch (error) {
      failed++
      console.log(`${ours}  !!  ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failed) console.log(`\n${failed} failed and were left unchanged.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
