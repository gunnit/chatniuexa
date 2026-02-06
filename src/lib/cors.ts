/**
 * Shared CORS utility for public widget/chat API routes.
 *
 * Reads CORS_ALLOWED_ORIGINS from environment.
 * If not set, denies all cross-origin requests (no wildcard fallback).
 */

const allowedOrigins: string[] =
  process.env.CORS_ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || []

export function getCorsHeaders(origin?: string | null, methods = 'POST, OPTIONS') {
  const requestOrigin = origin || ''
  let allowOrigin = ''

  if (allowedOrigins.includes('*')) {
    allowOrigin = '*'
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    allowOrigin = requestOrigin
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
