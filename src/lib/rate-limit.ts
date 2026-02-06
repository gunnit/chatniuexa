/**
 * Simple in-memory sliding window rate limiter.
 * Suitable for single-instance deployments on Render.
 */

const windowMs = 60 * 1000 // 1 minute window
const maxRequests = 20 // max requests per window per IP

const hits = new Map<string, number[]>()

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - windowMs
  for (const [key, timestamps] of hits) {
    const valid = timestamps.filter((t) => t > cutoff)
    if (valid.length === 0) {
      hits.delete(key)
    } else {
      hits.set(key, valid)
    }
  }
}, 5 * 60 * 1000)

export function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const cutoff = now - windowMs
  const timestamps = (hits.get(ip) || []).filter((t) => t > cutoff)

  if (timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  timestamps.push(now)
  hits.set(ip, timestamps)
  return { allowed: true, remaining: maxRequests - timestamps.length }
}
