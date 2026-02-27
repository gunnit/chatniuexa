import type { MetadataRoute } from 'next'

const locales = ['en', 'it'] as const
const defaultLocale = 'en'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://chataziendale.onrender.com'

  function entry(
    path: string,
    changeFrequency: 'weekly' | 'monthly' | 'yearly',
    priority: number,
  ): MetadataRoute.Sitemap[number] {
    const url = `${baseUrl}/${defaultLocale}${path}`
    return {
      url,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`]),
        ),
      },
    }
  }

  return [
    entry('', 'weekly', 1),
    entry('/login', 'monthly', 0.5),
    entry('/signup', 'monthly', 0.7),
    entry('/privacy', 'yearly', 0.3),
    entry('/terms', 'yearly', 0.3),
  ]
}
