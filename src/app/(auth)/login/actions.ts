/**
 * Login Server Action
 *
 * Handles user authentication using Supabase Auth signInWithPassword.
 * On success, redirects to /dashboard.
 */
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * State returned by the login action
 */
export interface LoginState {
  error: string
}

/**
 * Zod schema for login validation
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * Login server action
 *
 * Flow:
 * 1. Validate input with zod
 * 2. Authenticate with Supabase Auth signInWithPassword
 * 3. Redirect to /dashboard on success
 * 4. Return error message on failure
 */
export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Extract form data
  const rawFormData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  // Validate input
  const validatedFields = loginSchema.safeParse(rawFormData)

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors
    const firstError = errors.email?.[0] || errors.password?.[0] || 'Invalid input'
    return { error: firstError }
  }

  const { email, password } = validatedFields.data

  const supabase = await createClient()

  // Authenticate with Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Return user-friendly error messages
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Invalid email or password' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Please verify your email before signing in' }
    }
    return { error: error.message }
  }

  // Success - redirect to dashboard
  redirect('/dashboard')
}
