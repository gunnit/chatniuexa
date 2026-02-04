'use client'

import { useEffect, useState, useCallback } from 'react'

interface UsageStats {
  limits: {
    monthlyTokenLimit: number
    dailyMessageLimit: number
    monthlyCostLimit: number
  }
  usage: {
    currentMonthTokens: number
    currentMonthCost: number
    currentDayMessages: number
  }
  breakdown: Array<{
    type: string
    totalTokens: number
    totalCost: number
    count: number
  }>
  totals: {
    conversations: number
    messages: number
  }
}

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  sources: Array<{
    chunkId: string
    content: string
    similarity: number
    documentTitle: string
  }> | null
  reaction: string | null
  createdAt: string
}

interface Conversation {
  id: string
  sessionId: string
  chatbot: {
    id: string
    name: string
    primaryColor: string
  }
  messageCount: number
  messages: Message[]
  preview: string
  thumbsUp: number
  thumbsDown: number
  createdAt: string
  updatedAt: string
}

interface ChatbotFilter {
  id: string
  name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type TabType = 'usage' | 'conversations'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('usage')
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [chatbots, setChatbots] = useState<ChatbotFilter[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [selectedChatbot, setSelectedChatbot] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [convLoading, setConvLoading] = useState(false)
  const [expandedConv, setExpandedConv] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch analytics')
        return res.json()
      })
      .then((data) => {
        if (data.stats) {
          setStats(data.stats)
        }
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      })
      .finally(() => setLoading(false))
  }, [])

  const fetchConversations = useCallback(async (page = 1) => {
    setConvLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(selectedChatbot && { chatbotId: selectedChatbot }),
        ...(searchQuery && { search: searchQuery }),
      })

      const res = await fetch(`/api/conversations?${params}`)
      if (!res.ok) throw new Error('Failed to fetch conversations')

      const data = await res.json()
      setConversations(data.conversations)
      setChatbots(data.chatbots)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    } finally {
      setConvLoading(false)
    }
  }, [selectedChatbot, searchQuery])

  useEffect(() => {
    if (activeTab === 'conversations') {
      fetchConversations(1)
    }
  }, [activeTab, selectedChatbot, fetchConversations])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchConversations(1)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-2" />
          <div className="h-4 bg-slate-100 rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/60">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-slate-500">No analytics data available</p>
        </div>
      </div>
    )
  }

  const tokenUsagePercent = (stats.usage.currentMonthTokens / stats.limits.monthlyTokenLimit) * 100
  const costUsagePercent = (stats.usage.currentMonthCost / stats.limits.monthlyCostLimit) * 100
  const messageUsagePercent = (stats.usage.currentDayMessages / stats.limits.dailyMessageLimit) * 100

  const summaryStats = [
    {
      name: 'Total Conversations',
      value: stats.totals.conversations.toLocaleString(),
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ),
    },
    {
      name: 'Total Messages',
      value: stats.totals.messages.toLocaleString(),
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
    {
      name: 'Month Tokens',
      value: stats.usage.currentMonthTokens.toLocaleString(),
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Month Cost',
      value: `$${stats.usage.currentMonthCost.toFixed(2)}`,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  const usageMeters = [
    {
      name: 'Monthly Tokens',
      current: stats.usage.currentMonthTokens,
      limit: stats.limits.monthlyTokenLimit,
      percent: tokenUsagePercent,
      color: tokenUsagePercent >= 90 ? 'from-red-500 to-red-600' : tokenUsagePercent >= 70 ? 'from-amber-500 to-amber-600' : 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Monthly Cost',
      current: `$${stats.usage.currentMonthCost.toFixed(2)}`,
      limit: `$${stats.limits.monthlyCostLimit.toFixed(2)}`,
      percent: costUsagePercent,
      color: costUsagePercent >= 90 ? 'from-red-500 to-red-600' : costUsagePercent >= 70 ? 'from-amber-500 to-amber-600' : 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-100',
    },
    {
      name: 'Daily Messages',
      current: stats.usage.currentDayMessages,
      limit: stats.limits.dailyMessageLimit,
      percent: messageUsagePercent,
      color: messageUsagePercent >= 90 ? 'from-red-500 to-red-600' : messageUsagePercent >= 70 ? 'from-amber-500 to-amber-600' : 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-100',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Analytics & Usage</h1>
        <p className="text-slate-500 mt-1">Monitor your chatbot performance and usage</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 stagger-children">
        {summaryStats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                <p className={`mt-2 text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'usage'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Usage
            </span>
          </button>
          <button
            onClick={() => setActiveTab('conversations')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'conversations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Conversations
            </span>
          </button>
        </div>
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

      {/* Usage Tab Content */}
      {activeTab === 'usage' && (
        <>
          {/* Usage Meters */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Usage Limits</h2>
            <div className="space-y-6">
              {usageMeters.map((meter) => (
                <div key={meter.name}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">{meter.name}</span>
                    <span className="text-sm text-slate-500">
                      {typeof meter.current === 'number' ? meter.current.toLocaleString() : meter.current} / {typeof meter.limit === 'number' ? meter.limit.toLocaleString() : meter.limit}
                    </span>
                  </div>
                  <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${meter.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(meter.percent, 100)}%` }}
                    />
                  </div>
                  {meter.percent >= 90 && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Approaching limit
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Usage Breakdown */}
          {stats.breakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/60">
                <h2 className="font-semibold text-slate-900">Usage Breakdown (This Month)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Requests</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tokens</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.breakdown.map((item) => (
                      <tr key={item.type} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900 capitalize">{item.type}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{item.count.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-600">{item.totalTokens.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900">${item.totalCost.toFixed(4)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Conversations Tab Content */}
      {activeTab === 'conversations' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Chatbot Filter */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Chatbot</label>
                <select
                  value={selectedChatbot}
                  onChange={(e) => setSelectedChatbot(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="">All Chatbots</option>
                  {chatbots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Search messages</label>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search in conversations..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all shadow-sm"
                  >
                    Search
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Conversations List */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {convLoading ? (
              <div className="p-8">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-200" />
                        <div className="flex-1">
                          <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                          <div className="h-3 bg-slate-100 rounded w-2/3" />
                        </div>
                        <div className="h-4 bg-slate-100 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">No conversations yet</h3>
                <p className="text-sm text-slate-500">Conversations from your widget will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {conversations.map((conv) => (
                  <div key={conv.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Conversation Header */}
                    <button
                      onClick={() => setExpandedConv(expandedConv === conv.id ? null : conv.id)}
                      className="w-full p-4 flex items-start gap-4 text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
                        style={{ backgroundColor: conv.chatbot.primaryColor || '#6366f1' }}
                      >
                        {conv.chatbot.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900">{conv.chatbot.name}</span>
                          <span className="text-xs text-slate-400">
                            {conv.messageCount} messages
                          </span>
                          {conv.thumbsUp > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                              </svg>
                              {conv.thumbsUp}
                            </span>
                          )}
                          {conv.thumbsDown > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-red-500">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                              </svg>
                              {conv.thumbsDown}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 truncate">{conv.preview || 'No preview available'}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-400">{formatDate(conv.updatedAt)}</span>
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${expandedConv === conv.id ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Messages */}
                    {expandedConv === conv.id && (
                      <div className="px-4 pb-4">
                        <div className="ml-14 p-4 bg-slate-50 rounded-xl space-y-3 max-h-96 overflow-y-auto">
                          {conv.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                                  msg.role === 'USER'
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                                    : 'bg-white border border-slate-200 text-slate-900'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <div className={`flex items-center gap-2 mt-1 text-xs ${msg.role === 'USER' ? 'text-white/70' : 'text-slate-400'}`}>
                                  <span>{formatTime(msg.createdAt)}</span>
                                  {msg.reaction && (
                                    <span className={`flex items-center gap-0.5 ${msg.reaction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {msg.reaction === 'up' ? (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                                        </svg>
                                      )}
                                    </span>
                                  )}
                                </div>
                                {/* Sources for assistant messages */}
                                {msg.role === 'ASSISTANT' && msg.sources && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-200">
                                    <p className="text-xs font-medium text-slate-500 mb-1">Sources:</p>
                                    <div className="space-y-1">
                                      {(msg.sources as Array<{documentTitle: string; similarity: number}>).slice(0, 2).map((source, idx) => (
                                        <div key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <span className="truncate">{source.documentTitle}</span>
                                          <span className="text-slate-400">({Math.round(source.similarity * 100)}%)</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200/60 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchConversations(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchConversations(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
