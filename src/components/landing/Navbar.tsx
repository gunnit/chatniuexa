'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#030014]/70 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.3)]'
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
            className="drop-shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0 sm:w-8 sm:h-8"
          />
          <span className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
            ChatAziendale<span className="text-indigo-400">.it</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex px-5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="group relative px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative">Get Started</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
