import FirecrawlApp from '@mendable/firecrawl-js'
import { logger } from '@/lib/logger'
import { assertSafePublicUrl, UnsafeUrlError } from '@/lib/url-safety'

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
  // SSRF protection: reject URLs that resolve to private/loopback addresses
  // before either crawler path touches them.
  try {
    await assertSafePublicUrl(url)
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw new Error(`Refusing to fetch URL: ${err.message}`)
    }
    throw err
  }

  // Try Firecrawl first if API key is available
  if (process.env.FIRECRAWL_API_KEY) {
    return crawlWithFirecrawl(url)
  }

  // Fallback to basic fetch
  return crawlWithFetch(url)
}

async function crawlWithFirecrawl(url: string): Promise<CrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY

  if (!apiKey) {
    throw new Error('Firecrawl error: FIRECRAWL_API_KEY environment variable is not set')
  }

  const app = new FirecrawlApp({ apiKey })

  try {
    // SDK returns Document directly with markdown, metadata properties
    // Throws an error on failure (doesn't return success: false)
    const doc = await app.scrape(url, {
      formats: ['markdown'],
    })

    return {
      content: doc.markdown || '',
      title: doc.metadata?.title || url,
      url: doc.metadata?.sourceURL || url,
    }
  } catch (error) {
    logger.error('Firecrawl exception', {
      url,
      error: error instanceof Error ? error.message : 'unknown',
    })
    if (error instanceof Error) {
      throw new Error(`Firecrawl error: ${error.message}`)
    }
    throw new Error('Firecrawl error: unknown failure')
  }
}

async function crawlWithFetch(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'chataziendale-bot/1.0',
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
