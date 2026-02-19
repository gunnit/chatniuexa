'use client'

import { useState, useEffect } from 'react'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

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
      <div className="max-w-xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-slate-300 flex-1">
          We use cookies to improve your experience. By continuing, you agree to our{' '}
          <a href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">privacy policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
