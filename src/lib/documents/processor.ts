import { prisma } from '@/lib/db'
import { parseDocument } from './parser'
import { chunkText } from './chunker'
import { generateEmbeddings } from './embeddings'
import { EMBEDDING_DIMENSIONS } from '@/lib/openai'

interface ProcessFileInput {
  dataSourceId: string
  buffer: Buffer
  mimeType: string
  fileName: string
}

interface ProcessUrlInput {
  dataSourceId: string
  url: string
  content: string
  title?: string
}

/**
 * Process a file data source: parse, chunk, embed, and store
 */
export async function processFile({
  dataSourceId,
  buffer,
  mimeType,
  fileName,
}: ProcessFileInput): Promise<void> {
  try {
    // Update status to processing
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: { status: 'PROCESSING' },
    })

    // Parse the document
    const parsed = await parseDocument(buffer, mimeType)

    // Create document record
    const document = await prisma.document.create({
      data: {
        dataSourceId,
        title: parsed.metadata.title || fileName,
        content: parsed.content,
        metadata: parsed.metadata,
      },
    })

    // Chunk the content
    const chunks = chunkText(parsed.content)

    if (chunks.length > 0) {
      // Generate embeddings for all chunks
      const embeddings = await generateEmbeddings(chunks.map((c) => c.content))

      // Store chunks (without embeddings first - Prisma doesn't support vector type)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = embeddings[i]

        // Create chunk
        const chunkRecord = await prisma.chunk.create({
          data: {
            documentId: document.id,
            content: chunk.content,
            chunkIndex: chunk.index,
            tokens: chunk.tokens,
          },
        })

        // Store embedding using raw SQL (pgvector)
        try {
          const result = await prisma.$executeRawUnsafe(
            `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
            `[${embedding.join(',')}]`,
            chunkRecord.id
          )
          console.log(`Stored embedding for chunk ${chunkRecord.id}, result: ${result}`)
        } catch (embeddingError) {
          console.error(`Failed to store embedding for chunk ${chunkRecord.id}:`, embeddingError)
          throw new Error(`Failed to store embedding: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}. Make sure pgvector extension is installed.`)
        }
      }
    }

    // Mark as complete
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'COMPLETE',
        lastSyncAt: new Date(),
      },
    })
  } catch (error) {
    // Mark as failed
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    throw error
  }
}

/**
 * Process a URL data source (content already crawled)
 */
export async function processUrl({
  dataSourceId,
  url,
  content,
  title,
}: ProcessUrlInput): Promise<void> {
  try {
    // Update status to processing
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: { status: 'PROCESSING' },
    })

    // Create document record
    const document = await prisma.document.create({
      data: {
        dataSourceId,
        title: title || url,
        content,
        metadata: { sourceUrl: url },
      },
    })

    // Chunk the content
    const chunks = chunkText(content)

    if (chunks.length > 0) {
      // Generate embeddings for all chunks
      const embeddings = await generateEmbeddings(chunks.map((c) => c.content))

      // Store chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = embeddings[i]

        const chunkRecord = await prisma.chunk.create({
          data: {
            documentId: document.id,
            content: chunk.content,
            chunkIndex: chunk.index,
            tokens: chunk.tokens,
          },
        })

        // Store embedding using raw SQL (pgvector)
        try {
          const result = await prisma.$executeRawUnsafe(
            `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
            `[${embedding.join(',')}]`,
            chunkRecord.id
          )
          console.log(`Stored embedding for chunk ${chunkRecord.id}, result: ${result}`)
        } catch (embeddingError) {
          console.error(`Failed to store embedding for chunk ${chunkRecord.id}:`, embeddingError)
          throw new Error(`Failed to store embedding: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}. Make sure pgvector extension is installed.`)
        }
      }
    }

    // Mark as complete
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'COMPLETE',
        lastSyncAt: new Date(),
      },
    })
  } catch (error) {
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    throw error
  }
}

/**
 * Re-process a document with updated content: delete old chunks, re-chunk, re-embed
 */
