/**
 * Data Access Layer - Authentication
 *
 * Provides cached session verification and user lookup for Server Components
 * and Server Actions. The cache() wrapper ensures these functions are only
 * called once per request, even if multiple components call them.
 *
 * IMPORTANT:
 * - verifySession: Redirects to /login if not authenticated. Use in protected pages.
 * - getUser: Returns user or null without redirect. Use for optional auth checks.
 *
 * Both functions use getUser() (not getSession()) for secure JWT validation
 * with Supabase Auth servers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns#data-access-layer
 */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Session data returned by verifySession
 */
export interface SessionData {
  isAuth: true
  userId: string
  email: string | undefined
  tenantId: string | null
}

/**
 * Verify user session and redirect to login if not authenticated.
 *
 * Uses cache() to ensure only one database call per request, even if
 * multiple components call verifySession().
 *
 * @returns SessionData with userId, email, and tenantId
 * @throws redirect to /login if not authenticated
 *
 * @example
 * ```tsx
 * // In a protected Server Component
 * export default async function DashboardPage() {
 *   const session = await verifySession()
 *   // User is guaranteed to be authenticated here
 *   return <div>Welcome, {session.email}</div>
 * }
 * ```
 */
export const verifySession = cache(async (): Promise<SessionData> => {
  const supabase = await createClient()

  // CRITICAL: Use getUser() not getSession() for server-side validation
  // getUser() validates the JWT with Supabase Auth servers
  // getSession() only checks JWT format/expiry and can be spoofed
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Get tenant_id from profile
  // The profile is created automatically via database trigger when user signs up
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single<{ tenant_id: string }>()

  // profile may be null if database trigger hasn't run yet
  const tenantId = profile?.tenant_id ?? null

  return {
    isAuth: true,
    userId: user.id,
    email: user.email,
    tenantId,
  }
})

/**
 * Get current user without redirect.
 *
 * Uses cache() to ensure only one database call per request, even if
 * multiple components call getUser().
 *
 * @returns User object if authenticated, null otherwise
 *
 * @example
 * ```tsx
 * // In a Server Component with optional auth
 * export default async function Header() {
 *   const user = await getUser()
 *   return user ? <LogoutButton /> : <LoginButton />
 * }
 * ```
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
