'use client'

import { Link } from '@/i18n/navigation'
import { usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

const navItems = [
  {
    key: 'navDashboard',
    href: '/admin',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    key: 'navUsers',
    href: '/admin/users',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
]

export function AdminNavLinks() {
  const pathname = usePathname()
  const t = useTranslations('admin')

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="hidden sm:ml-10 sm:flex sm:space-x-1">
      {navItems.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`group flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              active
                ? 'text-amber-300 bg-amber-500/10'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <span className={`transition-colors ${active ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-400'}`}>
              {item.icon}
            </span>
            {t(item.key)}
          </Link>
        )
      })}
    </div>
  )
}
