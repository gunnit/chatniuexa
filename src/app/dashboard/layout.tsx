/**
 * Dashboard Layout
 *
 * Modern 2026 dashboard layout with glass-effect sidebar
 * and clean navigation.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { LogoutButton } from '@/components/LogoutButton'
import { DesktopNavLinks, MobileNavLinks } from '@/components/NavLinks'

export const metadata: Metadata = {
  title: 'Dashboard - niuexa.ai',
  description: 'Manage your AI chatbot',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5NDkzYjgiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50 -z-10" />

      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Logo */}
              <Link href="/dashboard" className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  niuexa<span className="text-indigo-600">.ai</span>
                </span>
              </Link>

              <DesktopNavLinks />
            </div>

            <div className="flex items-center gap-4">
              {/* Profile / Logout */}
              <LogoutButton />
            </div>
          </div>
        </div>

        <MobileNavLinks />
      </nav>

      {/* Main Content */}
      <main className="pb-12">{children}</main>
    </div>
  )
}
