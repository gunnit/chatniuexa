import type { MetadataRoute } from 'next'

const PRIVATE_PATHS = ['/dashboard', '/admin', '/api', '/c/']

const ALLOW_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Bingbot',
  'Googlebot',
  'Applebot',
  'DuckDuckBot',
  'YandexBot',
]

const BLOCK_BOTS = [
  'GPTBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'Amazonbot',
  'FacebookBot',
  'Diffbot',
  'cohere-ai',
  'anthropic-ai',
]

export default function robots(): MetadataRoute.Robots {
  const allowRules = ALLOW_BOTS.map((userAgent) => ({
    userAgent,
    allow: '/',
    disallow: PRIVATE_PATHS,
  }))

  const blockRules = BLOCK_BOTS.map((userAgent) => ({
    userAgent,
    disallow: '/',
  }))

  const fallbackRule = {
    userAgent: '*',
    allow: '/',
    disallow: PRIVATE_PATHS,
  }

  return {
    rules: [fallbackRule, ...allowRules, ...blockRules],
    sitemap: 'https://chataziendale.it/sitemap.xml',
    host: 'https://chataziendale.it',
  }
}
