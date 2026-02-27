'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export default function BillingSuccessPage() {
  const t = useTranslations('billing')

  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t('activating')}</h1>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}

function SuccessContent() {
  const t = useTranslations('billing')
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const plan = searchParams.get('plan') || 'pro'
  const subscriptionId = searchParams.get('subscription_id')

  useEffect(() => {
    if (!subscriptionId) {
      setStatus('success')
      return
    }

    let attempts = 0
    const maxAttempts = 10

    const tryActivate = async () => {
      attempts++
      try {
        const res = await fetch('/api/billing/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.activated) {
            setStatus('success')
            return
          }
        }
      } catch {
        // ignore and retry
      }

      if (attempts < maxAttempts) {
        setTimeout(tryActivate, 2000)
      } else {
        setError(t('errorHint'))
        setStatus('error')
      }
    }

    setTimeout(tryActivate, 2000)

    return () => { attempts = maxAttempts }
  }, [subscriptionId])

  if (status === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t('activating')}</h1>
          <p className="text-slate-500">{t('activatingHint')}</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t('errorTitle')}</h1>
          <p className="text-slate-500 mb-6">{error || t('errorHint')}</p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:opacity-90 transition-opacity"
          >
            {t('backToBilling')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{t('successTitle')}</h1>
        <p className="text-slate-500 mb-2">
          {t('successWelcome', { plan })}
        </p>
        <p className="text-sm text-slate-400 mb-6">
          {t('successHint')}
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            {t('viewBilling')}
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:opacity-90 transition-opacity"
          >
            {t('goToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}
