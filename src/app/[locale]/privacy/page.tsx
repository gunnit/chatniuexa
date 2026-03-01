import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('metadata')
  return {
    title: t('privacyTitle'),
  }
}

export default async function PrivacyPage() {
  const t = await getTranslations('privacy')
  const tc = await getTranslations('common')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <nav className="flex items-center justify-between px-6 py-4 lg:px-12 border-b border-slate-800">
        <Link href="/" className="text-2xl font-bold text-white tracking-tight">
          ChatAziendale<span className="text-teal-400">.it</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">{t('title')}</h1>
        <p className="text-sm text-slate-500 mb-8">{t('lastUpdated')}</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section1Title')}</h2>
            <p>{t('section1Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section2Title')}</h2>
            <p>{t('section2Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section3Title')}</h2>
            <p>{t('section3Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section4Title')}</h2>
            <p>{t('section4Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section5Title')}</h2>
            <p>{t('section5Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section6Title')}</h2>
            <p>{t('section6Text')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t('section7Title')}</h2>
            <p>{t('section7Text')} <a href="mailto:privacy@chataziendale.it" className="text-teal-400 hover:text-teal-300">privacy@chataziendale.it</a>.</p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-sm">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            &larr; {t('backToHome')}
          </Link>
          <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
            {tc('termsOfService')}
          </Link>
        </div>
      </main>
    </div>
  )
}
