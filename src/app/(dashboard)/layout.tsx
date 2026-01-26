/**
 * Dashboard Layout
 *
 * Layout wrapper for all dashboard pages.
 * Provides consistent structure for protected routes.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your dashboard',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <main>{children}</main>
    </div>
  )
}
