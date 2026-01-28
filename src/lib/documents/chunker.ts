export interface TextChunk {
  content: string
  index: number
  tokens: number
}

// Approximate tokens per character (for English text)
const CHARS_PER_TOKEN = 4

/**
 * Estimate token count for a string
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Split text into chunks with overlap
 *
 * @param text - The text to chunk
 * @param maxTokens - Maximum tokens per chunk (default: 500)
 * @param overlap - Number of overlapping tokens between chunks (default: 50)
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): TextChunk[] {
  const chunks: TextChunk[] = []
  const maxChars = maxTokens * CHARS_PER_TOKEN
  const overlapChars = overlap * CHARS_PER_TOKEN

  // Clean up the text
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!cleanText) {
    return []
  }

  // Split by paragraphs first
  const paragraphs = cleanText.split(/\n\n+/)

  let currentChunk = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed max, save current chunk and start new
    if (currentChunk && (currentChunk.length + paragraph.length + 2) > maxChars) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokens: estimateTokens(currentChunk),
      })
      chunkIndex++

      // Start new chunk with overlap from previous
      if (overlapChars > 0 && currentChunk.length > overlapChars) {
        currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + paragraph
      } else {
        currentChunk = paragraph
      }
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph
    }

    // If paragraph itself is too long, split it
    while (currentChunk.length > maxChars) {
      // Find a good breaking point (sentence end or word boundary)
      let breakPoint = maxChars
      const searchStart = Math.floor(maxChars * 0.8)

      // Try to break at sentence end
      const sentenceEnd = currentChunk.lastIndexOf('. ', breakPoint)
      if (sentenceEnd > searchStart) {
        breakPoint = sentenceEnd + 1
      } else {
        // Try to break at word boundary
        const wordEnd = currentChunk.lastIndexOf(' ', breakPoint)
        if (wordEnd > searchStart) {
          breakPoint = wordEnd
        }
      }

      chunks.push({
        content: currentChunk.slice(0, breakPoint).trim(),
        index: chunkIndex,
        tokens: estimateTokens(currentChunk.slice(0, breakPoint)),
      })
      chunkIndex++

      // Keep overlap
      const remainStart = Math.max(0, breakPoint - overlapChars)
      currentChunk = currentChunk.slice(remainStart).trim()
    }
  }

  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokens: estimateTokens(currentChunk),
    })
  }

  return chunks
}
