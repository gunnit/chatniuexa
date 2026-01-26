/**
 * Logout Server Action
 *
 * Handles user logout using Supabase Auth signOut.
 * On success, redirects to /login.
 */
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Logout server action
 *
 * Flow:
 * 1. Sign out user from Supabase Auth
 * 2. Redirect to /login page
 */
export async function logout(): Promise<never> {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}
