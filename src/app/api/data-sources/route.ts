import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// GET /api/data-sources - List all data sources for the tenant
export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dataSources = await prisma.dataSource.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      name: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      sourceUrl: true,
      error: true,
      lastSyncAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ dataSources })
}

// POST /api/data-sources - Create a new data source (URL type)
const createUrlSchema = z.object({
  url: z.string().url('Invalid URL'),
  name: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { url, name } = createUrlSchema.parse(body)

    // Create data source record
    const dataSource = await prisma.dataSource.create({
      data: {
        tenantId: session.user.tenantId,
        type: 'URL',
        status: 'PENDING',
        name: name || url,
        sourceUrl: url,
      },
    })

    // TODO: Trigger URL crawling (could use a background job)
    // For now, we'll process it synchronously in a separate endpoint

    return NextResponse.json({ dataSource }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating data source:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
