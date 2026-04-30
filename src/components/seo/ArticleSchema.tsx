import { JsonLd } from './JsonLd'
import type { Post, Author, Locale } from '@/lib/posts'

const BASE_URL = 'https://chataziendale.it'

function articleUrl(locale: Locale, slug: string): string {
  return locale === 'en' ? `${BASE_URL}/blog/${slug}` : `${BASE_URL}/${locale}/blog/${slug}`
}

type ArticleSchemaProps = {
  post: Post
  author: Author
}

export function ArticleSchema({ post, author }: ArticleSchemaProps) {
  const url = articleUrl(post.locale, post.slug)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: post.locale === 'it' ? 'it-IT' : 'en-US',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    keywords: post.tags.join(', '),
    articleSection: post.type,
    author: {
      '@type': 'Person',
      '@id': `${BASE_URL}${author.url[post.locale]}`,
      name: author.name,
      url: `${BASE_URL}${author.url[post.locale]}`,
      jobTitle: author.role,
      sameAs: author.sameAs,
    },
    publisher: {
      '@type': 'Organization',
      name: 'ChatAziendale',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/images/logo.png`,
      },
    },
    image: {
      '@type': 'ImageObject',
      url: `${url}/opengraph-image`,
      width: 1200,
      height: 630,
    },
  }

  return <JsonLd data={schema} />
}
