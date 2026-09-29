/**
 * Runs once when a Next.js server starts (never during `next build`).
 *
 * A cancelled PayPal subscription keeps its plan until the period it paid for
 * ends, and PayPal sends no event at that point, so the production server
 * sweeps for lapsed subscriptions hourly (expireLapsedSubscriptions).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return

  try {
    const { startExpirySweep } = await import('@/lib/subscriptions')
    startExpirySweep()
  } catch (error) {
    // Next rethrows errors from register(); never let the sweep stop start-up.
    console.error('Failed to start the subscription expiry sweep', error)
  }
}
