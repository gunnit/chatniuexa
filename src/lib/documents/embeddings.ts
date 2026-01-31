import { openai, EMBEDDING_MODEL } from '@/lib/openai'

/**
 * Generate embeddings for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in batch
 * OpenAI allows up to 2048 inputs per request
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  console.log(`Generating embeddings for ${texts.length} chunks using ${EMBEDDING_MODEL}`)

  const BATCH_SIZE = 100 // Process in batches to avoid rate limits
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    console.log(`Processing embedding batch ${i / BATCH_SIZE + 1}, size: ${batch.length}`)
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    })

    // Sort by index to maintain order
    const sorted = response.data.sort((a, b) => a.index - b.index)
    embeddings.push(...sorted.map((d) => d.embedding))
    console.log(`Batch complete, got ${sorted.length} embeddings`)
  }

  console.log(`Generated ${embeddings.length} embeddings successfully`)
  return embeddings
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
