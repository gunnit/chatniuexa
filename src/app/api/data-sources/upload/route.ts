import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'
import { isSupportedMimeType } from '@/lib/documents/parser'
import { processFile } from '@/lib/documents/processor'
import { logUsage } from '@/lib/usage'
import { logger } from '@/lib/logger'

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// POST /api/data-sources/upload - Upload a file
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Plan gate — file ingestion runs embeddings which cost real money per chunk.
  // Free tier may not upload files; URL crawling is also gated separately.
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { plan: true },
  })
  if (!tenant || tenant.plan === 'free') {
    return NextResponse.json(
      { error: 'PLAN_UPGRADE_REQUIRED' },
      { status: 403 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!isSupportedMimeType(file.type)) {
      return NextResponse.json(
        {
          error: 'Unsupported file type. Supported: PDF, DOCX, DOC, TXT',
        },
        { status: 400 }
      )
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to Vercel Blob storage
    let fileUrl: string
    try {
      const blob = await put(`data-sources/${session.user.tenantId}/${file.name}`, buffer, {
        access: 'public',
        contentType: file.type,
      })
      fileUrl = blob.url
    } catch (blobError) {
      // If Vercel Blob is not configured, store URL as placeholder
      logger.warn('Vercel Blob not configured, using placeholder URL', { error: String(blobError) })
      fileUrl = `local://${file.name}`
    }

    // Reserve embedding usage up front: rough heuristic of ~0.3 tokens/byte for
    // the source document, plus the embedding cost on the same volume.
    const estimatedTokens = Math.min(Math.ceil(file.size * 0.3), 200_000)
    const usage = await logUsage({
      tenantId: session.user.tenantId,
      type: 'embedding',
      tokens: estimatedTokens,
      model: 'text-embedding-3-small',
    })
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason || 'Usage limit exceeded' },
        { status: 429 }
      )
    }

    // Create data source record
    const dataSource = await prisma.dataSource.create({
      data: {
        tenantId: session.user.tenantId,
        type: 'FILE',
        status: 'PENDING',
        name: file.name,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl,
      },
    })

    // Process the file (parse, chunk, embed)
    // In production, this should be a background job
    try {
      await processFile({
        dataSourceId: dataSource.id,
        buffer,
        mimeType: file.type,
        fileName: file.name,
      })
    } catch (processError) {
      logger.error('Error processing file', { error: String(processError) })
      // Status is already set to FAILED by processFile
    }

    // Fetch updated data source
    const updatedDataSource = await prisma.dataSource.findUnique({
      where: { id: dataSource.id },
    })

    return NextResponse.json({ dataSource: updatedDataSource }, { status: 201 })
  } catch (error) {
    logger.error('Error uploading file', { error: String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