export async function reprocessDocumentContent(
  documentId: string,
  newContent: string
): Promise<{ chunkCount: number }> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { dataSource: true },
  })

  if (!document) {
    throw new Error('Document not found')
  }

  const dataSourceId = document.dataSourceId

  try {
    // Mark as processing
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: { status: 'PROCESSING' },
    })

    // Update document content
    await prisma.document.update({
      where: { id: documentId },
      data: { content: newContent },
    })

    // Delete existing chunks for this document
    await prisma.chunk.deleteMany({
      where: { documentId },
    })

    // Re-chunk the new content
    const chunks = chunkText(newContent)
    let chunkCount = 0

    if (chunks.length > 0) {
      const embeddings = await generateEmbeddings(chunks.map((c) => c.content))

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = embeddings[i]

        const chunkRecord = await prisma.chunk.create({
          data: {
            documentId,
            content: chunk.content,
            chunkIndex: chunk.index,
            tokens: chunk.tokens,
          },
        })

        await prisma.$executeRawUnsafe(
          `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(',')}]`,
          chunkRecord.id
        )
      }
      chunkCount = chunks.length
    }

    // Mark as complete
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'COMPLETE',
        lastSyncAt: new Date(),
        error: null,
      },
    })

    return { chunkCount }
  } catch (error) {
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    throw error
  }
}

/**
 * Re-process a URL data source (delete existing and re-crawl)
 */
export async function resyncUrl(dataSourceId: string): Promise<void> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  })

  if (!dataSource || dataSource.type !== 'URL' || !dataSource.sourceUrl) {
    throw new Error('Invalid URL data source')
  }

  // Delete existing documents (cascades to chunks)
  await prisma.document.deleteMany({
    where: { dataSourceId },
  })

  // Reset status
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: {
      status: 'PENDING',
      error: null,
    },
  })

  // Trigger re-crawl (this would typically call the crawler)
  // For now, return and let the calling code handle crawling
}

/**
 * Search for similar chunks using vector similarity
 */
export async function searchSimilarChunks(
  tenantId: string,
  embedding: number[],
  limit: number = 5,
  minSimilarity: number = 0.2 // Lowered to 0.2 for multilingual content recall
): Promise<
  Array<{
    id: string
    content: string
    similarity: number
    documentId: string
    dataSourceId: string
  }>
> {
  const embeddingStr = `[${embedding.join(',')}]`

  // Debug: Count chunks for this tenant
  const chunkCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM chunks c
     JOIN documents d ON c."documentId" = d.id
     JOIN data_sources ds ON d."dataSourceId" = ds.id
     WHERE ds."tenantId" = $1 AND ds.status = 'COMPLETE'`,
    tenantId
  )
  const embeddingCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM chunks c
     JOIN documents d ON c."documentId" = d.id
     JOIN data_sources ds ON d."dataSourceId" = ds.id
     WHERE ds."tenantId" = $1 AND ds.status = 'COMPLETE' AND c.embedding IS NOT NULL`,
    tenantId
  )
  console.log(`RAG Search: tenant=${tenantId}, total chunks=${chunkCount[0]?.count}, with embeddings=${embeddingCount[0]?.count}, minSimilarity=${minSimilarity}`)

  // Debug: Show top 5 chunks with their actual similarity scores (no filter)
  const debugResults = await prisma.$queryRawUnsafe<Array<{ id: string; similarity: number; preview: string }>>(
    `SELECT c.id, 1 - (c.embedding <=> $1::vector) as similarity, LEFT(c.content, 100) as preview
     FROM chunks c
     JOIN documents d ON c."documentId" = d.id
     JOIN data_sources ds ON d."dataSourceId" = ds.id
     WHERE ds."tenantId" = $2 AND ds.status = 'COMPLETE' AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT 5`,
    embeddingStr,
    tenantId
  )
  console.log(`RAG Debug: Top 5 chunks by similarity (unfiltered):`, debugResults.map(r => ({ similarity: r.similarity?.toFixed(4), preview: r.preview?.substring(0, 50) })))

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      content: string
      similarity: number
      documentId: string
      dataSourceId: string
    }>
  >(
    `
    SELECT
      c.id,
      c.content,
      1 - (c.embedding <=> $1::vector) as similarity,
      c."documentId",
      d."dataSourceId"
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    JOIN data_sources ds ON d."dataSourceId" = ds.id
    WHERE ds."tenantId" = $2
      AND ds.status = 'COMPLETE'
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> $1::vector) >= $3
    ORDER BY c.embedding <=> $1::vector
    LIMIT $4
    `,
    embeddingStr,
    tenantId,
    minSimilarity,
    limit
  )

  console.log(`RAG Search results: found ${results.length} chunks`, results.map(r => ({ id: r.id, similarity: r.similarity, preview: r.content.substring(0, 50) })))

  return results.map((r) => ({
    id: r.id,
    content: r.content,
    similarity: r.similarity,
    documentId: r.documentId,
    dataSourceId: r.dataSourceId,
  }))
}
