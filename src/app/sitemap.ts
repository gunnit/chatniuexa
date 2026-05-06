import type { MetadataRoute } from 'next'
import { getAllPosts, SUPPORTED_LOCALES } from '@/lib/posts'
import type { Locale, Post } from '@/lib/posts'

const BASE_URL = 'https://chataziendale.it'

type ChangeFrequency = 'weekly' | 'monthly' | 'yearly'

function localizedUrl(locale: Locale, path: string): string {
  if (locale === 'en') return `${BASE_URL}${path === '' ? '/' : path}`
  return `${BASE_URL}/${locale}${path === '' ? '' : path}`
}

function staticEntry(
  path: string,
  changeFrequency: ChangeFrequency,
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: localizedUrl('en', path),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LOCALES.map((locale) => [locale, localizedUrl(locale, path)]),
      ),
    },
  }
}

function articleEntry(post: Post): MetadataRoute.Sitemap[number] {
  const path = `/blog/${post.slug}`
  const sibling: Locale = post.locale === 'en' ? 'it' : 'en'
  const siblingPath = `/blog/${post.hreflangSlug}`
  return {
    url: localizedUrl(post.locale, path),
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.8,
    alternates: {
      languages: {
        [post.locale]: localizedUrl(post.locale, path),
        [sibling]: localizedUrl(sibling, siblingPath),
      },
    },
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = [
    staticEntry('', 'weekly', 1),
    staticEntry('/blog', 'weekly', 0.9),
    staticEntry('/about/gregor-maric', 'monthly', 0.7),
    staticEntry('/docs', 'monthly', 0.7),
    staticEntry('/privacy', 'yearly', 0.3),
    staticEntry('/terms', 'yearly', 0.3),
  ]

  const articleEntries = SUPPORTED_LOCALES.flatMap((locale) =>
    getAllPosts(locale).map(articleEntry),
  )

  return [...staticEntries, ...articleEntries]
}
