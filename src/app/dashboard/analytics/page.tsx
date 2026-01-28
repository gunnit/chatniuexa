'use client'

import { useEffect, useState } from 'react'

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

export default function AnalyticsPage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    </div>
  )
}
