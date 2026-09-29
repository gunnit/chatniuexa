/**
 * PayPal subscription state, and the tenant plan it pays for.
 *
 * Webhooks can arrive late, twice or out of order, so an event is only a cue
 * to re-read the subscription from PayPal and act on its current state.
 * A tenant can hold several subscription rows (each checkout inserts one) and
 * an admin can set a plan by hand, so the tenant's plan is reconciled across
 * all of its subscriptions rather than copied from whichever one changed.
 */

import type { Subscription, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSubscription } from '@/lib/paypal'
import { applyPlanLimits, PLANS, type PlanId } from '@/lib/plans'
import { sendBillingConfirmation } from '@/lib/email'
import { logger } from '@/lib/logger'

type SubscriptionState = Pick<Subscription, 'planId' | 'status' | 'currentPeriodEnd'>

// The fields of PayPal's subscription resource this module reads.
interface PayPalSubscription {
  status: string
  billing_info?: {
    next_billing_time?: string
    last_payment?: { time?: string }
  }
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2 }

function toPlanId(plan: string): PlanId {
  return plan in PLANS ? (plan as PlanId) : 'free'
}

/** A subscription pays for its plan while PayPal bills it and, once cancelled, until the paid period ends. */
export function grantsAccess(sub: Pick<Subscription, 'status' | 'currentPeriodEnd'>, now: Date): boolean {
  return sub.status === 'ACTIVE' || (sub.status === 'CANCELLED' && sub.currentPeriodEnd > now)
}

/**
 * The plan to move the tenant to after `changed` reached its new state, or null
 * to leave it. `subs` is all of the tenant's subscriptions, `changed` included.
 * Upgrades to the best plan the subscriptions pay for. Downgrades only when
 * `changed` stopped granting access and was paying for the current plan, so a
 * newer subscription for another plan, or an admin grant, is left alone.
 * An unknown `tenantPlan` counts as free, as in getPlanLimits.
 */
export function nextTenantPlan(
  tenantPlan: string,
  subs: SubscriptionState[],
  changed: SubscriptionState,
  now: Date
): PlanId | null {
  const currentPlan = toPlanId(tenantPlan)
  let paid: PlanId | null = null
  for (const sub of subs) {
    if (!grantsAccess(sub, now)) continue
    const plan = toPlanId(sub.planId)
    if (!paid || PLAN_RANK[plan] > PLAN_RANK[paid]) paid = plan
  }

  if (paid && PLAN_RANK[paid] > PLAN_RANK[currentPlan]) return paid

  if (!grantsAccess(changed, now) && toPlanId(changed.planId) === currentPlan) {
    const target = paid ?? 'free'
    return target === currentPlan ? null : target
  }
  return null
}

/** Our status for PayPal's, or null while the subscription isn't live yet (APPROVAL_PENDING, APPROVED). */
function statusFor(paypalStatus: string, currentPeriodEnd: Date, now: Date): SubscriptionStatus | null {
  switch (paypalStatus) {
    case 'ACTIVE':
      return 'ACTIVE'
    case 'SUSPENDED':
      return 'SUSPENDED'
    case 'EXPIRED':
      return 'EXPIRED'
    case 'CANCELLED':
      // Access continues until the paid period ends; after that it is spent.
      return currentPeriodEnd > now ? 'CANCELLED' : 'EXPIRED'
    default:
      return null
  }
}

async function reconcileTenantPlan(changed: Subscription, now: Date) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: changed.tenantId },
    select: { plan: true },
  })
  if (!tenant) return

  const others = await prisma.subscription.findMany({
    where: { tenantId: changed.tenantId, id: { not: changed.id } },
    select: { planId: true, status: true, currentPeriodEnd: true },
  })
  const currentPlan = toPlanId(tenant.plan)
  const plan = nextTenantPlan(tenant.plan, [...others, changed], changed, now)

  if (plan) {
    await applyPlanLimits(changed.tenantId, plan)
    logger.info('Tenant plan changed by subscription', {
      tenantId: changed.tenantId,
      from: tenant.plan,
      to: plan,
      subscriptionId: changed.paypalSubscriptionId,
      status: changed.status,
    })
  } else if (grantsAccess(changed, now) && toPlanId(changed.planId) === currentPlan) {
    // Re-apply the plan a live subscription pays for, so its limits track PLANS.
    await applyPlanLimits(changed.tenantId, currentPlan)
  }
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
 * Re-read a subscription from PayPal, move the tenant's plan to match, then
 * store the subscription's new state. The plan goes first: if either write
 * fails, the row still shows the old state, so PayPal's retry redoes both.
 * Returns null for a subscription this app has no record of.
 */
