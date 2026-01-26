/**
 * Supabase Server Client
 *
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. This client handles cookie-based authentication
 * with proper read/write support.
 *
 * The setAll() try/catch pattern handles Server Components where cookies
 * are read-only. In that case, the middleware will handle cookie writes.
 *
 * Usage:
 * ```tsx
 * // In a Server Component or Server Action
 * import { createClient } from '@/lib/supabase/server'
 *
 * const supabase = await createClient()
 * const { data: { user } } = await supabase.auth.getUser()
 * ```
 *
 * IMPORTANT: Always use getUser() on the server, never getSession().
 * getUser() validates the JWT with Supabase Auth servers.
 *
 * Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component - cookies are read-only.
            // The middleware will handle refreshing the session cookie.
          }
        },
      },
    }
  )
}
