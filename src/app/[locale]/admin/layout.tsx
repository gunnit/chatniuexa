/**
 * Admin Layout
 *
 * Separate layout for admin panel with its own navigation.
 * Only accessible to users with role === 'admin'.
 */
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { LogoutButton } from '@/components/LogoutButton'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { AdminNavLinks } from '@/components/AdminNavLinks'
import { verifyAdminSession } from '@/lib/dal/auth'
import { getTranslations } from 'next-intl/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await verifyAdminSession()
  const t = await getTranslations('admin')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Logo */}
              <Link href="/admin" className="flex-shrink-0 flex items-center gap-2">
                <Image src="/images/logo.png" alt="ChatAziendale.it logo" width={36} height={36} />
                <span className="text-xl font-bold tracking-tight text-white">
                  Admin<span className="text-amber-400">Panel</span>
                </span>
              </Link>

              <AdminNavLinks />
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {t('backToDashboard')}
              </Link>
              <LanguageSwitcher />
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-12">{children}</main>
    </div>
  )
}
