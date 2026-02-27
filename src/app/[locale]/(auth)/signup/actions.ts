/**
 * Signup Server Action
 *
 * Handles user registration with tenant creation and profile linking.
 * Uses Prisma for database operations and bcrypt for password hashing.
 * Implements full rollback on failure.
 */
'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

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
 * Signup server action
 *
 * Flow:
 * 1. Validate input with zod
 * 2. Check if email already exists
 * 3. Create tenant, user, and profile in a transaction
 * 4. Redirect to login page on success
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

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: 'An account with this email already exists.' }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  try {
    // Create tenant, user, and profile in a transaction
    await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: `${fullName}'s Organization`,
        },
      })

      // Create user with hashed password
      const user = await tx.user.create({
        data: {
          email,
          name: fullName,
          password: hashedPassword,
        },
      })

      // Create profile linking user to tenant
      await tx.profile.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          fullName,
        },
      })

      // Create usage limits for the new tenant
      await tx.usageLimit.create({
        data: { tenantId: tenant.id },
      })
    })
  } catch (error) {
    logger.error('Signup transaction failed', { error: String(error) })
    return { error: 'Failed to create account. Please try again.' }
  }

  // Send welcome email (don't block on failure)
  try {
    await sendWelcomeEmail(email, fullName)
  } catch {
    // Swallow — email failure shouldn't block signup
  }

  // Success - redirect to login page (no email verification for now)
  redirect('/login?registered=true')
}
