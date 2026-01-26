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
 * Uses NextAuth auth() function for session validation.
 */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

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
 * Uses cache() to ensure only one auth check per request, even if
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
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return {
    isAuth: true,
    userId: session.user.id,
    email: session.user.email ?? undefined,
    tenantId: session.user.tenantId ?? null,
  }
})

/**
 * Get current user without redirect.
 *
 * Uses cache() to ensure only one auth check per request, even if
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
  const session = await auth()
  return session?.user ?? null
})
