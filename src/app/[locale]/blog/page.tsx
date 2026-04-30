import { Link } from '@/i18n/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { JsonLd } from '@/components/seo/JsonLd'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { getAllPosts, SUPPORTED_LOCALES } from '@/lib/posts'
import type { Locale, Post } from '@/lib/posts'
import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'

const BASE_URL = 'https://chataziendale.it'

const COPY = {
  en: {
    title: 'Blog — ChatAziendale',
    description:
      'Hands-on guides, comparisons and research on AI chatbots, retrieval-augmented generation and AI search for European SMBs.',
    heading: 'Articles on AI chatbots and AI search',
    sub: 'Practical guides, neutral platform comparisons, and research-backed analyses for businesses deploying AI assistants.',
    readMore: 'Read article',
    minRead: (m: number) => `${m} min read`,
    types: { listicle: 'Listicle', 'how-to': 'How-to', comparison: 'Comparison', qa: 'Q&A' },
  },
  it: {
    title: 'Blog — ChatAziendale',
    description:
      'Guide pratiche, confronti e ricerca su chatbot AI, retrieval-augmented generation e ricerca AI per le PMI europee.',
    heading: 'Articoli su chatbot AI e ricerca AI',
    sub: 'Guide pratiche, confronti neutri tra piattaforme e analisi basate su ricerca per aziende che adottano assistenti AI.',
    readMore: 'Leggi l’articolo',
    minRead: (m: number) => `${m} min di lettura`,
    types: { listicle: 'Listicle', 'how-to': 'Guida', comparison: 'Confronto', qa: 'Q&A' },
  },
} as const

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale
  const t = COPY[locale]
  const path = locale === 'en' ? '/blog' : `/${locale}/blog`
  const siblingLocale: Locale = locale === 'en' ? 'it' : 'en'
  const siblingPath = siblingLocale === 'en' ? '/blog' : `/${siblingLocale}/blog`

  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        [locale]: `${BASE_URL}${path}`,
        [siblingLocale]: `${BASE_URL}${siblingPath}`,
        'x-default': `${BASE_URL}${locale === 'en' ? path : siblingPath}`,
      },
    },
    openGraph: {
      title: t.title,
      description: t.description,
      url: `${BASE_URL}${path}`,
      type: 'website',
      siteName: 'ChatAziendale',
      locale: locale === 'it' ? 'it_IT' : 'en_US',
    },
  }
}

function articleHref(post: Post): string {
  return post.locale === 'en' ? `/blog/${post.slug}` : `/${post.locale}/blog/${post.slug}`
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

export default async function BlogIndexPage() {
  const locale = (await getLocale()) as Locale
  const t = COPY[locale]
  const posts = getAllPosts(locale)

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.heading,
    description: t.description,
    inLanguage: locale === 'it' ? 'it-IT' : 'en-US',
    url: `${BASE_URL}${locale === 'en' ? '/blog' : `/${locale}/blog`}`,
    hasPart: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${BASE_URL}${articleHref(p)}`,
      datePublished: p.publishedAt,
      dateModified: p.updatedAt,
    })),
  }

  const breadcrumbs = [
    { name: 'Home', url: `${BASE_URL}${locale === 'en' ? '/' : `/${locale}`}` },
    { name: 'Blog', url: `${BASE_URL}${locale === 'en' ? '/blog' : `/${locale}/blog`}` },
  ]

  const accent: Record<Post['type'], { bar: string; hover: string; text: string }> = {
    listicle: { bar: 'bg-teal-500', hover: 'group-hover:border-teal-300', text: 'group-hover:text-[#0F766E]' },
    'how-to': { bar: 'bg-amber-500', hover: 'group-hover:border-amber-300', text: 'group-hover:text-amber-700' },
    comparison: { bar: 'bg-rose-500', hover: 'group-hover:border-rose-300', text: 'group-hover:text-rose-700' },
    qa: { bar: 'bg-cyan-500', hover: 'group-hover:border-cyan-300', text: 'group-hover:text-cyan-700' },
  }

  return (
    <div
      className="relative min-h-screen bg-[#FAFAF7] text-[#18181B]"
      style={{ colorScheme: 'light' }}
    >
      <JsonLd data={collectionSchema} />
      <BreadcrumbSchema items={breadcrumbs} />
      <Navbar />

      <main className="pt-24 sm:pt-32 pb-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-12">
          <header className="relative mb-16 sm:mb-20">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 -top-6 h-32 bg-dots opacity-[0.4] -z-10"
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {locale === 'it' ? 'Blog' : 'Blog'}
            </div>
            <h1 className="mt-6 font-serif text-[clamp(2.5rem,5vw,4rem)] tracking-[-0.025em] leading-[1.05] text-[#18181B] max-w-3xl">
              {t.heading}
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] sm:text-lg leading-[1.65] text-[#52525B]">{t.sub}</p>
          </header>

          {posts.length === 0 ? (
            <p className="text-[#71717A]">No articles yet.</p>
          ) : (
            <ul className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const a = accent[post.type]
                return (
                  <li key={post.slug}>
                    <Link
                      href={articleHref(post) as `/blog/${string}`}
                      className={`group block h-full rounded-2xl border border-[#E4E4E7] bg-white p-7 transition-all duration-200 ${a.hover} hover:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]`}
                    >
                      <div className={`h-1 w-12 rounded-full ${a.bar}`} />
                      <div className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#71717A]">
                        {t.types[post.type]}
                      </div>
                      <h2
                        className={`mt-3 font-serif text-[24px] leading-[1.2] tracking-[-0.01em] text-[#18181B] transition-colors ${a.text}`}
                      >
                        {post.title}
                      </h2>
                      <p className="mt-4 text-[14px] leading-[1.65] text-[#52525B] line-clamp-3">
                        {post.description}
                      </p>
                      <div className="mt-6 flex items-center gap-2.5 text-[11px] text-[#A1A1AA]">
                        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                        <span aria-hidden="true">·</span>
                        <span>{t.minRead(post.readingTimeMinutes)}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
