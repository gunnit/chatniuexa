'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900 mb-3">Something went wrong</h1>
      <p className="text-slate-600 mb-6">
        We couldn&apos;t load this page. Please try again, or refresh if the problem persists.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
