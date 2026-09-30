// Runs once when a Next.js server starts (never during `next build`), and must
// finish before the server takes requests, so it only schedules work.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startSubscriptionExpirySweep } = await import('@/lib/subscription-expiry')
      startSubscriptionExpirySweep()
    } catch (error) {
      // Billing housekeeping must never keep the site from starting.
      console.error('Failed to start the subscription expiry sweep', error)
    }
  }
}
