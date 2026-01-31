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
  const apiKey = process.env.FIRECRAWL_API_KEY

  // Log API key presence (not the key itself for security)
  console.log('Firecrawl API key configured:', apiKey ? `yes (${apiKey.substring(0, 5)}...)` : 'NO - MISSING!')

  if (!apiKey) {
    throw new Error('Firecrawl error: FIRECRAWL_API_KEY environment variable is not set')
  }

  const app = new FirecrawlApp({ apiKey })

  try {
    console.log('Calling Firecrawl scrapeUrl for:', url)
    const result = await app.scrapeUrl(url, {
      formats: ['markdown'],
    })

    console.log('Firecrawl response success:', result.success)

    if (!result.success) {
      console.error('Firecrawl scrape failed. Full response:', JSON.stringify(result, null, 2))
      const errorMessage = (result as { error?: string }).error || 'Scrape returned success=false'
      throw new Error(`Firecrawl error: ${errorMessage}`)
    }

    return {
      content: result.markdown || '',
      title: result.metadata?.title || url,
      url: result.metadata?.sourceURL || url,
    }
  } catch (error) {
    // Log full error for debugging
    console.error('Firecrawl exception for URL:', url)
    console.error('Error details:', error instanceof Error ? error.message : JSON.stringify(error))

    if (error instanceof Error) {
      throw new Error(`Firecrawl error: ${error.message}`)
    }
    throw new Error(`Firecrawl error: ${JSON.stringify(error)}`)
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
