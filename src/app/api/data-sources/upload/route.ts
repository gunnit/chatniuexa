import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'
import { isSupportedMimeType } from '@/lib/documents/parser'
import { processFile } from '@/lib/documents/processor'

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// POST /api/data-sources/upload - Upload a file
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      console.warn('Vercel Blob not configured, using placeholder URL')
      fileUrl = `local://${file.name}`
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
      console.error('Error processing file:', processError)
      // Status is already set to FAILED by processFile
    }

    // Fetch updated data source
    const updatedDataSource = await prisma.dataSource.findUnique({
      where: { id: dataSource.id },
    })

    return NextResponse.json({ dataSource: updatedDataSource }, { status: 201 })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
