/**
 * Shared CORS utility for public widget/chat API routes.
 *
 * Reads CORS_ALLOWED_ORIGINS from environment.
 * If not set, denies all cross-origin requests (no wildcard fallback).
 */

const envAllowed: string[] =
  process.env.CORS_ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || []

/**
 * Build CORS headers for a public chatbot endpoint.
 *
 * Pass `chatbotAllowedDomains` to grant CORS to that chatbot's configured
 * customer domains in addition to the platform-wide CORS_ALLOWED_ORIGINS list.
 * The actual server-side authz check lives in `isChatbotOriginAllowed`; CORS
 * headers exist purely so browsers don't reject the response.
 *
 * If the origin is not allowed, the Access-Control-Allow-Origin header is
 * omitted entirely (rather than returning an empty string) so browsers fail
 * cleanly.
 */
export function getCorsHeaders(
  origin?: string | null,
  methods = 'POST, OPTIONS',
  chatbotAllowedDomains: readonly string[] = [],
) {
  const requestOrigin = origin || ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }

  let allow = ''
  if (envAllowed.includes('*') || chatbotAllowedDomains.includes('*')) {
    allow = requestOrigin || '*'
  } else if (requestOrigin) {
    if (envAllowed.includes(requestOrigin)) {
      allow = requestOrigin
    } else {
      try {
        const host = new URL(requestOrigin).hostname.toLowerCase()
        const matchesChatbot = chatbotAllowedDomains.some((d) => {
          const domain = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
          return domain && (host === domain || host.endsWith('.' + domain))
        })
        if (matchesChatbot) allow = requestOrigin
      } catch {
        // ignore malformed origin
      }
    }
  }

  if (allow) {
    headers['Access-Control-Allow-Origin'] = allow
  }

  return headers
}
