'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const t = useTranslations('nav')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-[#E4E4E7] shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-12 h-16 sm:h-[72px]">
        <Link href="/" className="flex items-center gap-2 group min-w-0">
          <Image
            src="/images/logo.png"
            alt="ChatAziendale.it logo"
            width={28}
            height={28}
            className="group-hover:scale-105 transition-transform duration-300 flex-shrink-0 sm:w-8 sm:h-8"
          />
          <span className="text-lg sm:text-xl font-bold text-[#18181B] tracking-tight truncate">
            ChatAziendale<span className="text-teal-600">.it</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="hidden sm:inline-flex px-5 py-2 text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors duration-200"
          >
            {t('login')}
          </Link>
          <Link
            href="/signup"
            className="px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-lg hover:bg-[#0D6960] transition-colors duration-200"
          >
            {t('getStarted')}
          </Link>
        </div>
      </div>
    </nav>
  )
}
