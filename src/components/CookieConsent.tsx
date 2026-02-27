'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const t = useTranslations('cookies')

  useEffect(() => {
    if (!localStorage.getItem('cookie-consent')) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const accept = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('cookie-consent', 'declined')
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-xl mx-auto bg-white border border-[#E4E4E7] rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-[#52525B] flex-1">
          {t('message')}{' '}
          <a href="/privacy" className="text-teal-600 hover:text-teal-700 underline">{t('privacyPolicy')}</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm font-medium text-[#71717A] hover:text-[#18181B] rounded-lg transition-colors"
          >
            {t('decline')}
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0F766E] hover:bg-[#0D6960] rounded-lg transition-colors"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
