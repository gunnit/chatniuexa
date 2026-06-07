'use client'

import { useEffect, useState } from 'react'

interface Lead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  note: string | null
  source: string
  createdAt: string
  chatbot: { name: string } | null
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load leads'))))
      .then((d) => setLeads(d.leads || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">
          Contact details captured by your bots — including hands-free voice captures from the realtime voice widget.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <div className="text-slate-700 font-medium">No leads yet</div>
          <p className="text-sm text-slate-500 mt-1">
            When a visitor leaves their details (by voice or chat), they’ll appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Bot</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{l.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.email ? <a className="text-teal-600 hover:underline" href={`mailto:${l.email}`}>{l.email}</a> : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={l.note || ''}>{l.note || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{l.chatbot?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {l.source === 'voice' ? '🎙 Voice' : l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
