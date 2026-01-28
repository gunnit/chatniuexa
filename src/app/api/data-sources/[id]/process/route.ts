import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { crawlUrl } from '@/lib/documents/crawler'
import { processUrl } from '@/lib/documents/processor'

// POST /api/data-sources/[id]/process - Process a URL data source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const dataSource = await prisma.dataSource.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
  })

  if (!dataSource) {
    return NextResponse.json({ error: 'Data source not found' }, { status: 404 })
  }

  if (dataSource.type !== 'URL' || !dataSource.sourceUrl) {
    return NextResponse.json(
      { error: 'Invalid data source type' },
      { status: 400 }
    )
  }

  if (dataSource.status === 'PROCESSING') {
    return NextResponse.json(
      { error: 'Already processing' },
      { status: 400 }
    )
  }

  try {
    // Crawl the URL
    const crawlResult = await crawlUrl(dataSource.sourceUrl)

    // Update name if we got a better title
    if (crawlResult.title && crawlResult.title !== dataSource.sourceUrl) {
      await prisma.dataSource.update({
        where: { id },
        data: { name: crawlResult.title },
      })
    }

    // Process the content (chunk and embed)
    await processUrl({
      dataSourceId: id,
      url: dataSource.sourceUrl,
      content: crawlResult.content,
      title: crawlResult.title,
    })

    // Fetch updated data source
    const updatedDataSource = await prisma.dataSource.findUnique({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      dataSource: updatedDataSource,
    })
  } catch (error) {
    console.error('Error processing URL:', error)

    // Mark as failed
    await prisma.dataSource.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
