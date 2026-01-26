/**
 * Logout Server Action
 *
 * Handles user logout using NextAuth signOut.
 * On success, redirects to /login.
 */
'use server'

import { signOut } from '@/lib/auth'

/**
 * Logout server action
 *
 * Flow:
 * 1. Sign out user from NextAuth
 * 2. Redirect to /login page
 */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
