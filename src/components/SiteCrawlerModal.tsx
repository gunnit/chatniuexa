'use client'

import { useState, useEffect } from 'react'

interface DiscoveredUrl {
  url: string
  title?: string
  description?: string
}

interface SiteCrawlerModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

export default function SiteCrawlerModal({ isOpen, onClose, onImportComplete }: SiteCrawlerModalProps) {
  const [siteUrl, setSiteUrl] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [importing, setImporting] = useState(false)
  const [discoveredUrls, setDiscoveredUrls] = useState<DiscoveredUrl[]>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'select'>('input')

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSiteUrl('')
      setDiscoveredUrls([])
      setSelectedUrls(new Set())
      setError(null)
      setStep('input')
    }
  }, [isOpen])

  const handleDiscover = async () => {
    if (!siteUrl.trim()) return

    setDiscovering(true)
    setError(null)

    try {
      const res = await fetch('/api/data-sources/crawl/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl, limit: 100 }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to discover pages')
      }

      setDiscoveredUrls(data.urls || [])
      // Select all URLs by default
      setSelectedUrls(new Set(data.urls?.map((u: DiscoveredUrl) => u.url) || []))
      setStep('select')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover pages')
    } finally {
      setDiscovering(false)
    }
  }

  const handleToggleUrl = (url: string) => {
    setSelectedUrls((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(url)) {
        newSet.delete(url)
      } else {
        newSet.add(url)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedUrls(new Set(discoveredUrls.map((u) => u.url)))
  }

  const handleDeselectAll = () => {
    setSelectedUrls(new Set())
  }

  const handleImport = async () => {
    if (selectedUrls.size === 0) return

    setImporting(true)
    setError(null)

    try {
      // Prepare URL data for import
      const urlsToImport = discoveredUrls
        .filter((u) => selectedUrls.has(u.url))
        .map((u) => ({ url: u.url, title: u.title }))

      // Create data sources
      const importRes = await fetch('/api/data-sources/crawl/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlsToImport }),
      })

      const importData = await importRes.json()

      if (!importRes.ok) {
        throw new Error(importData.error || 'Failed to import URLs')
      }

      // Trigger batch processing
      const dataSourceIds = importData.dataSources.map((ds: { id: string }) => ds.id)
      await fetch('/api/data-sources/process-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSourceIds }),
      })

      onImportComplete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import URLs')
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Crawl Website</h2>
              <p className="text-sm text-slate-500">
                {step === 'input' ? 'Enter a website URL to discover pages' : `${discoveredUrls.length} pages found`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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

          {step === 'input' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Website URL</label>
                <input
                  type="url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={discovering}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all disabled:opacity-50"
                  onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                />
              </div>
              <p className="text-sm text-slate-500">
                We&apos;ll discover up to 100 pages from this website that you can import into your knowledge base.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selection controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Deselect all
                  </button>
                </div>
                <span className="text-sm text-slate-500">
                  {selectedUrls.size} of {discoveredUrls.length} selected
                </span>
              </div>

              {/* URL list */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                  {discoveredUrls.map((item) => (
                    <label
                      key={item.url}
                      className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUrls.has(item.url)}
                        onChange={() => handleToggleUrl(item.url)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {item.title || item.url}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{item.url}</p>
                        {item.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          {step === 'select' && (
            <button
              onClick={() => setStep('input')}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Back
            </button>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            {step === 'input' ? (
              <button
                onClick={handleDiscover}
                disabled={discovering || !siteUrl.trim()}
                className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {discovering ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Discovering...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Discover Pages
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing || selectedUrls.size === 0}
                className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Import {selectedUrls.size} Pages
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
