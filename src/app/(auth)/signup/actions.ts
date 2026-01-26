/**
 * Signup Server Action
 *
 * Handles user registration with tenant creation and profile linking.
 * Implements full rollback on failure: if profile creation fails,
 * both tenant and auth user are deleted.
 *
 * IMPORTANT: Requires SUPABASE_SERVICE_ROLE_KEY for admin operations.
 */
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import type { Database } from '@/types/database'

/**
 * State returned by the signup action
 */
export interface SignupState {
  error: string
}

/**
 * Zod schema for signup validation
 */
const signupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name is too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * Create an admin Supabase client with service role key
 * Used for operations that need elevated privileges (like deleting users)
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or service role key')
  }

  return createServerClient<Database>(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // No cookies needed for admin client
      },
    },
  })
}

/**
 * Signup server action
 *
 * Flow:
 * 1. Validate input with zod
 * 2. Create tenant for the new user
 * 3. Create auth user with Supabase Auth
 * 4. If auth fails, rollback tenant
 * 5. Create profile linking user to tenant
 * 6. If profile fails, rollback tenant AND delete auth user
 * 7. Redirect to check-email page on success
 */
export async function signup(
  prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  // Extract form data
  const rawFormData = {
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  }

  // Validate input
  const validatedFields = signupSchema.safeParse(rawFormData)

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors
    const firstError =
      errors.fullName?.[0] || errors.email?.[0] || errors.password?.[0] || 'Invalid input'
    return { error: firstError }
  }

  const { fullName, email, password } = validatedFields.data

  const supabase = await createClient()

  // Step 1: Create tenant
  // We create the tenant first because the profile needs tenant_id
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: `${fullName}'s Organization` })
    .select()
    .single()

  if (tenantError || !tenant) {
    console.error('Failed to create tenant:', tenantError)
    return { error: 'Failed to create organization. Please try again.' }
  }

  // Step 2: Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        tenant_id: tenant.id,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/auth/confirm`,
    },
  })

  if (authError || !authData.user) {
    // Rollback: Delete the tenant we just created
    console.error('Auth signup failed, rolling back tenant:', authError)
    await supabase.from('tenants').delete().eq('id', tenant.id)
    return { error: authError?.message || 'Failed to create account. Please try again.' }
  }

  // Step 3: Create profile linking user to tenant
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    tenant_id: tenant.id,
    full_name: fullName,
  })

  if (profileError) {
    // CRITICAL: Full rollback - delete tenant AND auth user
    console.error('Profile creation failed, rolling back:', profileError)

    // Delete tenant
    await supabase.from('tenants').delete().eq('id', tenant.id)

    // Delete auth user using admin client
    try {
      const adminClient = createAdminClient()
      await adminClient.auth.admin.deleteUser(authData.user.id)
    } catch (adminError) {
      console.error('Failed to delete auth user during rollback:', adminError)
      // We still return an error to the user, but the orphaned auth user
      // may need manual cleanup
    }

    return { error: 'Failed to complete registration. Please try again.' }
  }

  // Success - redirect to check-email page
  redirect('/signup/check-email')
}
