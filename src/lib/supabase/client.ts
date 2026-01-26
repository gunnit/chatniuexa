/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for use in Client Components (browser).
 * This client uses the anon key and handles authentication via cookies.
 *
 * Usage:
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 *
 * const supabase = createClient()
 * const { data } = await supabase.auth.getUser()
 * ```
 *
 * Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
