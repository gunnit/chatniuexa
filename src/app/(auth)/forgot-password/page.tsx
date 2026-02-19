'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { forgotPassword } from './actions'
import { AnimatedBackground } from '@/components/AnimatedBackground'

const initialState = { error: '', success: false }

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState)

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
            <h1 className="text-2xl font-bold text-white mb-2">Forgot your password?</h1>
            <p className="text-slate-400">Enter your email and we&apos;ll send you a reset link.</p>
          </div>

          {state.success ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-emerald-300">If an account with that email exists, we&apos;ve sent a reset link. Check your inbox.</p>
            </div>
          ) : (
            <form action={formAction} className="space-y-5">
              {state.error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-300">{state.error}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  placeholder="you@example.com"
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
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
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
