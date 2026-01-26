/**
 * Logout Button Component
 *
 * Client component that provides logout functionality.
 * Uses form action to call the logout server action.
 */
'use client'

import { logout } from '@/app/(auth)/logout/actions'

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Sign out
      </button>
    </form>
  )
}
