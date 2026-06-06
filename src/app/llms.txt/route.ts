import { NextResponse } from 'next/server'
import { getAllPosts, SUPPORTED_LOCALES } from '@/lib/posts'

const BASE_URL = 'https://chataziendale.it'

export const revalidate = 3600

export async function GET() {
  const posts = SUPPORTED_LOCALES.flatMap((locale) =>
    getAllPosts(locale).map((post) => ({
      title: post.title,
      url: locale === 'en'
        ? `${BASE_URL}/blog/${post.slug}`
        : `${BASE_URL}/${locale}/blog/${post.slug}`,
      description: post.description,
      locale,
    })),
  )

  const lines: string[] = [
    '# ChatAziendale',
    '',
    '> AI chatbot builder for Italian SMBs and businesses worldwide. Train chatbots on your documents, websites, and FAQs — they answer customer questions with source citations, no hallucinations.',
    '',
    '## About',
    '',
    `- [Homepage](${BASE_URL}/): Product overview`,
    `- [Italian homepage](${BASE_URL}/it): Versione italiana`,
    `- [Documentation](${BASE_URL}/docs): Setup, embed, and integration guides`,
    `- [Blog](${BASE_URL}/blog): Articles on AI chatbots, WhatsApp Business, and AEO`,
    `- [About Gregor Maric](${BASE_URL}/about/gregor-maric): Founder profile`,
    '',
    '## Articles',
    '',
  ]

  for (const post of posts) {
    lines.push(`- [${post.title}](${post.url}) (${post.locale}): ${post.description}`)
  }

  lines.push('')
  lines.push('## Legal')
  lines.push('')
  lines.push(`- [Privacy Policy](${BASE_URL}/privacy)`)
  lines.push(`- [Terms of Service](${BASE_URL}/terms)`)
  lines.push('')

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
