import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/data-sources/[id] - Get a specific data source
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const dataSource = await prisma.dataSource.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
    include: {
      documents: {
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: {
            select: { chunks: true },
          },
        },
      },
    },
  })

  if (!dataSource) {
    return NextResponse.json({ error: 'Data source not found' }, { status: 404 })
  }

  return NextResponse.json({ dataSource })
}

// DELETE /api/data-sources/[id] - Delete a data source
export async function DELETE(
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

  // Delete data source (cascades to documents and chunks)
  await prisma.dataSource.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
