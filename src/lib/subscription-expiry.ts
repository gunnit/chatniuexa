/**
 * Ends cancelled PayPal subscriptions once the period they paid for is over.
 *
 * PayPal cancels a subscription at once, but the tenant keeps its plan until
 * the paid period ends ("access continues until period end"). Nothing in
 * PayPal's API says a cancelled subscription later expires, and ours never
 * expire on their own (total_cycles: 0 in scripts/setup-paypal.ts), so
 * BILLING.SUBSCRIPTION.EXPIRED can't be relied on for this. Instead a sweep
 * marks each cancelled subscription whose paid period has ended EXPIRED and
 * moves its tenant to the free plan.
 */

import type { Subscription, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { findSubscription, type PayPalSubscription } from '@/lib/paypal'
import { applyPlanLimits } from '@/lib/plans'
import { logger } from '@/lib/logger'

const DAY_MS = 24 * 60 * 60 * 1000
const FIRST_SWEEP_DELAY_MS = 60 * 1000
const SWEEP_INTERVAL_MS = 60 * 60 * 1000

export type ExpiryOutcome = 'in-period' | 'extended' | 'expired' | 'retry'

function toDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * When the period a PayPal subscription has paid for ends: its next billing
 * time while PayPal still reports one, else one billing period after the last
 * payment. Every plan bills monthly (scripts/setup-paypal.ts); a month is
 * counted as 31 days so a paid month is never cut short. Null when there is no
 * payment to go on.
 */
function paidThrough(paypalSub: PayPalSubscription): Date | null {
  const nextBilling = toDate(paypalSub.billing_info?.next_billing_time)
  if (nextBilling) return nextBilling
  const lastPayment = toDate(paypalSub.billing_info?.last_payment?.time)
  return lastPayment && new Date(lastPayment.getTime() + 31 * DAY_MS)
}

/**
 * Marks a subscription whose status is one of `from` EXPIRED and moves the
 * tenant to the free plan, unless something else still entitles it: a plan set
 * some other way (an admin, a different subscription), or another subscription
 * that is active or still inside a paid period. The downgrade comes first, so
 * if the status update then fails, the next run finishes the job instead of
 * leaving an expired subscription with a paid tenant.
 */
export async function expireSubscription(
  sub: Subscription,
  from: SubscriptionStatus[],
  now = new Date()
): Promise<{ downgraded: boolean }> {
  if (!from.includes(sub.status)) return { downgraded: false }

  const [tenant, otherEntitlement] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: sub.tenantId }, select: { plan: true } }),
    prisma.subscription.findFirst({
      where: {
        tenantId: sub.tenantId,
        id: { not: sub.id },
        OR: [{ status: 'ACTIVE' }, { status: 'CANCELLED', currentPeriodEnd: { gt: now } }],
      },
      select: { id: true },
    }),
  ])
  const downgraded = tenant?.plan === sub.planId && !otherEntitlement
  if (downgraded) await applyPlanLimits(sub.tenantId, 'free')

  const { count } = await prisma.subscription.updateMany({
    where: { id: sub.id, status: { in: from } },
    data: { status: 'EXPIRED' },
  })
  if (count > 0 || downgraded) {
    logger.info('Subscription expired', {
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      planId: sub.planId,
      downgraded,
    })
  }
  return { downgraded }
}

/**
 * Expires a cancelled subscription if its paid period is over. The stored
 * period end only says when to look: renewals can be missing from it (PayPal
 * webhooks never reached the app before the middleware let them through), so
 * PayPal decides whether the period has really ended, and a later end found
 * there is stored for the next check.
 */
export async function expireIfPaidPeriodOver(sub: Subscription, now = new Date()): Promise<ExpiryOutcome> {
  if (sub.currentPeriodEnd > now) return 'in-period'

  let paypalSub: PayPalSubscription | null
  try {
    paypalSub = await findSubscription(sub.paypalSubscriptionId)
  } catch (error) {
    logger.error('Could not check a cancelled subscription with PayPal; will retry', {
      subscriptionId: sub.id,
      error: String(error),
    })
    return 'retry'
  }
  if (!paypalSub) {
    logger.warn('PayPal has no such subscription; ending it at its stored period end', {
      subscriptionId: sub.id,
      paypalSubscriptionId: sub.paypalSubscriptionId,
    })
  }

  const end = paypalSub && paidThrough(paypalSub)
  if (end && end > now) {
    await prisma.subscription.updateMany({
      where: { id: sub.id, status: 'CANCELLED' },
      data: { currentPeriodEnd: end },
    })
    return 'extended'
  }

  await expireSubscription(sub, ['CANCELLED'], now)
  return 'expired'
}

/** One pass over every cancelled subscription whose stored period end has passed. */
export async function expireEndedSubscriptions(now = new Date()) {
  const due = await prisma.subscription.findMany({
    where: { status: 'CANCELLED', currentPeriodEnd: { lte: now } },
    orderBy: { currentPeriodEnd: 'asc' },
  })

  const outcomes: Record<ExpiryOutcome, number> = { 'in-period': 0, extended: 0, expired: 0, retry: 0 }
  for (const sub of due) {
    try {
      outcomes[await expireIfPaidPeriodOver(sub, now)]++
    } catch (error) {
      logger.error('Failed to expire a cancelled subscription', {
        subscriptionId: sub.id,
        error: String(error),
      })
      outcomes.retry++
    }
  }
  if (due.length > 0) logger.info('Subscription expiry sweep finished', { due: due.length, ...outcomes })
  return outcomes
}

let sweepStarted = false

/** Runs the sweep a minute after the server starts, then every hour. */
export function startSubscriptionExpirySweep() {
  if (sweepStarted) return
  sweepStarted = true

  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      await expireEndedSubscriptions()
    } catch (error) {
      logger.error('Subscription expiry sweep failed', { error: String(error) })
    } finally {
      running = false
    }
  }

  setTimeout(run, FIRST_SWEEP_DELAY_MS).unref()
  setInterval(run, SWEEP_INTERVAL_MS).unref()
}
