'use client'

import { useEffect, useState } from 'react'

interface McpServer {
  id: string
  label: string
  serverUrl: string
  description: string | null
  hasAuthToken: boolean
  allowedTools: string[]
  enabled: boolean
}

interface DiscoveredTool {
  name: string
  description?: string
}

interface Props {
  chatbotId: string
}

/**
 * Config UI for remote MCP servers attached to a chatbot. Discovery → allowlist →
 * save mirrors the security model: the tenant explicitly picks which of a
 * server's tools the bot may call (config-time approval), and only those run.
 */
export default function McpServersManager({ chatbotId }: Props) {
  const [servers, setServers] = useState<McpServer[]>([])
  const [enabledOnPlan, setEnabledOnPlan] = useState(false)
  const [maxServers, setMaxServers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add-server form
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [description, setDescription] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredTool[] | null>(null)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [adding, setAdding] = useState(false)

  const base = `/api/chatbots/${chatbotId}/mcp-servers`

  useEffect(() => {
    fetch(base)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setServers(data.servers || [])
          setEnabledOnPlan(!!data.limits?.mcpServersEnabled)
          setMaxServers(data.limits?.maxMcpServers ?? 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId])

  const resetForm = () => {
    setLabel('')
    setServerUrl('')
    setDescription('')
    setAuthToken('')
    setDiscovered(null)
    setSelectedTools([])
    setError(null)
  }

  const handleDiscover = async () => {
    setDiscovering(true)
    setError(null)
    setDiscovered(null)
    try {
      const res = await fetch(`${base}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, authToken: authToken || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Discovery failed')
      setDiscovered(data.tools || [])
      // Pre-select nothing — the tenant opts in explicitly.
      setSelectedTools([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const toggleTool = (name: string) => {
    setSelectedTools((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]))
  }

  const handleAdd = async () => {
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          serverUrl,
          description: description || undefined,
          authToken: authToken || undefined,
          allowedTools: selectedTools,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add server')
      setServers((prev) => [...prev, data.server])
      setShowForm(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server')
    } finally {
      setAdding(false)
    }
  }

  const handleToggleEnabled = async (server: McpServer) => {
    const res = await fetch(`${base}/${server.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !server.enabled }),
    })
    if (res.ok) {
      const data = await res.json()
      setServers((prev) => prev.map((s) => (s.id === server.id ? data.server : s)))
    }
  }

  const handleDelete = async (server: McpServer) => {
    const res = await fetch(`${base}/${server.id}`, { method: 'DELETE' })
    if (res.ok) setServers((prev) => prev.filter((s) => s.id !== server.id))
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading MCP servers…</div>
  }

  if (!enabledOnPlan) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="font-medium text-slate-800">Remote MCP servers</div>
        <p className="mt-1">
          Connect your bot to remote{' '}
          <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">
            MCP servers
          </a>{' '}
          to give it read-only access to live tools and data. Available on the <strong>Business</strong> plan.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="mcp-manager">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-800">Remote MCP servers</div>
          <div className="text-xs text-slate-500">
            {servers.length}/{maxServers} configured · read-only tools you explicitly allow
          </div>
        </div>
        {servers.length < maxServers && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-3 py-2 rounded-xl bg-teal-50 text-teal-600 text-sm font-medium hover:bg-teal-100 transition-colors"
          >
            + Add server
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {servers.map((server) => (
        <div key={server.id} className="rounded-xl border border-slate-200 p-4" data-testid="mcp-server-row">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 truncate">{server.label}</div>
              <div className="text-xs text-slate-500 truncate">{server.serverUrl}</div>
              {server.description && <div className="text-xs text-slate-500 mt-1">{server.description}</div>}
              <div className="text-xs text-slate-500 mt-1">
                Allowed tools: {server.allowedTools.length > 0 ? server.allowedTools.join(', ') : <span className="text-amber-600">none (bot cannot call this server)</span>}
                {server.hasAuthToken && ' · 🔒 authenticated'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggleEnabled(server)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${server.enabled ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'}`}
              >
                {server.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <button onClick={() => handleDelete(server)} className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50">
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3" data-testid="mcp-add-form">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="my_tools"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Server URL (https)</label>
              <input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://example.com/mcp"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this server is for"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Auth token (optional, Bearer)</label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="stored encrypted; never shown again"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscover}
              disabled={!serverUrl || discovering}
              className="px-3 py-2 rounded-lg bg-white border border-teal-300 text-teal-600 text-sm font-medium hover:bg-teal-50 disabled:opacity-50"
            >
              {discovering ? 'Connecting…' : 'Discover tools'}
            </button>
            <span className="text-xs text-slate-500">Pick which read-only tools the bot may call.</span>
          </div>

          {discovered && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 max-h-60 overflow-auto">
              {discovered.length === 0 && <div className="text-sm text-slate-500">No tools reported by this server.</div>}
              {discovered.map((tool) => (
                <label key={tool.name} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                    className="mt-0.5 w-4 h-4 rounded text-teal-600"
                  />
                  <span>
                    <span className="font-medium text-slate-700">{tool.name}</span>
                    {tool.description && <span className="text-slate-500"> — {tool.description}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!label || !serverUrl || adding}
              className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add server'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
