'use client'

import { useEffect, useState, useRef } from 'react'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('nav')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileOpen])

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
          <span className="hidden sm:inline text-xl font-bold text-[#18181B] tracking-tight">
            ChatAziendale<span className="text-teal-600">.it</span>
          </span>
          <span className="sm:hidden text-lg font-bold text-[#18181B] tracking-tight">
            ChatA<span className="text-teal-600">.it</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors duration-200"
          >
            {t('login')}
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-lg hover:bg-[#0D6960] transition-colors duration-200"
          >
            {t('getStarted')}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="sm:hidden relative" ref={menuRef}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            className="p-2 text-[#52525B] hover:text-[#18181B] transition-colors"
          >
            {mobileOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          {mobileOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-[#E4E4E7] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B] transition-colors"
              >
                {t('login')}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-[#0F766E] hover:bg-[#F4F4F5] transition-colors"
              >
                {t('getStarted')}
              </Link>
              <div className="border-t border-[#E4E4E7] mt-1 pt-1 px-4 py-2">
                <LanguageSwitcher />
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
