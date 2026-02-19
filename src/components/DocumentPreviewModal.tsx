'use client'

import { useState, useEffect } from 'react'

interface DocumentData {
  id: string
  title: string | null
  content: string
  updatedAt: string
  chunkCount: number
}

interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  dataSourceId: string | null
  dataSourceName: string
  onContentUpdated: () => void
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  dataSourceId,
  dataSourceName,
  onContentUpdated,
}: DocumentPreviewModalProps) {
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && dataSourceId) {
      setLoading(true)
      setError(null)
      setEditing(false)
      setEditContent('')
      fetch(`/api/data-sources/${dataSourceId}/documents`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load content')
          return res.json()
        })
        .then((data) => {
          setDocuments(data.documents || [])
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load content')
        })
        .finally(() => setLoading(false))
    }
    if (!isOpen) {
      setDocuments([])
      setEditing(false)
      setEditContent('')
      setError(null)
    }
  }, [isOpen, dataSourceId])

  const handleStartEdit = () => {
    if (documents.length > 0) {
      setEditContent(documents[0].content)
      setEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditContent('')
  }

  const handleSave = async () => {
    if (!dataSourceId || documents.length === 0) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/data-sources/${dataSourceId}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: documents[0].id,
          content: editContent,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save')
      }

      setDocuments([
        {
          ...documents[0],
          content: editContent,
          chunkCount: data.document.chunkCount,
          updatedAt: data.document.updatedAt,
        },
      ])
      setEditing(false)
      setEditContent('')
      onContentUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const doc = documents[0]
  const displayContent = editing ? editContent : doc?.content || ''
  const charCount = displayContent.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 truncate max-w-md">{dataSourceName}</h2>
              <p className="text-sm text-slate-500">
                {loading
                  ? 'Loading...'
                  : doc
                    ? `${doc.chunkCount} chunks`
                    : 'No content'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-500 mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-slate-500">Loading extracted content...</p>
            </div>
          ) : !doc ? (
            <div className="flex flex-col items-center py-12">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-500">No extracted content found</p>
            </div>
          ) : editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              disabled={saving}
              className="w-full h-[50vh] px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none disabled:opacity-50"
            />
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[50vh] overflow-y-auto">
              <pre className="text-sm text-slate-800 font-mono leading-relaxed whitespace-pre-wrap break-words">
                {doc.content}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <div className="text-xs text-slate-400">
            {!loading && doc && (
              <>
                {charCount.toLocaleString()} characters
                {doc.updatedAt && (
                  <> &middot; Updated {new Date(doc.updatedAt).toLocaleDateString()}</>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {editing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || editContent.length === 0}
                  className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Re-processing...
                    </>
                  ) : (
                    'Save & Re-process'
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Close
                </button>
                {doc && (
                  <button
                    onClick={handleStartEdit}
                    className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Content
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
