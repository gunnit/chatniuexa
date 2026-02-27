'use server'

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export interface ResetPasswordState {
  error: string
  success: boolean
}

const schema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function resetPassword(
  prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    return { error: errors.token?.[0] || errors.password?.[0] || 'Invalid input', success: false }
  }

  const { token, password } = parsed.data

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return { error: 'Invalid or expired reset link. Please request a new one.', success: false }
    }

    if (resetToken.expires < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return { error: 'This reset link has expired. Please request a new one.', success: false }
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
    ])

    logger.info('Password reset successful', { userId: resetToken.userId })
    return { error: '', success: true }
  } catch (error) {
    logger.error('Reset password error', { error: String(error) })
    return { error: 'Something went wrong. Please try again.', success: false }
  }
}
