import FirecrawlApp from '@mendable/firecrawl-js'

interface CrawlResult {
  content: string
  title: string
  url: string
}

/**
 * Crawl a URL using Firecrawl
 * Falls back to basic fetch if Firecrawl is not configured
 */
export async function crawlUrl(url: string): Promise<CrawlResult> {
  // Try Firecrawl first if API key is available
  if (process.env.FIRECRAWL_API_KEY) {
    return crawlWithFirecrawl(url)
  }

  // Fallback to basic fetch
  return crawlWithFetch(url)
}

async function crawlWithFirecrawl(url: string): Promise<CrawlResult> {
  const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  })

  const result = await app.scrape(url, {
    formats: ['markdown'],
  }) as { success: boolean; markdown?: string; metadata?: { title?: string; sourceURL?: string }; error?: string }

  if (!result.success) {
    throw new Error(`Firecrawl error: ${result.error || 'Unknown error'}`)
  }

  return {
    content: result.markdown || '',
    title: result.metadata?.title || url,
    url: result.metadata?.sourceURL || url,
  }
}

async function crawlWithFetch(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'niuexa-bot/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()

  // Extract title from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : url

  // Simple HTML to text conversion
  const content = htmlToText(html)

  return {
    content,
    title,
    url,
  }
}

/**
 * Simple HTML to text converter
 */
function htmlToText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')

  // Remove HTML tags but keep content
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}
