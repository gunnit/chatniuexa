'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

interface UserData {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  tenant: {
    id: string
    name: string
    plan: string
    chatbotCount: number
  } | null
  usage: {
    currentMonthTokens: number
    currentDayMessages: number
    currentMonthCost: number
    monthlyTokenLimit: number
    dailyMessageLimit: number
    monthlyCostLimit: number
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminUsersPage() {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [users, setUsers] = useState<UserData[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...(search && { search }),
        ...(planFilter && { plan: planFilter }),
      })

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed to fetch users')

      const data = await res.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch {
      setToast({ message: 'Failed to load users', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search, planFilter])

  useEffect(() => {
    fetchUsers(1)
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(1)
  }

  const handleChangePlan = async (tenantId: string, newPlan: string) => {
    setChangingPlan(tenantId)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      })

      if (!res.ok) throw new Error('Failed to update plan')

      setToast({ message: t('planUpdated'), type: 'success' })
      // Refresh user list
      fetchUsers(pagination.page)
    } catch {
      setToast({ message: t('planUpdateError'), type: 'error' })
    } finally {
      setChangingPlan(null)
    }
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const planBadgeColors: Record<string, string> = {
    free: 'bg-slate-600 text-slate-200',
    pro: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    business: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border ${
          toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200'
            : 'bg-red-900/90 border-red-700 text-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t('usersTitle')}</h1>
        <p className="text-slate-400 mt-1">{t('usersSubtitle')}</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('filterByPlan')}</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            >
              <option value="">{t('allPlans')}</option>
              <option value="free">{t('freePlan')}</option>
              <option value="pro">{t('proPlan')}</option>
              <option value="business">{t('businessPlan')}</option>
            </select>
          </div>
          <div className="flex-[2]">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">{tc('search')}</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-700/50 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all shadow-sm"
              >
                {tc('search')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-700" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-slate-700/50 rounded w-1/4" />
                  </div>
                  <div className="h-6 bg-slate-700 rounded w-16" />
                  <div className="h-4 bg-slate-700/50 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-slate-400">{t('noUsersFound')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-700/30">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colUser')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colPlan')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colTokens')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colMessages')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colCost')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colChatbots')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colCreated')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {users.map((user) => {
                    const tokenPercent = user.usage
                      ? (user.usage.currentMonthTokens / user.usage.monthlyTokenLimit) * 100
                      : 0

                    return (
                      <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                        {/* User */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white">{user.name || '—'}</p>
                              <p className="text-sm text-slate-400">{user.email}</p>
                              {user.tenant && (
                                <p className="text-xs text-slate-500">{user.tenant.name}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-6 py-4">
                          {user.tenant ? (
                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${planBadgeColors[user.tenant.plan] || planBadgeColors.free}`}>
                              {user.tenant.plan}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">{t('noTenant')}</span>
                          )}
                        </td>

                        {/* Tokens */}
                        <td className="px-6 py-4">
                          {user.usage ? (
                            <div>
                              <p className="text-sm text-slate-200">
                                {user.usage.currentMonthTokens.toLocaleString()}
                                <span className="text-slate-500"> / {user.usage.monthlyTokenLimit.toLocaleString()}</span>
                              </p>
                              <div className="mt-1 h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${tokenPercent >= 90 ? 'bg-red-500' : tokenPercent >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(tokenPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </td>

                        {/* Messages */}
                        <td className="px-6 py-4">
                          {user.usage ? (
                            <span className="text-sm text-slate-200">
                              {user.usage.currentDayMessages}
                              <span className="text-slate-500"> / {user.usage.dailyMessageLimit}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </td>

                        {/* Cost */}
                        <td className="px-6 py-4">
                          {user.usage ? (
                            <span className="text-sm text-slate-200">
                              ${user.usage.currentMonthCost.toFixed(2)}
                              <span className="text-slate-500"> / ${user.usage.monthlyCostLimit.toFixed(0)}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </td>

                        {/* Chatbots */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-200">{user.tenant?.chatbotCount ?? 0}</span>
                        </td>

                        {/* Created */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-400">{formatDate(user.createdAt)}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          {user.tenant && (
                            <select
                              value={user.tenant.plan}
                              onChange={(e) => handleChangePlan(user.tenant!.id, e.target.value)}
                              disabled={changingPlan === user.tenant.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-all"
                            >
                              <option value="free">{t('freePlan')}</option>
                              <option value="pro">{t('proPlan')}</option>
                              <option value="business">{t('businessPlan')}</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {t('showing')} {(pagination.page - 1) * pagination.limit + 1} {t('to')}{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} {t('of')}{' '}
                  {pagination.total} {t('users')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchUsers(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {tc('previous')}
                  </button>
                  <button
                    onClick={() => fetchUsers(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {tc('next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
