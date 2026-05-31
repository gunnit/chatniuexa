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
  // Clear any existing documents/chunks from a prior failed run so we never
  // leave half-embedded chunks orphaned in the search index.
  await prisma.document.deleteMany({ where: { dataSourceId } })

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
        await prisma.$executeRawUnsafe(
          `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(',')}]`,
          chunkRecord.id
        )
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
  // Clear any partial output from a prior failed run.
  await prisma.document.deleteMany({ where: { dataSourceId } })

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
        await prisma.$executeRawUnsafe(
          `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(',')}]`,
          chunkRecord.id
        )
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

  return results.map((r) => ({
    id: r.id,
    content: r.content,
    similarity: r.similarity,
    documentId: r.documentId,
    dataSourceId: r.dataSourceId,
  }))
}

/**
 * Keyword (substring) search across chunks for a tenant. Used as a hybrid
 * fallback so single-name brand lookups (e.g. "Ferrari", "Belluzzo") reliably
 * surface every chunk whose content contains the term verbatim, even when the
 * embedding similarity ranks those chunks below other candidates.
 */
export async function searchChunksByKeywords(
  tenantId: string,
  keywords: string[],
  limit: number = 20
): Promise<
  Array<{
    id: string
    content: string
    similarity: number
    documentId: string
    dataSourceId: string
  }>
> {
  const validKeywords = keywords
    .map((k) => k.trim())
    .filter((k) => k.length >= 3)
  if (validKeywords.length === 0) return []

  const orClauses = validKeywords.map((_, i) => `c.content ILIKE $${i + 3}`).join(' OR ')
  const likePatterns = validKeywords.map((k) => `%${k}%`)

  const sql = `
    SELECT
      c.id,
      c.content,
      0.5 as similarity,
      c."documentId",
      d."dataSourceId"
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    JOIN data_sources ds ON d."dataSourceId" = ds.id
    WHERE ds."tenantId" = $1
      AND ds.status = 'COMPLETE'
      AND c.embedding IS NOT NULL
      AND (${orClauses})
    LIMIT $2
  `

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      content: string
      similarity: number
      documentId: string
      dataSourceId: string
    }>
  >(sql, tenantId, limit, ...likePatterns)

  return results.map((r) => ({
    id: r.id,
    content: r.content,
    similarity: r.similarity,
    documentId: r.documentId,
    dataSourceId: r.dataSourceId,
  }))
}

/**
 * Fetch EVERY chunk that belongs to a structured member-directory document for a
 * tenant. A directory document is identified by the per-member `[Sector: ...]`
 * marker that the directory ingest format stamps on each company line.
 *
 * Returned in document + chunk order so sector groupings stay contiguous and
 * COMPLETE. This is the deterministic backbone of directory/category recall:
 * for any "list partners in <sector>" / "<service> firms" style query we inject
 * the whole directory, so a member can never be silently dropped just because
 * its chunk ranked below the vector-similarity cap or threshold. With ~40-50
 * chunks (~18K tokens) for a 175-member directory this is cheap.
 *
 * Tenants without a directory-format document get an empty array, so callers
 * transparently fall back to ordinary vector + keyword retrieval.
 */
export async function getDirectoryChunks(
  tenantId: string
): Promise<
  Array<{
    id: string
    content: string
    similarity: number
    documentId: string
    dataSourceId: string
  }>
> {
  // `[` is not a LIKE metacharacter in Postgres, so the literal pattern matches
  // the `[Sector:` tag verbatim. Filtering on the full document content (not the
  // chunk) ensures we also pull the directory's header / sector-synonym preamble
  // chunks, which give the model the taxonomy it needs to group results.
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
      0.6 as similarity,
      c."documentId",
      d."dataSourceId"
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    JOIN data_sources ds ON d."dataSourceId" = ds.id
    WHERE ds."tenantId" = $1
      AND ds.status = 'COMPLETE'
      AND c.embedding IS NOT NULL
      AND d.content ILIKE '%[Sector:%'
    ORDER BY c."documentId", c."chunkIndex"
    `,
    tenantId
  )

  return results.map((r) => ({
    id: r.id,
    content: r.content,
    similarity: r.similarity,
    documentId: r.documentId,
    dataSourceId: r.dataSourceId,
  }))
}
