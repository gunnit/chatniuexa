/**
 * Login Server Action
 *
 * Handles user authentication using NextAuth Credentials provider.
 * On success, redirects to /dashboard.
 */
'use server'

import { redirect } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'
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
 * 2. Authenticate with NextAuth signIn
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

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password' }
        default:
          return { error: 'Something went wrong. Please try again.' }
      }
    }
    throw error
  }

  // Success - redirect to dashboard
  redirect('/dashboard')
}
