import { Navbar } from '@/components/landing/Navbar'
import { ArticleHeader } from './ArticleHeader'
import { TableOfContents, extractHeadings } from './TableOfContents'
import { ArticleSchema } from '@/components/seo/ArticleSchema'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import type { Author, Post } from '@/lib/posts'
import type { ReactNode } from 'react'

const BASE_URL = 'https://chataziendale.it'

const BREADCRUMB_LABELS = {
  en: { home: 'Home', blog: 'Blog' },
  it: { home: 'Home', blog: 'Blog' },
} as const

type Props = {
  post: Post
  author: Author
  children: ReactNode
}

export function ArticleLayout({ post, author, children }: Props) {
  const headings = extractHeadings(post.body)
  const labels = BREADCRUMB_LABELS[post.locale]
  const localePrefix = post.locale === 'en' ? '' : `/${post.locale}`

  const breadcrumbs = [
    { name: labels.home, url: `${BASE_URL}${localePrefix || '/'}` },
    { name: labels.blog, url: `${BASE_URL}${localePrefix}/blog` },
    { name: post.title, url: `${BASE_URL}${localePrefix}/blog/${post.slug}` },
  ]

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-[#18181B]" style={{ colorScheme: 'light' }}>
      <ArticleSchema post={post} author={author} />
      <BreadcrumbSchema items={breadcrumbs} />
      <Navbar />

      <main className="pt-24 sm:pt-32 pb-32">
        <article className="mx-auto max-w-[680px] px-6 lg:px-0">
          <ArticleHeader post={post} author={author} />
          <TableOfContents headings={headings} locale={post.locale} />
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-serif prose-headings:tracking-[-0.015em] prose-headings:scroll-mt-24 prose-headings:text-[#18181B] prose-headings:font-normal
              prose-h2:text-[32px] prose-h2:mt-16 prose-h2:mb-5 prose-h2:leading-[1.15]
              prose-h3:text-[22px] prose-h3:mt-12 prose-h3:mb-3 prose-h3:leading-[1.25]
              prose-p:text-[17px] prose-p:leading-[1.7] prose-p:text-[#3F3F46]
              prose-a:text-[#0F766E] prose-a:font-normal prose-a:underline prose-a:decoration-[#0F766E]/30 prose-a:decoration-1 prose-a:underline-offset-[3px] hover:prose-a:decoration-[#0F766E]/80
              prose-strong:text-[#18181B] prose-strong:font-semibold
              prose-li:text-[#3F3F46] prose-li:my-1
              prose-blockquote:border-l-2 prose-blockquote:border-[#0F766E]/40 prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:text-[#18181B]
              prose-code:bg-[#F4F4F5] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[14px] prose-code:font-normal prose-code:text-[#18181B] prose-code:before:content-[''] prose-code:after:content-['']
              prose-table:text-[15px]
              prose-th:text-[#18181B] prose-th:font-semibold prose-th:bg-[#FAFAF7]
              prose-hr:border-[#E4E4E7]"
          >
            {children}
          </div>
        </article>
      </main>
    </div>
  )
}
