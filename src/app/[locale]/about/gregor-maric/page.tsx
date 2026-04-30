import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { PersonSchema } from '@/components/seo/PersonSchema'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { getAllPosts, getAuthor, SUPPORTED_LOCALES } from '@/lib/posts'
import type { Locale, Post } from '@/lib/posts'
import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'

const BASE_URL = 'https://chataziendale.it'
const AUTHOR_ID = 'gregor-maric'

const COPY = {
  en: {
    heading: 'About the author',
    articlesHeading: 'Recent articles',
    backToBlog: '← Back to blog',
  },
  it: {
    heading: 'Sull’autore',
    articlesHeading: 'Articoli recenti',
    backToBlog: '← Torna al blog',
  },
} as const

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale
  const author = getAuthor(AUTHOR_ID)
  const path = locale === 'en' ? '/about/gregor-maric' : `/${locale}/about/gregor-maric`
  const siblingLocale: Locale = locale === 'en' ? 'it' : 'en'
  const siblingPath =
    siblingLocale === 'en' ? '/about/gregor-maric' : `/${siblingLocale}/about/gregor-maric`

  return {
    title: `${author.name} — ${author.role}`,
    description: author.bio[locale],
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        [locale]: `${BASE_URL}${path}`,
        [siblingLocale]: `${BASE_URL}${siblingPath}`,
        'x-default': `${BASE_URL}${locale === 'en' ? path : siblingPath}`,
      },
    },
    openGraph: {
      title: `${author.name} — ${author.role}`,
      description: author.bio[locale],
      url: `${BASE_URL}${path}`,
      type: 'profile',
      siteName: 'ChatAziendale',
      locale: locale === 'it' ? 'it_IT' : 'en_US',
    },
  }
}

function articleHref(post: Post): string {
  return post.locale === 'en' ? `/blog/${post.slug}` : `/${post.locale}/blog/${post.slug}`
}

export default async function AuthorPage() {
  const locale = (await getLocale()) as Locale
  const t = COPY[locale]
  const author = getAuthor(AUTHOR_ID)
  const posts = getAllPosts(locale).slice(0, 6)

  const breadcrumbs = [
    { name: 'Home', url: `${BASE_URL}${locale === 'en' ? '/' : `/${locale}`}` },
    {
      name: author.name,
      url: `${BASE_URL}${locale === 'en' ? '/about/gregor-maric' : `/${locale}/about/gregor-maric`}`,
    },
  ]

  return (
    <div
      className="relative min-h-screen bg-[#FAFAF7] text-[#1B1B1F]"
      style={{ colorScheme: 'light' }}
    >
      <PersonSchema author={author} locale={locale} />
      <BreadcrumbSchema items={breadcrumbs} />
      <Navbar />

      <main className="pt-24 sm:pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#71717A] hover:text-[#0F766E] transition-colors"
          >
            {t.backToBlog}
          </Link>

          <div className="mt-12 flex items-start gap-7">
            <Image
              src={author.avatar}
              alt={author.name}
              width={104}
              height={104}
              className="flex-shrink-0 rounded-full bg-[#F4F4F5] ring-1 ring-[#E4E4E7]"
            />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-[11px] font-semibold tracking-[0.16em] uppercase">
                {t.heading}
              </div>
              <h1 className="mt-4 font-serif text-[clamp(2.5rem,5vw,3.75rem)] tracking-[-0.025em] leading-[1.05] text-[#18181B]">
                {author.name}
              </h1>
              <div className="mt-3 text-[15px] text-[#52525B]">{author.role}</div>
            </div>
          </div>

          <p className="mt-10 text-[18px] leading-[1.7] text-[#3F3F46]">{author.bio[locale]}</p>

          <ul className="mt-8 flex flex-wrap gap-2.5">
            {author.sameAs.map((href) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-white px-4 py-2 text-[13px] text-[#3F3F46] hover:border-[#0F766E]/40 hover:text-[#0F766E] transition-colors"
                >
                  {new URL(href).hostname.replace('www.', '')}
                  <span aria-hidden="true" className="text-[10px] translate-y-[-1px]">↗</span>
                </a>
              </li>
            ))}
          </ul>

          {posts.length > 0 ? (
            <section className="mt-20 border-t border-[#E4E4E7] pt-14">
              <h2 className="font-serif text-[28px] tracking-[-0.015em] leading-tight text-[#18181B]">
                {t.articlesHeading}
              </h2>
              <ul className="mt-8 divide-y divide-[#E4E4E7]">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <Link
                      href={articleHref(post) as `/blog/${string}`}
                      className="group flex items-baseline justify-between gap-6 py-5"
                    >
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#71717A]">
                          {post.type}
                        </div>
                        <div className="mt-1.5 font-serif text-[20px] leading-tight tracking-[-0.01em] text-[#18181B] group-hover:text-[#0F766E] transition-colors">
                          {post.title}
                        </div>
                      </div>
                      <span
                        aria-hidden="true"
                        className="flex-shrink-0 text-[#A1A1AA] group-hover:text-[#0F766E] group-hover:translate-x-0.5 transition-all"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  )
}
