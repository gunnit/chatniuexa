/**
 * Root Middleware - Session Refresh
 *
 * This middleware runs on every page navigation and API call (except static assets).
 * It calls updateSession which:
 * 1. Validates the JWT with Supabase Auth servers (using getUser())
 * 2. Refreshes tokens if needed
 * 3. Sets updated cookies on the response
 *
 * CRITICAL: The updateSession function uses getUser() internally (not getSession)
 * to validate the JWT with Supabase Auth servers. This is the secure pattern.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static image files (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
