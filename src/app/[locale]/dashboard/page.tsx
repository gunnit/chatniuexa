/**
 * Dashboard Page
 *
 * Modern dashboard overview with stats, quick actions, and recent chatbots.
 */
import { verifySession } from '@/lib/dal/auth'
import { prisma } from '@/lib/db'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export default async function DashboardPage() {
  const session = await verifySession()
  const t = await getTranslations('dashboard')
  const tc = await getTranslations('common')

  // Fetch summary data
  const [chatbotCount, dataSourceCount, conversationCount, messageCount] = await Promise.all([
    prisma.chatbot.count({ where: { tenantId: session.tenantId! } }),
    prisma.dataSource.count({ where: { tenantId: session.tenantId! } }),
    prisma.conversation.count({
      where: { chatbot: { tenantId: session.tenantId! } },
    }),
    prisma.message.count({
      where: { conversation: { chatbot: { tenantId: session.tenantId! } } },
    }),
  ])

  const recentChatbots = await prisma.chatbot.findMany({
    where: { tenantId: session.tenantId! },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      _count: { select: { conversations: true } },
    },
  })

  const stats = [
    {
      name: t('statChatbots'),
      value: chatbotCount,
      href: '/dashboard/chatbots',
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      name: t('statDataSources'),
      value: dataSourceCount,
      href: '/dashboard/data-sources',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      ),
    },
    {
      name: t('statConversations'),
      value: conversationCount,
      href: '/dashboard/analytics',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ),
    },
    {
      name: t('statMessages'),
      value: messageCount,
      href: '/dashboard/analytics',
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('welcomeBack')}</h1>
        <p className="text-slate-500 mt-1">{session.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 stagger-children">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="group relative bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-lg hover:border-slate-300/60 transition-all duration-300 hover:-translate-y-1"
          >
            {/* Gradient accent line */}
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity`} />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                <p className={`mt-2 text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <span className={`bg-gradient-to-r ${stat.color} bg-clip-text`}>
                  {stat.icon}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('quickActions')}</h2>
            <div className="space-y-3">
              <Link
                href="/dashboard/chatbots"
                className="group flex items-center gap-3 w-full p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">{t('createNewChatbot')}</span>
                <svg className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/dashboard/data-sources"
                className="group flex items-center gap-3 w-full p-4 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="font-medium">{t('addDataSource')}</span>
                <svg className="w-4 h-4 ml-auto text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Getting Started */}
          <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('gettingStarted')}</h2>
            <ol className="space-y-3">
              {[
                { text: t('step1'), done: dataSourceCount > 0 },
                { text: t('step2'), done: chatbotCount > 0 },
                { text: t('step3'), done: false },
                { text: t('step4'), done: false },
                { text: t('step5'), done: false },
              ].map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step.done
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {step.done ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={`text-sm ${step.done ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Recent Chatbots */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">{t('recentChatbots')}</h2>
              <Link
                href="/dashboard/chatbots"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {tc('viewAll')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {recentChatbots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {recentChatbots.map((chatbot) => (
                  <Link
                    key={chatbot.id}
                    href={`/dashboard/chatbots/${chatbot.id}`}
                    className="group p-5 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-gradient-to-br hover:from-indigo-50/50 hover:to-purple-50/50 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                        {chatbot.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {chatbot.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {chatbot._count.conversations} {t('conversations')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{t('created')} {new Date(chatbot.createdAt).toLocaleDateString()}</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{t('noChatbotsYet')}</h3>
                <p className="text-sm text-slate-500 mb-4">{t('createFirstChatbot')}</p>
                <Link
                  href="/dashboard/chatbots"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('createChatbot')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
