import { auth } from '@/lib/auth'
import { Link } from '@/i18n/navigation'

/**
 * Server component that renders an admin panel link
 * only if the current user has the admin role.
 */
export async function AdminLink() {
  const session = await auth()

  if (session?.user?.role !== 'admin') {
    return null
  }

  return (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      Admin
    </Link>
  )
}
