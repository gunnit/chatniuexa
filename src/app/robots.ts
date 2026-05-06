import type { MetadataRoute } from 'next'

const PRIVATE_PATHS = ['/dashboard', '/admin', '/api', '/c/']

const ALLOW_BOTS = [
  // Search retrieval (drives citations in AI answers)
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
  // Training/grounding crawlers — allowed because being cited by AI assistants
  // is the explicit business goal (this site promotes AEO/GEO).
  'GPTBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'anthropic-ai',
  'Meta-ExternalAgent',
]

const BLOCK_BOTS = [
  // Bots that scrape aggressively without offering visibility benefit
  'Bytespider',
  'Meta-ExternalFetcher',
  'Amazonbot',
  'FacebookBot',
  'Diffbot',
  'cohere-ai',
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
