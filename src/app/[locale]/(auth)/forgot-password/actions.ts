'use server'

import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { rateLimitCustom } from '@/lib/rate-limit'
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

  // Rate-limit by both IP and email so a single IP can't grind every email,
  // and a single victim email can't be flooded from many IPs.
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipLimit = rateLimitCustom('forgotPwIp', ip, 5, 60 * 60) // 5 per hour per IP
  const emailLimit = rateLimitCustom('forgotPwEmail', email.toLowerCase(), 3, 60 * 60) // 3 per hour per email
  if (!ipLimit.allowed || !emailLimit.allowed) {
    // Show success regardless to avoid signaling whether the email exists.
    return { error: '', success: true }
  }

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://chataziendale.it'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(email, user.name || 'there', resetUrl)

    logger.info('Password reset requested', { userId: user.id })
  } catch (error) {
    logger.error('Forgot password error', { error: String(error) })
    return { error: 'Something went wrong. Please try again.', success: false }
  }

  return { error: '', success: true }
}