export async function syncSubscription(paypalSubscriptionId: string) {
  const sub = await prisma.subscription.findUnique({ where: { paypalSubscriptionId } })
  if (!sub) return null

  const paypal: PayPalSubscription = await getSubscription(paypalSubscriptionId)
  const now = new Date()
  const status = statusFor(paypal.status, sub.currentPeriodEnd, now)
  if (!status) return { status: sub.status, paypalStatus: paypal.status }

  const data: Pick<Subscription, 'status'> & Partial<Pick<Subscription, 'currentPeriodStart' | 'currentPeriodEnd'>> = {
    status,
  }
  if (status === 'ACTIVE') {
    const lastPayment = paypal.billing_info?.last_payment?.time
    const nextBilling = paypal.billing_info?.next_billing_time
    if (lastPayment) data.currentPeriodStart = new Date(lastPayment)
    if (nextBilling) data.currentPeriodEnd = new Date(nextBilling)
  }

  await reconcileTenantPlan({ ...sub, ...data }, now)

  let activated = false
  if (status === 'ACTIVE') {
    // Only the write that flips the row to ACTIVE sends the confirmation, so
    // duplicate or concurrent deliveries can't email twice.
    const { count } = await prisma.subscription.updateMany({
      where: { id: sub.id, status: { not: 'ACTIVE' } },
      data,
    })
    activated = count === 1
    if (!activated) await prisma.subscription.update({ where: { id: sub.id }, data })
  } else {
    await prisma.subscription.update({ where: { id: sub.id }, data })
  }

  if (activated) await sendConfirmation(sub)
  return { status, paypalStatus: paypal.status }
}

/**
 * Downgrade tenants whose cancelled subscription has reached the end of the
 * period it paid for, and mark it EXPIRED. PayPal sends no event at that
 * point, so this runs on a timer (src/instrumentation.ts). Safe to run
 * repeatedly or concurrently. Returns how many subscriptions it expired.
 */
export async function expireLapsedSubscriptions(now = new Date()): Promise<number> {
  const lapsed = await prisma.subscription.findMany({
    where: { status: 'CANCELLED', currentPeriodEnd: { lte: now } },
  })

  let expired = 0
  for (const sub of lapsed) {
    try {
      // Plan first, as in syncSubscription: if it fails, the row stays
      // CANCELLED and the next run retries it.
      await reconcileTenantPlan({ ...sub, status: 'EXPIRED' }, now)
      const { count } = await prisma.subscription.updateMany({
        where: { id: sub.id, status: 'CANCELLED' },
        data: { status: 'EXPIRED' },
      })
      expired += count
    } catch (error) {
      logger.error('Failed to expire lapsed subscription', {
        subscriptionId: sub.paypalSubscriptionId,
        error: String(error),
      })
    }
  }
  return expired
}

const EXPIRY_SWEEP_INTERVAL_MS = 60 * 60 * 1000

/** Run expireLapsedSubscriptions a minute after start-up, then hourly. */
export function startExpirySweep() {
  const run = () =>
    expireLapsedSubscriptions()
      .then((count) => {
        if (count > 0) logger.info('Expired lapsed subscriptions', { count })
      })
      .catch((error) => logger.error('Subscription expiry sweep failed', { error: String(error) }))

  setTimeout(run, 60_000).unref()
  setInterval(run, EXPIRY_SWEEP_INTERVAL_MS).unref()
}
