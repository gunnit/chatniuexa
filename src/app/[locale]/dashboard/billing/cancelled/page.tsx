'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export default function BillingCancelledPage() {
  const t = useTranslations('billing')

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{t('cancelledTitle')}</h1>
        <p className="text-slate-500 mb-6">
          {t('cancelledHint')}
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl hover:opacity-90 transition-opacity"
        >
          {t('backToBilling')}
        </Link>
      </div>
    </div>
  )
}
