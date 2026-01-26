/**
 * Supabase Middleware Session Refresh
 *
 * This helper function refreshes the user's session by validating the JWT
 * and updating cookies as needed. It should be called from the root middleware.
 *
 * CRITICAL: Uses getUser() instead of getSession() to validate the JWT
 * with Supabase Auth servers. getSession() only checks JWT format/expiry
 * and doesn't protect against spoofed tokens.
 *
 * Usage in middleware.ts:
 * ```ts
 * import { type NextRequest } from 'next/server'
 * import { updateSession } from '@/lib/supabase/middleware'
 *
 * export async function middleware(request: NextRequest) {
 *   return await updateSession(request)
 * }
 *
 * export const config = {
 *   matcher: [
 *     '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
 *   ],
 * }
 * ```
 *
 * Source: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  // Create a response that we can modify
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookies on both the request and response
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // CRITICAL: Use getUser() not getSession()
  // getUser() validates the JWT with Supabase Auth servers
  // getSession() only checks JWT format/expiry and can be spoofed
  await supabase.auth.getUser()

  return response
}
