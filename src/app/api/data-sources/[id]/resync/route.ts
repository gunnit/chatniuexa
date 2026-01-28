import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/data-sources/[id]/resync - Re-sync a URL data source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership and type
  const dataSource = await prisma.dataSource.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
  })

  if (!dataSource) {
    return NextResponse.json({ error: 'Data source not found' }, { status: 404 })
  }

  if (dataSource.type !== 'URL') {
    return NextResponse.json(
      { error: 'Only URL data sources can be re-synced' },
      { status: 400 }
    )
  }

  // Delete existing documents (cascades to chunks)
  await prisma.document.deleteMany({
    where: { dataSourceId: id },
  })

  // Reset status to pending
  await prisma.dataSource.update({
    where: { id },
    data: {
      status: 'PENDING',
      error: null,
    },
  })

  // TODO: Trigger re-crawl in background

  return NextResponse.json({
    success: true,
    message: 'Re-sync started. The URL will be crawled again.',
  })
}
