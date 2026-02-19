'use client'

import { Suspense } from 'react'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { resetPassword } from './actions'
import { AnimatedBackground } from '@/components/AnimatedBackground'

const initialState = { error: '', success: false }

function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, initialState)
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  if (!token) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl text-center">
            <p className="text-red-300 mb-4">Invalid reset link. No token provided.</p>
            <Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    )
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
        Back to Login
      </Link>

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <Image src="/images/logo.png" alt="ChatAziendale.it logo" width={56} height={56} className="drop-shadow-lg" />
            <span className="text-3xl font-bold text-white tracking-tight">
              ChatAziendale<span className="text-indigo-400">.it</span>
            </span>
          </Link>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
            <p className="text-slate-400">Choose a strong password for your account.</p>
          </div>

          {state.success ? (
            <div className="text-center">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-emerald-300">Password reset successfully!</p>
              </div>
              <Link
                href="/login"
                className="inline-block px-6 py-3 text-sm font-semibold text-white rounded-xl bg-indigo-500 hover:bg-indigo-600 transition-colors"
              >
                Sign in with new password
              </Link>
            </div>
          ) : (
            <form action={formAction} className="space-y-5">
              <input type="hidden" name="token" value={token} />

              {state.error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-300">{state.error}</p>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  placeholder="At least 8 characters"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full relative py-3.5 px-6 text-base font-semibold text-white rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center justify-center gap-2">
                  {pending ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
