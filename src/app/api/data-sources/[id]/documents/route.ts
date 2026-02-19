import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { reprocessDocumentContent } from '@/lib/documents/processor'

// GET /api/data-sources/[id]/documents - Get documents with full content
export async function GET(
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

  const documents = await prisma.document.findMany({
    where: { dataSourceId: id },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      _count: {
        select: { chunks: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      updatedAt: d.updatedAt,
      chunkCount: d._count.chunks,
    })),
  })
}

const updateSchema = z.object({
  documentId: z.string().min(1),
  content: z.string().min(1).max(500_000),
})

// PUT /api/data-sources/[id]/documents - Update document content and re-process
export async function PUT(
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

  if (dataSource.status === 'PROCESSING') {
    return NextResponse.json(
      { error: 'Data source is currently processing. Please wait and try again.' },
      { status: 409 }
    )
  }

  let body
  try {
    body = updateSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Verify the document belongs to this data source
  const document = await prisma.document.findFirst({
    where: {
      id: body.documentId,
      dataSourceId: id,
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const { chunkCount } = await reprocessDocumentContent(body.documentId, body.content)

    const updated = await prisma.document.findUnique({
      where: { id: body.documentId },
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      document: {
        ...updated,
        chunkCount,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to re-process document' },
      { status: 500 }
    )
  }
}
