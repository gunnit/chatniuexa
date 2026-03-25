'use client'

import { Suspense, useState } from 'react'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { login } from './actions'
import { AnimatedBackground } from '@/components/AnimatedBackground'

const initialState = {
  error: '',
}

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get('registered') === 'true'
  const t = useTranslations('auth')
  const tc = useTranslations('common')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative min-h-screen flex">
      <AnimatedBackground />

      {/* Back to Home */}
      <Link
        href="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </span>
        <span className="hidden sm:inline">{tc('back')}</span>
      </Link>

      {/* Left Panel — Brand showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12">
        <div />

        <div className="max-w-md mx-auto space-y-8" style={{ animationDelay: '100ms' }}>
          <div className="animate-slide-up">
            <Link href="/" className="inline-flex items-center gap-3 mb-8">
              <Image src="/images/logo.png" alt="ChatAziendale.it logo" width={48} height={48} className="drop-shadow-lg" />
              <span className="text-2xl font-bold text-white tracking-tight">
                ChatAziendale<span className="text-teal-400">.it</span>
              </span>
            </Link>

            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              {t('welcomeBack')}
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              {t('signInSubtitle')}
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            {[
              { icon: '⚡', text: 'AI-powered chatbots for your business' },
              { icon: '🔒', text: 'Enterprise-grade security & privacy' },
              { icon: '🌍', text: 'Multi-language support built in' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-lg">
                  {feature.icon}
                </span>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom decorative element */}
        <div className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} ChatAziendale.it
        </div>
      </div>

      {/* Right Panel — Login form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[420px] animate-scale-in">

          {/* Mobile logo (hidden on desktop) */}
          <div className="text-center mb-8 lg:hidden">
            <Link href="/" className="inline-flex flex-col items-center gap-3">
              <Image src="/images/logo.png" alt="ChatAziendale.it logo" width={56} height={56} className="drop-shadow-lg" />
              <span className="text-3xl font-bold text-white tracking-tight">
                ChatAziendale<span className="text-teal-400">.it</span>
              </span>
            </Link>
          </div>

          {/* Card */}
          <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 sm:p-10 shadow-[0_8px_64px_rgba(0,0,0,0.4)]">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">{t('welcomeBack')}</h1>
              <p className="text-slate-400 text-sm">{t('signInSubtitle')}</p>
            </div>

            <form action={formAction} className="space-y-5">
              {justRegistered && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-slide-up">
                  <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-emerald-300">{t('registeredSuccess')}</p>
                </div>
              )}

              {state.error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-slide-up">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-300">{state.error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    {t('emailLabel')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 focus:bg-white/[0.07] transition-all"
                      placeholder={t('emailPlaceholder')}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                      {t('passwordLabel')}
                    </label>
                    <Link href="/forgot-password" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
                      {t('forgotPassword')}
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 focus:bg-white/[0.07] transition-all"
                      placeholder={t('passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M15 12a3 3 0 01-3 3m0 0l6.878 6.878M21 21L3 3" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="w-full relative py-3.5 px-6 text-base font-semibold text-white rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600" />
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]" />
                <span className="relative flex items-center justify-center gap-2">
                  {pending ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('signingIn')}
                    </>
                  ) : (
                    <>
                      {t('signIn')}
                      <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-slate-400 text-sm">
                {t('noAccount')}{' '}
                <Link href="/signup" className="font-semibold text-teal-400 hover:text-teal-300 transition-colors">
                  {t('createOne')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const tc = useTranslations('common')

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {tc('loading')}
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
