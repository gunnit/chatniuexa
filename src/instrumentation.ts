/**
 * Runs once when a Next.js server starts (never during `next build`).
 *
 * PayPal sends no event when a cancelled subscription's paid period ends, and
 * events can be missed, so the production server re-syncs subscriptions whose
 * stored state may be stale every hour (resyncStaleSubscriptions).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return

  try {
    const { startSubscriptionSweep } = await import('@/lib/subscriptions')
    startSubscriptionSweep()
  } catch (error) {
    // Next rethrows errors from register(); never let the sweep stop start-up.
    console.error('Failed to start the subscription sweep', error)
  }
}
