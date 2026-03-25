'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

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

/* Circular gauge geometry */
const GAUGE_R = 52
const GAUGE_C = 2 * Math.PI * GAUGE_R

function gaugeColors(pct: number): [string, string] {
  if (pct >= 90) return ['#ef4444', '#dc2626']
  if (pct >= 70) return ['#f59e0b', '#d97706']
  return ['#14b8a6', '#0d9488']
}

export default function AnalyticsPage() {
  const t = useTranslations('analytics')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [activeTab, setActiveTab] = useState<TabType>('usage')
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [animate, setAnimate] = useState(false)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [chatbots, setChatbots] = useState<ChatbotFilter[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 20, total: 0, totalPages: 0,
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
        if (data.stats) setStats(data.stats)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      })
      .finally(() => setLoading(false))
  }, [])

  /* Trigger gauge + bar animations after data arrives */
  useEffect(() => {
    if (!loading && stats) {
      const id = setTimeout(() => setAnimate(true), 200)
      return () => clearTimeout(id)
    }
  }, [loading, stats])

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
    if (activeTab === 'conversations') fetchConversations(1)
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
    if (diffMins < 1) return t('justNow')
    if (diffMins < 60) return t('minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('hoursAgo', { count: diffHours })
    if (diffDays < 7) return t('daysAgo', { count: diffDays })
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })

  /* ------------------------------------------------------------------ */
  /*  LOADING SKELETON                                                   */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <div className="h-10 w-64 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-4 w-80 rounded-md bg-slate-50 animate-pulse mt-3" />
          <div className="mt-5 h-px bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-100 bg-white p-8 animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="h-3 w-20 rounded bg-slate-100 mb-5" />
              <div className="h-14 w-28 rounded-lg bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /*  EMPTY STATE                                                        */
  /* ------------------------------------------------------------------ */
  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-3xl border border-slate-100">
          <div className="flex items-end gap-1.5 mb-6 h-14">
            <div className="w-3.5 h-5 rounded-sm bg-slate-100 animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-3.5 h-10 rounded-sm bg-slate-100 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-3.5 h-7 rounded-sm bg-slate-100 animate-pulse" style={{ animationDelay: '300ms' }} />
            <div className="w-3.5 h-12 rounded-sm bg-slate-100 animate-pulse" style={{ animationDelay: '450ms' }} />
            <div className="w-3.5 h-4 rounded-sm bg-slate-100 animate-pulse" style={{ animationDelay: '600ms' }} />
          </div>
          <p className="text-xl text-slate-300 italic">{t('noData')}</p>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /*  COMPUTED VALUES                                                     */
  /* ------------------------------------------------------------------ */
  const tokenPercent = (stats.usage.currentMonthTokens / stats.limits.monthlyTokenLimit) * 100
  const messagePercent = (stats.usage.currentDayMessages / stats.limits.dailyMessageLimit) * 100

  const summaryStats = [
    {
      name: t('totalConversations'),
      value: stats.totals.conversations.toLocaleString(),
      gradient: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ),
    },
    {
      name: t('totalMessages'),
      value: stats.totals.messages.toLocaleString(),
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
    {
      name: t('messagesToday'),
      value: stats.usage.currentDayMessages.toLocaleString(),
      gradient: 'from-cyan-500 to-blue-500',
      bg: 'bg-cyan-50',
      iconColor: 'text-cyan-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
  ]

  const usageMeters = [
    {
      name: t('monthlyTokens'),
      current: stats.usage.currentMonthTokens,
      limit: stats.limits.monthlyTokenLimit,
      percent: tokenPercent,
    },
    {
      name: t('dailyMessages'),
      current: stats.usage.currentDayMessages,
      limit: stats.limits.dailyMessageLimit,
      percent: messagePercent,
    },
  ]

  const maxBreakdownTokens = stats.breakdown.length > 0
    ? Math.max(...stats.breakdown.map((b) => b.totalTokens), 1)
    : 1

  /* ------------------------------------------------------------------ */
  /*  RENDER                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
      {/* Decorative ambient glow */}
      <div className="absolute -top-32 right-0 w-72 h-72 rounded-full bg-teal-400/[0.04] blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <div className="mb-10 relative">
        <h1 className="text-2xl font-bold text-slate-900">
          {t('title')}
        </h1>
        <p className="text-slate-400 mt-2 text-[0.9rem]">{t('subtitle')}</p>
        <div className="mt-5 h-px bg-gradient-to-r from-teal-500/30 via-teal-400/10 to-transparent" />
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {summaryStats.map((stat, i) => (
          <div
            key={stat.name}
            className="group relative bg-white rounded-2xl border border-slate-100 p-7 sm:p-8 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 overflow-hidden"
            style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: `${i * 100}ms` }}
          >
            {/* Hover accent line */}
            <div className={`absolute top-0 inset-x-6 h-px bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="flex items-start justify-between mb-1">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-slate-400">
                {stat.name}
              </p>
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.iconColor} opacity-50 group-hover:opacity-100 transition-opacity duration-400`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-8 mb-8 border-b border-slate-100">
        {([
          {
            key: 'usage' as TabType,
            label: t('tabUsage'),
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
          },
          {
            key: 'conversations' as TabType,
            label: t('tabConversations'),
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
          },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.key ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {tab.icon}
            </svg>
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-teal-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Error Alert ── */}
      {error && (
        <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/*  USAGE TAB                                                       */}
      {/* ================================================================ */}
      {activeTab === 'usage' && (
        <>
          {/* Circular Gauges */}
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-10 mb-8">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-10">
              {t('usageLimits')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-6">
              {usageMeters.map((meter, idx) => {
                const pct = Math.min(meter.percent, 100)
                const [c1, c2] = gaugeColors(meter.percent)
                const offset = animate ? GAUGE_C * (1 - pct / 100) : GAUGE_C
                const gradientId = `gauge-grad-${idx}`

                return (
                  <div key={meter.name} className="flex flex-col items-center">
                    <svg viewBox="0 0 120 120" className="w-44 h-44 sm:w-48 sm:h-48 drop-shadow-sm">
                      <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={c1} />
                          <stop offset="100%" stopColor={c2} />
                        </linearGradient>
                      </defs>
                      {/* Track */}
                      <circle cx="60" cy="60" r={GAUGE_R} fill="none" stroke="#f1f5f9" strokeWidth="9" />
                      {/* Progress */}
                      <circle
                        cx="60" cy="60" r={GAUGE_R}
                        fill="none"
                        stroke={`url(#${gradientId})`}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={GAUGE_C}
                        strokeDashoffset={offset}
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
                      />
                      {/* Percentage */}
                      <text
                        x="60" y="55"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: '26px', fontWeight: 700 }}
                        className="fill-slate-900"
                      >
                        {Math.round(pct)}%
                      </text>
                      {/* Label */}
                      <text
                        x="60" y="76"
                        textAnchor="middle"
                        style={{ fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}
                        className="fill-slate-400"
                      >
                        {meter.name.length > 16 ? meter.name.slice(0, 16) + '...' : meter.name}
                      </text>
                    </svg>

                    <p className="mt-2 text-sm text-slate-500">
                      <span className="font-mono tabular-nums">{meter.current.toLocaleString()}</span>
                      <span className="text-slate-300 mx-1.5">/</span>
                      <span className="font-mono tabular-nums">{meter.limit.toLocaleString()}</span>
                    </p>

                    {meter.percent >= 90 && (
                      <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {t('approachingLimit')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Usage Breakdown — Visual Bars */}
          {stats.breakdown.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-10">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-8">
                {t('usageBreakdown')}
              </h2>
              <div className="space-y-6">
                {stats.breakdown.map((item, i) => {
                  const barPct = Math.max((item.totalTokens / maxBreakdownTokens) * 100, 2)
                  return (
                    <div key={item.type}>
                      <div className="flex items-baseline justify-between mb-2.5">
                        <span className="text-sm font-medium text-slate-700 capitalize">{item.type}</span>
                        <div className="flex items-baseline gap-5">
                          <span className="text-xs text-slate-400">
                            {item.count.toLocaleString()} {t('colRequests').toLowerCase()}
                          </span>
                          <span className="text-sm font-mono tabular-nums text-slate-800">
                            {item.totalTokens.toLocaleString()}
                            <span className="text-slate-400 ml-1 text-xs">{t('colTokens').toLowerCase()}</span>
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500"
                          style={{
                            width: animate ? `${barPct}%` : '0%',
                            transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1)`,
                            transitionDelay: `${i * 150 + 400}ms`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/*  CONVERSATIONS TAB                                               */}
      {/* ================================================================ */}
      {activeTab === 'conversations' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="sm:w-56">
                <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">
                  {t('chatbotFilter')}
                </label>
                <select
                  value={selectedChatbot}
                  onChange={(e) => setSelectedChatbot(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                >
                  <option value="">{t('allChatbots')}</option>
                  {chatbots.map((bot) => (
                    <option key={bot.id} value={bot.id}>{bot.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">
                  {t('searchMessages')}
                </label>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm"
                  >
                    {tc('search')}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Conversations List */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {convLoading ? (
              <div className="p-6 space-y-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-3.5 bg-slate-100 rounded w-32 mb-2.5" />
                      <div className="h-3 bg-slate-50 rounded w-52" />
                    </div>
                    <div className="h-3 bg-slate-50 rounded w-14" />
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="flex items-end gap-1 mb-5 h-10">
                  <div className="w-1.5 h-3 rounded-sm bg-slate-100" />
                  <div className="w-1.5 h-6 rounded-sm bg-slate-100" />
                  <div className="w-1.5 h-4 rounded-sm bg-slate-100" />
                  <div className="w-1.5 h-8 rounded-sm bg-slate-100" />
                  <div className="w-1.5 h-2 rounded-sm bg-slate-100" />
                </div>
                <h3 className="font-medium text-slate-800 mb-1">{t('noConversationsYet')}</h3>
                <p className="text-sm text-slate-400 max-w-xs">{t('noConversationsHint')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {conversations.map((conv) => {
                  const isExpanded = expandedConv === conv.id
                  return (
                    <div
                      key={conv.id}
                      className="transition-colors"
                      style={{
                        borderLeft: `3px solid ${isExpanded ? (conv.chatbot.primaryColor || '#6366f1') : 'transparent'}`,
                        transition: 'border-color 0.3s ease',
                      }}
                    >
                      <button
                        onClick={() => setExpandedConv(isExpanded ? null : conv.id)}
                        className="w-full p-4 sm:p-5 flex items-start gap-4 text-left hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0"
                          style={{ backgroundColor: conv.chatbot.primaryColor || '#6366f1' }}
                        >
                          {conv.chatbot.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">{conv.chatbot.name}</span>
                            <span className="text-xs text-slate-400 font-mono">{conv.messageCount} {t('messages')}</span>
                            {conv.thumbsUp > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-emerald-500">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                </svg>
                                {conv.thumbsUp}
                              </span>
                            )}
                            {conv.thumbsDown > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-red-400">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                                </svg>
                                {conv.thumbsDown}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 truncate">{conv.preview || t('noPreview')}</p>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
                          <span className="text-xs text-slate-400">{formatDate(conv.updatedAt)}</span>
                          <svg
                            className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded Message Thread */}
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-5" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                          <div className="ml-14 space-y-3 max-h-[480px] overflow-y-auto pr-1">
                            {conv.messages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                                    msg.role === 'USER'
                                      ? 'bg-teal-700 text-white'
                                      : 'bg-slate-50 border border-slate-100 text-slate-800'
                                  }`}
                                >
                                  <p className="text-[0.85rem] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                  <div className={`flex items-center gap-2 mt-1.5 text-xs ${msg.role === 'USER' ? 'text-white/60' : 'text-slate-400'}`}>
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

                                  {/* Sources */}
                                  {msg.role === 'ASSISTANT' && msg.sources && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                                    <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                                        {tc('sources')}
                                      </p>
                                      <div className="space-y-1">
                                        {(msg.sources as Array<{ documentTitle: string; similarity: number }>).slice(0, 2).map((source, idx) => (
                                          <div key={idx} className="text-xs text-slate-500 flex items-center gap-1.5">
                                            <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="truncate">{source.documentTitle}</span>
                                            <span className="text-slate-400 font-mono text-[0.65rem]">
                                              {Math.round(source.similarity * 100)}%
                                            </span>
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
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-50 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {t('showing')}{' '}
                  <span className="font-mono tabular-nums text-slate-600">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>
                  {' '}{t('to')}{' '}
                  <span className="font-mono tabular-nums text-slate-600">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>
                  {' '}{t('of')}{' '}
                  <span className="font-mono tabular-nums text-slate-600">{pagination.total}</span>
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => fetchConversations(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {tc('previous')}
                  </button>
                  <button
                    onClick={() => fetchConversations(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {tc('next')}
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
