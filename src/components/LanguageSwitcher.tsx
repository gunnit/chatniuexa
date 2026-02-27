'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTransition } from 'react'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const nextLocale = locale === 'en' ? 'it' : 'en'

  function switchLocale() {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  return (
    <button
      onClick={switchLocale}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-current/20 hover:bg-current/5 transition-all disabled:opacity-50"
      title={nextLocale === 'it' ? 'Passa all\'italiano' : 'Switch to English'}
    >
      <span className="text-base leading-none">{locale === 'en' ? '🇬🇧' : '🇮🇹'}</span>
      <span>{locale.toUpperCase()}</span>
    </button>
  )
}
