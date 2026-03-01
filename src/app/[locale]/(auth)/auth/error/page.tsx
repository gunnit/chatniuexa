/**
 * Auth Error Page
 *
 * Displays error messages for failed authentication operations,
 * such as invalid or expired email confirmation links.
 */

import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { AnimatedBackground } from '@/components/AnimatedBackground'

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams
  const t = await getTranslations('auth')
  const tc = await getTranslations('common')

  // Determine user-friendly error message
  let errorMessage = t('authErrorDefault')

  if (error) {
    if (error === 'missing_params') {
      errorMessage = t('authErrorMissing')
    } else if (error.toLowerCase().includes('expired')) {
      errorMessage = t('authErrorExpired')
    } else if (error.toLowerCase().includes('invalid')) {
      errorMessage = t('authErrorInvalid')
    } else {
      errorMessage = error
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <AnimatedBackground />

      <Link
        href="/login"
        className="absolute top-6 left-6 z-10 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {tc('backToLogin')}
      </Link>

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <Image src="/images/logo.png" alt="ChatAziendale.it logo" width={56} height={56} className="drop-shadow-lg" />
            <span className="text-3xl font-bold text-white tracking-tight">
              ChatAziendale<span className="text-teal-400">.it</span>
            </span>
          </Link>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('authError')}</h1>
            <p className="text-slate-400">{errorMessage}</p>
          </div>

          <div className="space-y-3">
            <Link
              href="/signup"
              className="block w-full text-center py-3 px-6 text-sm font-semibold text-white rounded-xl bg-teal-600 hover:bg-teal-700 transition-colors"
            >
              {t('signUpLink')}
            </Link>
            <Link
              href="/login"
              className="block w-full text-center py-3 px-6 text-sm font-medium text-slate-300 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
            >
              {t('backToLoginLink')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
