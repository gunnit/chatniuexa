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

/**
 * Custom-window rate limiter for cases where the default 20/min isn't right
 * (e.g. forgot-password should be 3/hour). Uses an isolated bucket so it
 * doesn't share state with the chat IP limiter above.
 */
const customHits = new Map<string, number[]>()

setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24h hard cap on retention
  for (const [key, timestamps] of customHits) {
    const valid = timestamps.filter((t) => t > cutoff)
    if (valid.length === 0) {
      customHits.delete(key)
    } else {
      customHits.set(key, valid)
    }
  }
}, 5 * 60 * 1000)

export function rateLimitCustom(
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const cutoff = now - windowSeconds * 1000
  const fullKey = `${bucket}:${key}`
  const timestamps = (customHits.get(fullKey) || []).filter((t) => t > cutoff)

  if (timestamps.length >= limit) {
    return { allowed: false, remaining: 0 }
  }

  timestamps.push(now)
  customHits.set(fullKey, timestamps)
  return { allowed: true, remaining: limit - timestamps.length }
}
