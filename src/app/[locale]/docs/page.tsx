import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('metadata')
  return {
    title: t('docsTitle'),
  }
}

export default async function DocsPage() {
  const t = await getTranslations('docs')
  const tc = await getTranslations('common')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <nav className="flex items-center justify-between px-6 py-4 lg:px-12 border-b border-slate-800">
        <Link href="/" className="text-2xl font-bold text-white tracking-tight">
          ChatAziendale<span className="text-teal-400">.it</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-3">{t('title')}</h1>
        <p className="text-slate-400 mb-12">{t('subtitle')}</p>

        {/* Table of Contents */}
        <div className="mb-12 p-5 rounded-lg border border-slate-800 bg-slate-900/50">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('tocTitle')}</h2>
          <nav className="space-y-1.5">
            {[
              { href: '#what-is', label: t('tocWhatIs') },
              { href: '#getting-started', label: t('tocGettingStarted') },
              { href: '#data-sources', label: t('tocDataSources') },
              { href: '#chatbots', label: t('tocChatbots') },
              { href: '#embedding', label: t('tocEmbedding') },
              { href: '#analytics', label: t('tocAnalytics') },
              { href: '#billing', label: t('tocBilling') },
              { href: '#troubleshooting', label: t('tocTroubleshooting') },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="space-y-12 text-slate-300 leading-relaxed">
          {/* What is ChatAziendale */}
          <section id="what-is">
            <h2 className="text-xl font-semibold text-white mb-3">{t('whatIsTitle')}</h2>
            <p className="mb-3">{t('whatIsText1')}</p>
            <p>{t('whatIsText2')}</p>
          </section>

          {/* Getting Started */}
          <section id="getting-started">
            <h2 className="text-xl font-semibold text-white mb-3">{t('gettingStartedTitle')}</h2>
            <p className="mb-4">{t('gettingStartedIntro')}</p>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>{t('gettingStartedStep1')}</li>
              <li>{t('gettingStartedStep2')}</li>
              <li>{t('gettingStartedStep3')}</li>
              <li>{t('gettingStartedStep4')}</li>
              <li>{t('gettingStartedStep5')}</li>
            </ol>
          </section>

          {/* Data Sources */}
          <section id="data-sources">
            <h2 className="text-xl font-semibold text-white mb-3">{t('dataSourcesTitle')}</h2>
            <p className="mb-4">{t('dataSourcesIntro')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('dsFileUploadTitle')}</h3>
            <p className="mb-4">{t('dsFileUploadText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('dsUrlTitle')}</h3>
            <p className="mb-4">{t('dsUrlText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('dsCrawlTitle')}</h3>
            <p className="mb-4">{t('dsCrawlText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('dsStatusTitle')}</h3>
            <p>{t('dsStatusText')}</p>
          </section>

          {/* Chatbots */}
          <section id="chatbots">
            <h2 className="text-xl font-semibold text-white mb-3">{t('chatbotsTitle')}</h2>
            <p className="mb-4">{t('chatbotsIntro')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('cbCreateTitle')}</h3>
            <p className="mb-4">{t('cbCreateText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('cbSettingsTitle')}</h3>
            <p className="mb-4">{t('cbSettingsText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('cbPromptTitle')}</h3>
            <p className="mb-4">{t('cbPromptText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('cbAppearanceTitle')}</h3>
            <p className="mb-4">{t('cbAppearanceText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('cbTestTitle')}</h3>
            <p>{t('cbTestText')}</p>
          </section>

          {/* Embedding */}
          <section id="embedding">
            <h2 className="text-xl font-semibold text-white mb-3">{t('embeddingTitle')}</h2>
            <p className="mb-4">{t('embeddingIntro')}</p>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 font-mono text-sm text-teal-400 mb-4 overflow-x-auto">
              {`<script src="https://chataziendale.onrender.com/widget.js" data-chatbot-id="YOUR_ID"></script>`}
            </div>
            <p>{t('embeddingText')}</p>
          </section>

          {/* Analytics */}
          <section id="analytics">
            <h2 className="text-xl font-semibold text-white mb-3">{t('analyticsTitle')}</h2>
            <p className="mb-4">{t('analyticsIntro')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('anUsageTitle')}</h3>
            <p className="mb-4">{t('anUsageText')}</p>

            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('anConversationsTitle')}</h3>
            <p>{t('anConversationsText')}</p>
          </section>

          {/* Billing */}
          <section id="billing">
            <h2 className="text-xl font-semibold text-white mb-3">{t('billingTitle')}</h2>
            <p className="mb-4">{t('billingIntro')}</p>

            <div className="space-y-3 mb-4">
              <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
                <h3 className="text-base font-semibold text-white mb-1">{t('planFreeTitle')}</h3>
                <p className="text-sm">{t('planFreeDesc')}</p>
              </div>
              <div className="p-4 rounded-lg border border-teal-800/50 bg-teal-950/20">
                <h3 className="text-base font-semibold text-teal-400 mb-1">{t('planProTitle')}</h3>
                <p className="text-sm">{t('planProDesc')}</p>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
                <h3 className="text-base font-semibold text-white mb-1">{t('planBusinessTitle')}</h3>
                <p className="text-sm">{t('planBusinessDesc')}</p>
              </div>
            </div>
            <p>{t('billingPaypal')}</p>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting">
            <h2 className="text-xl font-semibold text-white mb-3">{t('troubleshootingTitle')}</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{t('tsNotRespondingTitle')}</h3>
                <p className="text-sm">{t('tsNotRespondingText')}</p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{t('tsWrongAnswersTitle')}</h3>
                <p className="text-sm">{t('tsWrongAnswersText')}</p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{t('tsWidgetTitle')}</h3>
                <p className="text-sm">{t('tsWidgetText')}</p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{t('tsUploadTitle')}</h3>
                <p className="text-sm">{t('tsUploadText')}</p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{t('tsLimitsTitle')}</h3>
                <p className="text-sm">{t('tsLimitsText')}</p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{t('tsCrawlTitle')}</h3>
                <p className="text-sm">{t('tsCrawlText')}</p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-slate-800 bg-slate-900/50">
              <p className="text-sm">{t('contactSupport')} <a href="mailto:support@chataziendale.it" className="text-teal-400 hover:text-teal-300">support@chataziendale.it</a></p>
            </div>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-sm">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            &larr; {t('backToHome')}
          </Link>
          <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
            {tc('privacyPolicy')}
          </Link>
        </div>
      </main>
    </div>
  )
}
