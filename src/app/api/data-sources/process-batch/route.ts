import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { crawlUrl } from '@/lib/documents/crawler'
import { processUrl } from '@/lib/documents/processor'

async function processDataSource(dataSourceId: string): Promise<{ id: string; success: boolean; error?: string }> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  })

  if (!dataSource || dataSource.type !== 'URL' || !dataSource.sourceUrl) {
    return { id: dataSourceId, success: false, error: 'Invalid data source' }
  }

  try {
    // Crawl the URL
    const crawlResult = await crawlUrl(dataSource.sourceUrl)

    // Update name if we got a better title
    if (crawlResult.title && crawlResult.title !== dataSource.sourceUrl) {
      await prisma.dataSource.update({
        where: { id: dataSourceId },
        data: { name: crawlResult.title },
      })
    }

    // Process the content (chunk and embed)
    await processUrl({
      dataSourceId,
      url: dataSource.sourceUrl,
      content: crawlResult.content,
      title: crawlResult.title,
    })

    return { id: dataSourceId, success: true }
  } catch (error) {
    console.error(`Error processing ${dataSourceId}:`, error)

    // Mark as failed
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return { id: dataSourceId, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    const { dataSourceIds } = await request.json()

    if (!dataSourceIds || !Array.isArray(dataSourceIds) || dataSourceIds.length === 0) {
      return NextResponse.json({ error: 'dataSourceIds array is required' }, { status: 400 })
    }

    // Verify all data sources belong to this tenant and are pending
    const dataSources = await prisma.dataSource.findMany({
      where: {
        id: { in: dataSourceIds },
        tenantId: tenantId,
        status: 'PENDING',
      },
    })

    if (dataSources.length === 0) {
      return NextResponse.json({ error: 'No pending data sources found' }, { status: 404 })
    }

    // Process URLs in background - don't await all
    // Start processing and return immediately
    const dataSourceIdsToProcess = dataSources.map(ds => ds.id)

    // Fire and forget - process in background
    Promise.allSettled(
      dataSourceIdsToProcess.map(id => processDataSource(id))
    ).catch(console.error)

    return NextResponse.json({
      success: true,
      message: `Processing ${dataSources.length} URLs in background`,
      processingCount: dataSources.length,
    })
  } catch (error) {
    console.error('Error in batch processing:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process batch' },
      { status: 500 }
    )
  }
}
