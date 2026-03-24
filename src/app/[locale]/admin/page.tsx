/**
 * Admin Dashboard Page
 *
 * Platform-wide stats: users, tenants, revenue, usage.
 */
import { verifyAdminSession } from '@/lib/dal/auth'
import { prisma } from '@/lib/db'
import { PLANS } from '@/lib/plans'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export default async function AdminDashboardPage() {
  await verifyAdminSession()
  const t = await getTranslations('admin')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalUsers,
    totalTenants,
    planCounts,
    totalChatbots,
    totalConversations,
    totalMessages,
    monthlyUsage,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.tenant.groupBy({
      by: ['plan'],
      _count: true,
    }),
    prisma.chatbot.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { tokens: true, cost: true },
    }),
  ])

  const planDistribution: Record<string, number> = { free: 0, pro: 0, business: 0 }
  for (const pc of planCounts) {
    planDistribution[pc.plan] = pc._count
  }

  const paidTenants = (planDistribution.pro || 0) + (planDistribution.business || 0)
  const monthlyRevenue =
    (planDistribution.pro || 0) * PLANS.pro.price +
    (planDistribution.business || 0) * PLANS.business.price

  const stats = [
    {
      name: t('totalUsers'),
      value: totalUsers,
      color: 'from-blue-400 to-blue-500',
      bgColor: 'bg-blue-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: t('totalTenants'),
      value: totalTenants,
      color: 'from-emerald-400 to-emerald-500',
      bgColor: 'bg-emerald-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: t('paidTenants'),
      value: paidTenants,
      color: 'from-amber-400 to-amber-500',
      bgColor: 'bg-amber-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      name: t('totalRevenue'),
      value: `$${monthlyRevenue}`,
      color: 'from-green-400 to-green-500',
      bgColor: 'bg-green-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  const platformStats = [
    {
      name: t('totalChatbots'),
      value: totalChatbots,
      color: 'from-purple-400 to-purple-500',
      bgColor: 'bg-purple-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      name: t('totalConversations'),
      value: totalConversations,
      color: 'from-pink-400 to-pink-500',
      bgColor: 'bg-pink-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ),
    },
    {
      name: t('totalMessages'),
      value: totalMessages.toLocaleString(),
      color: 'from-orange-400 to-orange-500',
      bgColor: 'bg-orange-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
    {
      name: t('totalTokens'),
      value: (monthlyUsage._sum.tokens || 0).toLocaleString(),
      color: 'from-cyan-400 to-cyan-500',
      bgColor: 'bg-cyan-500/10',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ]

  const planLabels: Record<string, string> = {
    free: t('freePlan'),
    pro: t('proPlan'),
    business: t('businessPlan'),
  }
  const planColors: Record<string, string> = {
    free: 'bg-slate-500',
    pro: 'bg-amber-500',
    business: 'bg-emerald-500',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <p className="text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      {/* Revenue & User Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:border-slate-600/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.name}</p>
                <p className={`mt-2 text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <span className="text-slate-300">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {platformStats.map((stat) => (
          <div
            key={stat.name}
            className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:border-slate-600/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.name}</p>
                <p className={`mt-2 text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <span className="text-slate-300">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Distribution + Quick Link */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">{t('planDistribution')}</h2>
          <div className="space-y-4">
            {(['free', 'pro', 'business'] as const).map((plan) => {
              const count = planDistribution[plan] || 0
              const percent = totalTenants > 0 ? (count / totalTenants) * 100 : 0
              return (
                <div key={plan}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-300">{planLabels[plan]}</span>
                    <span className="text-sm text-slate-400">{count} ({Math.round(percent)}%)</span>
                  </div>
                  <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 ${planColors[plan]} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">{t('navUsers')}</h2>
          <p className="text-slate-400 mb-4">{t('usersSubtitle')}</p>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {t('navUsers')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
