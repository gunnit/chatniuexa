/**
 * Origin / referer enforcement for public chatbot endpoints.
 *
 * Used by /api/chat, /api/chat/stream, /api/chat/reaction, /api/widget/[id].
 * Server-side enforcement (CORS alone is unsafe — non-browser clients ignore it).
 */

import { logger } from '@/lib/logger'

function safeHostname(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

const FIRST_PARTY_HOST =
  safeHostname(process.env.NEXT_PUBLIC_APP_URL || 'https://chataziendale.it') ||
  'chataziendale.it'

/**
 * Returns true if the request origin is allowed to access this chatbot.
 *
 * - First-party requests (from our own domain, e.g. /c/[token] public chat page)
 *   are always allowed.
 * - If `allowedDomains` is empty, back-compat: any origin is permitted but a
 *   warning is logged.
 * - Otherwise, the origin's hostname must match a configured domain (or a
 *   subdomain of it). The wildcard `*` allows all.
 *
 * The Referer header is used as a fallback for clients that don't send Origin
 * (rare in browsers, common in some embedded contexts).
 */
export function isChatbotOriginAllowed(args: {
  origin: string | null
  referer: string | null
  allowedDomains: readonly string[]
  chatbotId: string
}): boolean {
  const { origin, referer, allowedDomains, chatbotId } = args

  const originHost = safeHostname(origin) ?? safeHostname(referer)

  // First-party requests (e.g. /c/[token] public chat page on our own domain)
  // are always allowed.
  if (originHost === FIRST_PARTY_HOST) return true

  // Empty allow-list = unrestricted (back-compat). Warn so operators notice.
  if (allowedDomains.length === 0) {
    logger.warn('Chatbot has no allowedDomains configured', { chatbotId, originHost })
    return true
  }

  if (allowedDomains.includes('*')) return true

  if (!originHost) return false

  return allowedDomains.some((d) => {
    const domain = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!domain) return false
    return originHost === domain || originHost.endsWith('.' + domain)
  })
}
