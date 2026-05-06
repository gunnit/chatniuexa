import { JsonLd } from './JsonLd'
import type { Post, Author, Locale } from '@/lib/posts'

const BASE_URL = 'https://chataziendale.it'

function articleUrl(locale: Locale, slug: string): string {
  return locale === 'en' ? `${BASE_URL}/blog/${slug}` : `${BASE_URL}/${locale}/blog/${slug}`
}

/**
 * Extract H2 sections from MDX body. Returns the heading and the first paragraph
 * of body text below it (best-effort).
 */
function extractSections(body: string): Array<{ heading: string; text: string }> {
  const sections: Array<{ heading: string; text: string }> = []
  // Split on H2 boundaries; the regex captures the heading text on group 1.
  const lines = body.split('\n')
  let current: { heading: string; lines: string[] } | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/)
    if (headingMatch) {
      if (current) {
        sections.push({
          heading: current.heading,
          text: current.lines.join(' ').trim().slice(0, 500),
        })
      }
      current = { heading: headingMatch[1].trim(), lines: [] }
    } else if (current && line.trim() && !line.startsWith('#') && !line.startsWith('<') && !line.startsWith('```')) {
      current.lines.push(line.trim())
    }
  }
  if (current) {
    sections.push({
      heading: current.heading,
      text: current.lines.join(' ').trim().slice(0, 500),
    })
  }
  return sections
}

type ArticleSchemaProps = {
  post: Post
  author: Author
}

export function ArticleSchema({ post, author }: ArticleSchemaProps) {
  const url = articleUrl(post.locale, post.slug)

  const blogPosting: Record<string, unknown> = {
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

  const additional: Array<Record<string, unknown>> = []

  // HowTo schema for how-to articles. Step text comes from H2 sections.
  if (post.type === 'how-to') {
    const sections = extractSections(post.body)
    if (sections.length > 0) {
      additional.push({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: post.title,
        description: post.description,
        inLanguage: post.locale === 'it' ? 'it-IT' : 'en-US',
        totalTime: 'PT15M',
        step: sections.map((section, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: section.heading,
          text: section.text || section.heading,
          url: `${url}#${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        })),
      })
    }
  }

  // FAQPage schema for Q&A articles.
  if (post.type === 'qa') {
    const sections = extractSections(post.body).filter(
      (s) => s.heading.endsWith('?') || /^(what|how|why|when|where|which|who|is|do|does|can|are|cosa|come|perché|quando|dove|chi)\b/i.test(s.heading),
    )
    if (sections.length > 0) {
      additional.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: post.locale === 'it' ? 'it-IT' : 'en-US',
        mainEntity: sections.map((section) => ({
          '@type': 'Question',
          name: section.heading,
          acceptedAnswer: {
            '@type': 'Answer',
            text: section.text || section.heading,
          },
        })),
      })
    }
  }

  return (
    <>
      <JsonLd data={blogPosting} />
      {additional.map((schema, i) => (
        <JsonLd key={i} data={schema} />
      ))}
    </>
  )
}
