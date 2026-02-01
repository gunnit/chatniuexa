import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/debug/database - Check database state for RAG debugging
export async function GET() {
  try {
    // Check if pgvector extension is installed
    const extensionCheck = await prisma.$queryRawUnsafe<Array<{ extname: string; extversion: string }>>(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`
    )

    // Check if embedding column exists
    const columnCheck = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chunks' AND column_name = 'embedding'`
    )

    // Count chunks with and without embeddings
    const chunkStats = await prisma.$queryRawUnsafe<Array<{ total: bigint; with_embeddings: bigint }>>(
      `SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embeddings
      FROM chunks`
    )

    // Get sample of chunks
    const sampleChunks = await prisma.$queryRawUnsafe<Array<{ id: string; has_embedding: boolean; content_preview: string }>>(
      `SELECT
        id,
        embedding IS NOT NULL as has_embedding,
        LEFT(content, 100) as content_preview
      FROM chunks
      LIMIT 5`
    )

    // Check data sources status
    const dataSourceStats = await prisma.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
      `SELECT status, COUNT(*) as count FROM data_sources GROUP BY status`
    )

    return NextResponse.json({
      pgvector: {
        installed: extensionCheck.length > 0,
        version: extensionCheck[0]?.extversion || null,
      },
      embeddingColumn: {
        exists: columnCheck.length > 0,
        dataType: columnCheck[0]?.data_type || null,
      },
      chunks: {
        total: Number(chunkStats[0]?.total || 0),
        withEmbeddings: Number(chunkStats[0]?.with_embeddings || 0),
        samples: sampleChunks,
      },
      dataSources: dataSourceStats.map(s => ({
        status: s.status,
        count: Number(s.count),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Database check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'This might indicate pgvector is not installed or migration has not been applied',
      },
      { status: 500 }
    )
  }
}
