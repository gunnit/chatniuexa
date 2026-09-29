/**
 * PayPal subscription state, and the tenant plan it pays for.
 *
 * Webhooks can arrive late, twice or out of order, and stored dates can be
 * stale (renewals never arrived while the middleware blocked PayPal's
 * webhooks), so every change starts by re-reading the subscription from
 * PayPal. A tenant can hold several subscription rows (each checkout inserts
 * one) and an admin can set a plan by hand, so a change to one subscription
 * moves the tenant's plan only as far as that subscription accounts for.
 */

import type { Prisma, Subscription } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSubscription } from '@/lib/paypal'
import { applyPlanLimits, PLANS, type PlanId } from '@/lib/plans'
import { sendBillingConfirmation } from '@/lib/email'
import { logger } from '@/lib/logger'

type SubscriptionState = Pick<Subscription, 'planId' | 'status' | 'currentPeriodEnd'>
type SubscriptionUpdate = Pick<Subscription, 'status'> &
  Partial<Pick<Subscription, 'currentPeriodStart' | 'currentPeriodEnd'>>

// The fields of PayPal's subscription resource this module reads.
interface PayPalSubscription {
  status: string
  billing_info?: {
    next_billing_time?: string
    last_payment?: { time?: string }
  }
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2 }
const DAY_MS = 24 * 60 * 60 * 1000

function toPlanId(plan: string): PlanId {
  return plan in PLANS ? (plan as PlanId) : 'free'
}

/** A subscription pays for its plan while PayPal bills it and, once cancelled, until the paid period ends. */
export function grantsAccess(sub: Pick<Subscription, 'status' | 'currentPeriodEnd'>, now: Date): boolean {
  return sub.status === 'ACTIVE' || (sub.status === 'CANCELLED' && sub.currentPeriodEnd > now)
}

/**
 * The plan to move the tenant to after one of its subscriptions went from
 * `before` to `after`, or null to leave it; `others` are its other
 * subscriptions. A subscription that grants access raises the tenant to its
 * plan. One that stops granting access lowers the tenant only from the plan
 * it was paying for, to the best plan the others still pay for, or free. So
 * a newer subscription for another plan, or an admin grant, is left alone.
 * An unknown `tenantPlan` counts as free, as in getPlanLimits.
 */
export function nextTenantPlan(
  tenantPlan: string,
  before: SubscriptionState,
  after: SubscriptionState,
  others: SubscriptionState[],
  now: Date
): PlanId | null {
  const current = toPlanId(tenantPlan)
  const plan = toPlanId(after.planId)

  if (grantsAccess(after, now)) {
    return PLAN_RANK[plan] > PLAN_RANK[current] ? plan : null
  }

  // Only a change out of a paying state takes a plan away; seeing a
  // subscription that had already ended again changes nothing.
  const wasPaying = before.status === 'ACTIVE' || before.status === 'CANCELLED'
  if (!wasPaying || plan !== current) return null

  let fallback: PlanId = 'free'
  for (const sub of others) {
    const other = toPlanId(sub.planId)
    if (grantsAccess(sub, now) && PLAN_RANK[other] > PLAN_RANK[fallback]) fallback = other
  }
  return fallback === current ? null : fallback
}

/**
 * When a cancelled subscription's access ends: the later of our stored date
 * and a month after PayPal's last payment (plans bill monthly, see
 * scripts/setup-paypal.ts).
 */
function paidThrough(storedEnd: Date, paypal: PayPalSubscription): Date {
  const lastPayment = paypal.billing_info?.last_payment?.time
  if (!lastPayment) return storedEnd
  const end = new Date(lastPayment)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return end > storedEnd ? end : storedEnd
}

/** The row's new state for PayPal's, or null while the subscription isn't live yet (APPROVAL_PENDING, APPROVED). */
function nextState(sub: Subscription, paypal: PayPalSubscription, now: Date): SubscriptionUpdate | null {
  switch (paypal.status) {
    case 'ACTIVE': {
      const update: SubscriptionUpdate = { status: 'ACTIVE' }
      const lastPayment = paypal.billing_info?.last_payment?.time
      const nextBilling = paypal.billing_info?.next_billing_time
      if (lastPayment) update.currentPeriodStart = new Date(lastPayment)
      if (nextBilling) update.currentPeriodEnd = new Date(nextBilling)
      return update
    }
    case 'SUSPENDED':
      return { status: 'SUSPENDED' }
    case 'EXPIRED':
      return { status: 'EXPIRED' }
    case 'CANCELLED': {
      // Access continues until the paid period ends; after that it is spent.
      const end = paidThrough(sub.currentPeriodEnd, paypal)
      return { status: end > now ? 'CANCELLED' : 'EXPIRED', currentPeriodEnd: end }
    }
    default:
      return null
  }
}

