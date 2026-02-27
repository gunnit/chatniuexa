'use client'

import { logout } from '@/lib/actions/logout'
import { useTranslations } from 'next-intl'

export function LogoutButton() {
  const t = useTranslations('nav')

  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:text-slate-900 hover:bg-slate-100/80 transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {t('logout')}
      </button>
    </form>
  )
}
