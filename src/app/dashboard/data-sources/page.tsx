'use client'

import { useEffect, useState } from 'react'
import SiteCrawlerModal from '@/components/SiteCrawlerModal'

interface DataSource {
  id: string
  type: 'FILE' | 'URL'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED'
  name: string
  fileName?: string
  fileType?: string
  fileSize?: number
  sourceUrl?: string
  error?: string
  lastSyncAt?: string
  createdAt: string
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [crawlerModalOpen, setCrawlerModalOpen] = useState(false)

  const fetchDataSources = async () => {
    try {
      const res = await fetch('/api/data-sources')
      if (!res.ok) throw new Error('Failed to fetch data sources')
      const data = await res.json()
      if (data.dataSources) {
        setDataSources(data.dataSources)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data sources')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDataSources()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/data-sources/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      await fetchDataSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setAddingUrl(true)
    setError(null)

    try {
      const res = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add URL')
      }

      setUrlInput('')
      await fetchDataSources()

      if (data.dataSource?.id) {
        // Trigger processing in background with error handling
        fetch(`/api/data-sources/${data.dataSource.id}/process`, {
          method: 'POST',
        })
          .then((res) => {
            if (!res.ok) throw new Error('Processing failed')
            return fetchDataSources()
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Processing failed')
            fetchDataSources() // Refresh to show current status
          })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add URL')
    } finally {
      setAddingUrl(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this data source?')) return

    try {
      const res = await fetch(`/api/data-sources/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      await fetchDataSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleResync = async (id: string) => {
    try {
      const res = await fetch(`/api/data-sources/${id}/resync`, {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to resync')
      }

      await fetchDataSources()

      // Trigger re-processing in background with error handling
      fetch(`/api/data-sources/${id}/process`, {
        method: 'POST',
      })
        .then((res) => {
          if (!res.ok) throw new Error('Re-processing failed')
          return fetchDataSources()
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Re-processing failed')
          fetchDataSources() // Refresh to show current status
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resync')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusBadge = (status: DataSource['status']) => {
    const config = {
      PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
      PROCESSING: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500 animate-pulse' },
      COMPLETE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    }
    const { bg, text, dot } = config[status]
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
        <p className="text-slate-500 mt-1">Upload files or add URLs to train your chatbots</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Add Data Source Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* File Upload */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Upload File</h2>
              <p className="text-sm text-slate-500">PDF, DOCX, DOC, TXT (max 10MB)</p>
            </div>
          </div>
          <label className="block">
            <div className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${uploading ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'}`}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {uploading ? (
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-indigo-500 mb-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm text-slate-600">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">Click to upload</span>
                  <span className="text-xs text-slate-500 mt-1">or drag and drop</span>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* URL Input */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Add URL</h2>
              <p className="text-sm text-slate-500">Crawl and index a webpage</p>
            </div>
          </div>
          <form onSubmit={handleAddUrl} className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/page"
              disabled={addingUrl}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={addingUrl || !urlInput.trim()}
              className="w-full px-4 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {addingUrl ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding...
                </span>
              ) : (
                'Add URL'
              )}
            </button>
          </form>
        </div>

        {/* Crawl Site */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Crawl Website</h2>
              <p className="text-sm text-slate-500">Import multiple pages at once</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Discover and import up to 100 pages from any website into your knowledge base.
            </p>
            <button
              onClick={() => setCrawlerModalOpen(true)}
              className="w-full px-4 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Discover Pages
            </button>
          </div>
        </div>
      </div>

      {/* Data Sources Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/60">
          <h2 className="font-semibold text-slate-900">Your Data Sources</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Added</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded animate-pulse w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-12" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full animate-pulse w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : dataSources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                      </div>
                      <p className="text-slate-500">No data sources yet</p>
                      <p className="text-sm text-slate-400 mt-1">Upload a file or add a URL to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dataSources.map((ds) => (
                  <tr key={ds.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ds.type === 'FILE' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                          {ds.type === 'FILE' ? (
                            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{ds.name}</div>
                          {ds.error && <div className="text-xs text-red-500 mt-0.5">{ds.error}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{ds.type}</td>
                    <td className="px-6 py-4">{getStatusBadge(ds.status)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatFileSize(ds.fileSize)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(ds.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {ds.type === 'URL' && (
                          <button
                            onClick={() => handleResync(ds.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Re-sync"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(ds.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Site Crawler Modal */}
      <SiteCrawlerModal
        isOpen={crawlerModalOpen}
        onClose={() => setCrawlerModalOpen(false)}
        onImportComplete={fetchDataSources}
      />
    </div>
  )
}
