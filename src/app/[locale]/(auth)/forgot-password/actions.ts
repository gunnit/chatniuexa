'use server'

import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import crypto from 'crypto'

export interface ForgotPasswordState {
  error: string
  success: boolean
}

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function forgotPassword(
  prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.email?.[0] || 'Invalid input', success: false }
  }

  const { email } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Always show success to prevent email enumeration
    if (!user) {
      return { error: '', success: true }
    }

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

    // Create new token with 1hr expiry
    const token = crypto.randomUUID()
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://chataziendale.onrender.com'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(email, user.name || 'there', resetUrl)

    logger.info('Password reset requested', { userId: user.id })
  } catch (error) {
    logger.error('Forgot password error', { error: String(error) })
    return { error: 'Something went wrong. Please try again.', success: false }
  }

  return { error: '', success: true }
}
