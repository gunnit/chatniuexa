import { ImageResponse } from 'next/og'
import { getPostBySlug, getAuthor, SUPPORTED_LOCALES, getAllSlugs } from '@/lib/posts'
import type { Locale } from '@/lib/posts'

export const runtime = 'nodejs'
export const revalidate = 3600
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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

export default async function OgImage({ params }: { params: Params }) {
  const { locale, slug } = await params
  const post = getPostBySlug(locale, slug)
  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FAFAF7',
            color: '#1B1B1F',
            fontSize: 64,
          }}
        >
          ChatAziendale
        </div>
      ),
      size,
    )
  }
  const author = getAuthor(post.author)

  const typeLabel = post.type.toUpperCase().replace('-', ' ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#FAFAF7',
          color: '#1B1B1F',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: '#0F766E',
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            ChatAziendale<span style={{ color: '#0F766E' }}>.it</span>
          </div>
          <div
            style={{
              marginLeft: 24,
              fontSize: 16,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#0F766E',
              fontWeight: 700,
            }}
          >
            {typeLabel}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: post.title.length > 80 ? 56 : 68,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            color: '#1B1B1F',
            maxWidth: 1056,
          }}
        >
          {post.title}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 32,
            borderTop: '1px solid rgba(27, 27, 31, 0.12)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{author.name}</div>
            <div style={{ fontSize: 18, color: 'rgba(27, 27, 31, 0.65)' }}>{author.role}</div>
          </div>
          <div style={{ fontSize: 18, color: 'rgba(27, 27, 31, 0.55)' }}>
            chataziendale.it
          </div>
        </div>
      </div>
    ),
    size,
  )
}
