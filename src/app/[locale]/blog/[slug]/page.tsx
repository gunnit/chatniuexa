import { notFound } from 'next/navigation'
import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { ArticleLayout } from '@/components/blog/ArticleLayout'
import { mdxComponents } from '@/components/blog/mdx'
import { getPostBySlug, getAllSlugs, getAuthor, SUPPORTED_LOCALES } from '@/lib/posts'
import type { Locale } from '@/lib/posts'
import type { Metadata } from 'next'

const BASE_URL = 'https://chataziendale.it'

type Params = Promise<{ locale: Locale; slug: string }>

export async function generateStaticParams() {
  const params: Array<{ locale: Locale; slug: string }> = []
  for (const locale of SUPPORTED_LOCALES) {
    for (const slug of getAllSlugs(locale)) {
      params.push({ locale, slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params
  const post = getPostBySlug(locale, slug)
  if (!post) return {}

  const path = locale === 'en' ? `/blog/${post.slug}` : `/${locale}/blog/${post.slug}`
  const siblingLocale: Locale = locale === 'en' ? 'it' : 'en'
  const siblingPath =
    siblingLocale === 'en'
      ? `/blog/${post.hreflangSlug}`
      : `/${siblingLocale}/blog/${post.hreflangSlug}`

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        [locale]: `${BASE_URL}${path}`,
        [siblingLocale]: `${BASE_URL}${siblingPath}`,
        'x-default': `${BASE_URL}${locale === 'en' ? path : siblingPath}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}${path}`,
      type: 'article',
      siteName: 'ChatAziendale',
      locale: locale === 'it' ? 'it_IT' : 'en_US',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { locale, slug } = await params
  const post = getPostBySlug(locale, slug)
  if (!post) notFound()

  const author = getAuthor(post.author)

  const { content } = await compileMDX({
    source: post.body,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: 'append',
              properties: { className: ['heading-anchor'], 'aria-hidden': 'true', tabIndex: -1 },
            },
          ],
        ],
      },
    },
  })

  return (
    <ArticleLayout post={post} author={author}>
      {content}
    </ArticleLayout>
  )
}
