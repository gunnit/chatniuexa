'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

export default function SettingsPage() {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')

    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete account')
        setDeleting(false)
        return
      }
      await signOut({ callbackUrl: '/' })
    } catch {
      setError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-2xl overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-200">
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            This will permanently delete all your data including chatbots, data sources, conversations, and analytics. This action cannot be undone.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-700">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete everything'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
