import mammoth from 'mammoth'

export interface ParsedDocument {
  content: string
  metadata: {
    pageCount?: number
    title?: string
    author?: string
  }
}

/**
 * Parse a PDF file and extract text content
 * Using pdf-parse v1.x with dynamic import for Next.js compatibility
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // Dynamic import to avoid build issues with pdf-parse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import('pdf-parse')).default as any

  const data = await pdfParse(buffer)
  return {
    content: data.text,
    metadata: {
      pageCount: data.numpages,
      title: data.info?.Title,
      author: data.info?.Author,
    },
  }
}

/**
 * Parse a DOCX file and extract text content
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer })
  return {
    content: result.value,
    metadata: {},
  }
}

/**
 * Parse a plain text file
 */
export function parseTxt(buffer: Buffer): ParsedDocument {
  return {
    content: buffer.toString('utf-8'),
    metadata: {},
  }
}

/**
 * Parse a document based on its MIME type
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedDocument> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePdf(buffer)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return parseDocx(buffer)
    case 'text/plain':
      return parseTxt(buffer)
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

/**
 * Get supported MIME types
 */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType)
}
