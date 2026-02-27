import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import FirecrawlApp from '@mendable/firecrawl-js'

interface MapLink {
  url: string
  title?: string
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, limit = 100 } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 }
      )
    }

    const app = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY,
    })

    // Map the website using v1 API
    const result = await app.v1.mapUrl(url, {
      limit: Math.min(limit, 100),
    })

    // Check for success
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to map website' },
        { status: 500 }
      )
    }

    // Normalize links - v1 returns array of strings
    const links: MapLink[] = (result.links || []).map((link: string) => ({
      url: link,
      title: undefined,
      description: undefined,
    }))

    // Return the discovered URLs
    return NextResponse.json({
      success: true,
      urls: links,
      total: links.length,
    })
  } catch (error) {
    console.error('Error mapping website:', error)

    // Extract more detailed error message
    let errorMessage = 'Failed to map website'
    if (error instanceof Error) {
      errorMessage = error.message
      // Check for common Firecrawl errors
      if (error.message.includes('402') || error.message.includes('payment')) {
        errorMessage = 'Firecrawl API quota exceeded or payment required'
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = 'Invalid Firecrawl API key'
      } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
