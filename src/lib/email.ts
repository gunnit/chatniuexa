import { Resend } from 'resend'
import { logger } from '@/lib/logger'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM_EMAIL = 'niuexa.ai <noreply@niuexa.ai>'

export async function sendWelcomeEmail(to: string, name: string) {
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Welcome to niuexa.ai!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e293b;">Welcome, ${name}!</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Thanks for signing up for niuexa.ai. You're all set to create AI chatbots trained on your own data.
          </p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Get started by adding a data source and creating your first chatbot.
          </p>
          <a href="https://chatniuexa.onrender.com/dashboard"
             style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
            Go to Dashboard
          </a>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
            &mdash; The niuexa.ai Team
          </p>
        </div>
      `,
    })
    logger.info('Welcome email sent', { to })
  } catch (error) {
    logger.error('Failed to send welcome email', { to, error: String(error) })
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Reset your password - niuexa.ai',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e293b;">Reset your password</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.
          </p>
          <a href="${resetUrl}"
             style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
            Reset Password
          </a>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color: #94a3b8; font-size: 14px;">
            &mdash; The niuexa.ai Team
          </p>
        </div>
      `,
    })
    logger.info('Password reset email sent', { to })
  } catch (error) {
    logger.error('Failed to send password reset email', { to, error: String(error) })
  }
}

export async function sendBillingConfirmation(to: string, name: string, planName: string, price: number) {
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Subscription confirmed - ${planName} plan`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e293b;">Subscription Confirmed</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hi ${name}, your <strong>${planName}</strong> plan ($${price}/mo) is now active.
          </p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            You now have access to all ${planName} features. Enjoy!
          </p>
          <a href="https://chatniuexa.onrender.com/dashboard/billing"
             style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
            View Billing
          </a>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
            &mdash; The niuexa.ai Team
          </p>
        </div>
      `,
    })
    logger.info('Billing confirmation email sent', { to, planName })
  } catch (error) {
    logger.error('Failed to send billing confirmation email', { to, error: String(error) })
  }
}
