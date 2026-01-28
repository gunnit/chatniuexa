import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })

    if (!profile?.tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const { urls } = await request.json()

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs array is required' }, { status: 400 })
    }

    if (urls.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 URLs allowed' }, { status: 400 })
    }

    // Validate all URLs
    for (const urlItem of urls) {
      try {
        new URL(urlItem.url)
      } catch {
        return NextResponse.json(
          { error: `Invalid URL: ${urlItem.url}` },
          { status: 400 }
        )
      }
    }

    // Create data sources for all selected URLs
    const dataSources = await prisma.$transaction(
      urls.map((urlItem: { url: string; title?: string }) =>
        prisma.dataSource.create({
          data: {
            tenantId: profile.tenantId,
            type: 'URL',
            name: urlItem.title || new URL(urlItem.url).pathname || urlItem.url,
            sourceUrl: urlItem.url,
            status: 'PENDING',
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      dataSources: dataSources.map((ds) => ({
        id: ds.id,
        name: ds.name,
        sourceUrl: ds.sourceUrl,
        status: ds.status,
      })),
      total: dataSources.length,
    })
  } catch (error) {
    console.error('Error importing URLs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import URLs' },
      { status: 500 }
    )
  }
}