/** Move the tenant's plan after `before` became `after`; returns the change made, if any. */
async function reconcileTenantPlan(
  tx: Prisma.TransactionClient,
  before: Subscription,
  after: Subscription,
  now: Date
): Promise<{ from: string; to: PlanId } | null> {
  const tenant = await tx.tenant.findUnique({ where: { id: after.tenantId }, select: { plan: true } })
  if (!tenant) return null

  const others = await tx.subscription.findMany({
    where: { tenantId: after.tenantId, id: { not: after.id } },
    select: { planId: true, status: true, currentPeriodEnd: true },
  })
  const plan = nextTenantPlan(tenant.plan, before, after, others, now)

  if (plan) {
    await applyPlanLimits(after.tenantId, plan, tx)
    return { from: tenant.plan, to: plan }
  }
  if (grantsAccess(after, now) && toPlanId(after.planId) === toPlanId(tenant.plan)) {
    // Re-apply the plan a live subscription pays for, so its limits track PLANS.
    await applyPlanLimits(after.tenantId, toPlanId(tenant.plan), tx)
  }
  return null
}

async function sendConfirmation(sub: Subscription) {
  try {
    const profile = await prisma.profile.findFirst({
      where: { tenantId: sub.tenantId },
      include: { user: true },
    })
    if (!profile?.user?.email) return
    const plan = PLANS[sub.planId as PlanId]
    await sendBillingConfirmation(
      profile.user.email,
      profile.fullName || profile.user.name || 'there',
      plan?.name || sub.planId,
      plan?.price || 0
    )
  } catch (error) {
    // The subscription is already stored; a lost email must not fail the caller.
    logger.error('Failed to look up billing confirmation recipient', {
      tenantId: sub.tenantId,
      error: String(error),
    })
  }
}

/**
 * Re-read a subscription from PayPal, then store its new state and move the
 * tenant's plan to match in one transaction. Returns null for a subscription
 * this app has no record of.
 *
 * PayPal is read before the transaction so no lock is held across network
 * calls. Two syncs of the same subscription seconds apart can therefore
 * commit in the opposite order to their reads; the next event or sweep
 * corrects that.
 */
export async function syncSubscription(paypalSubscriptionId: string) {
  const known = await prisma.subscription.findUnique({
    where: { paypalSubscriptionId },
    select: { id: true, tenantId: true },
  })
  if (!known) return null

  const paypal: PayPalSubscription = await getSubscription(paypalSubscriptionId)

  const result = await prisma.$transaction(async (tx) => {
    // One sync per tenant at a time: each decides from the tenant's other
    // subscriptions, so concurrent ones must not act on each other's stale reads.
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${known.tenantId} FOR UPDATE`

    const sub = await tx.subscription.findUniqueOrThrow({ where: { id: known.id } })
    const now = new Date()
    const update = nextState(sub, paypal, now)
    if (!update) return { sub, status: sub.status, activated: false, planChange: null }

    const after = await tx.subscription.update({ where: { id: sub.id }, data: update })
    const planChange = await reconcileTenantPlan(tx, sub, after, now)
    // Under the lock, only one delivery sees the row leave a non-ACTIVE state,
    // so duplicate or concurrent deliveries can't send the confirmation twice.
    const activated = after.status === 'ACTIVE' && sub.status !== 'ACTIVE'
    return { sub: after, status: after.status, activated, planChange }
  })

  if (result.planChange) {
    logger.info('Tenant plan changed by subscription', {
      tenantId: result.sub.tenantId,
      ...result.planChange,
      subscriptionId: paypalSubscriptionId,
      status: result.status,
    })
  }
  if (result.activated) await sendConfirmation(result.sub)
  return { status: result.status, paypalStatus: paypal.status }
}

/**
 * Re-sync subscriptions whose stored state may have gone stale: cancelled
 * ones whose paid period looks over (PayPal sends no event then), and active
 * ones more than two days past their renewal (a missed event, or one PayPal
 * has ended). Runs on a timer (src/instrumentation.ts); a subscription that
 * fails is left as it is for the next run. Returns how many it re-synced.
 */
export async function resyncStaleSubscriptions(now = new Date()): Promise<number> {
  const stale = await prisma.subscription.findMany({
    where: {
      OR: [
        { status: 'CANCELLED', currentPeriodEnd: { lte: now } },
        { status: 'ACTIVE', currentPeriodEnd: { lte: new Date(now.getTime() - 2 * DAY_MS) } },
      ],
    },
    select: { paypalSubscriptionId: true },
  })

  let synced = 0
  for (const { paypalSubscriptionId } of stale) {
    try {
      await syncSubscription(paypalSubscriptionId)
      synced++
    } catch (error) {
      logger.error('Failed to re-sync subscription', {
        subscriptionId: paypalSubscriptionId,
        error: String(error),
      })
    }
  }
  return synced
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000

/** Run resyncStaleSubscriptions a minute after start-up, then hourly. */
export function startSubscriptionSweep() {
  const run = () =>
    resyncStaleSubscriptions()
      .then((count) => {
        if (count > 0) logger.info('Re-synced stale subscriptions', { count })
      })
      .catch((error) => logger.error('Subscription sweep failed', { error: String(error) }))

  setTimeout(run, 60_000).unref()
  setInterval(run, SWEEP_INTERVAL_MS).unref()
}
