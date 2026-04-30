/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { SUPPORTED_LOCALES } from '../src/lib/posts'

const BASE_URL = 'https://chataziendale.it'
const HOST = 'chataziendale.it'

const KEY = process.env.INDEXNOW_KEY
if (!KEY) {
  console.warn('[indexnow] INDEXNOW_KEY not set — skipping ping.')
  process.exit(0)
}

const POSTS_ROOT = path.join(process.cwd(), 'content', 'posts')

const STATIC_PATHS = ['/', '/blog', '/about/gregor-maric', '/docs']

function articleUrls(): string[] {
  const urls: string[] = []
  for (const locale of SUPPORTED_LOCALES) {
    const dir = path.join(POSTS_ROOT, locale)
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
      const filepath = path.join(dir, file)
      const { data } = matter(fs.readFileSync(filepath, 'utf-8'))
      const slug = (data as { slug?: string }).slug
      if (!slug) continue
      const path_ = locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`
      urls.push(`${BASE_URL}${path_}`)
    }
  }
  return urls
}

function staticUrls(): string[] {
  return STATIC_PATHS.flatMap((p) =>
    SUPPORTED_LOCALES.map((locale) =>
      locale === 'en' ? `${BASE_URL}${p}` : `${BASE_URL}/${locale}${p === '/' ? '' : p}`,
    ),
  )
}

async function main() {
  const urlList = [...staticUrls(), ...articleUrls()]
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `${BASE_URL}/indexnow-verification`,
    urlList,
  }

  console.log(`[indexnow] submitting ${urlList.length} URLs to api.indexnow.org`)

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`[indexnow] HTTP ${res.status} — ${await res.text().catch(() => '')}`)
    // Non-fatal: don't break deploys on IndexNow API hiccups
    process.exit(0)
  }
  console.log(`[indexnow] OK (HTTP ${res.status})`)
}

main().catch((err) => {
  console.error('[indexnow] fatal:', err)
  // Non-fatal
  process.exit(0)
})
