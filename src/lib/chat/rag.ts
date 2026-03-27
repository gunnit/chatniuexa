import { prisma } from '@/lib/db'
import { getOpenAI, EMBEDDING_MODEL } from '@/lib/openai'
import { searchSimilarChunks } from '@/lib/documents/processor'

interface Source {
  chunkId: string
  content: string
  similarity: number
  documentTitle: string
  dataSourceName: string
  sourceUrl?: string
}

interface ChatResponse {
  content: string
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
}

interface StreamingChatContext {
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that ONLY answers questions using the provided context from the knowledge base.

IMPORTANT RULES:
- You must ONLY use information from the provided context to answer questions.
- If the context does not contain information relevant to the user's question, politely decline to answer and suggest the user ask about topics covered by your knowledge base.
- NEVER answer questions using your general training knowledge. Even if you know the answer, do not provide it unless it is supported by the provided context.
- Do not answer off-topic questions such as recipes, trivia, coding help, math problems, or anything unrelated to the context provided.
- You may respond to basic greetings and pleasantries conversationally.

Always be concise and accurate. When you use information from the context, naturally incorporate it into your response.

Format your responses using markdown:
- Use **bold** for key terms, important names, and highlights
- Use bullet points or numbered lists when listing multiple items
- Keep paragraphs short and scannable`

const FORMATTING_ADDENDUM = `\nFormat your responses using markdown: use **bold** for key terms and important information, use bullet points for lists, and keep paragraphs short.`

const SCOPE_GUARDRAIL = `\n\nIMPORTANT: You must ONLY answer questions based on the provided context above. If no relevant context was provided, or if the user's question is not related to the context, politely let them know you can only help with topics covered by your knowledge base. Never use your general training knowledge to answer questions.`

/**
 * Generate a RAG-based chat response
 */
export async function generateChatResponse(
  tenantId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: {
    systemPrompt?: string
    model?: string
    maxSources?: number
    minSimilarity?: number
  } = {}
): Promise<ChatResponse> {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = 'gpt-5-mini',
    maxSources = 5,
    minSimilarity = 0.2, // Lowered to 0.2 for multilingual content recall
  } = options

  const openai = getOpenAI()

  // Generate embedding for the user's query
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: userMessage,
  })
  const queryEmbedding = embeddingResponse.data[0].embedding

  // Search for relevant chunks
  const relevantChunks = await searchSimilarChunks(
    tenantId,
    queryEmbedding,
    maxSources,
    minSimilarity
  )

  // Get document/datasource info for citations - batch query to avoid N+1
  const sources: Source[] = []
  const contextParts: string[] = []

  if (relevantChunks.length > 0) {
    const documentIds = [...new Set(relevantChunks.map(chunk => chunk.documentId))]
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      include: {
        dataSource: {
          select: { name: true, sourceUrl: true },
        },
      },
    })
    const documentMap = new Map(documents.map(doc => [doc.id, doc]))

    for (const chunk of relevantChunks) {
      const document = documentMap.get(chunk.documentId)

      if (document) {
        sources.push({
          chunkId: chunk.id,
          content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
          similarity: chunk.similarity,
          documentTitle: document.title || 'Untitled',
          dataSourceName: document.dataSource.name,
          sourceUrl: document.dataSource.sourceUrl || undefined,
        })

        contextParts.push(
          `[Source: ${document.title || document.dataSource.name}]\n${chunk.content}`
        )
      }
    }
  }

  // Deduplicate sources — keep highest similarity per document title
  const deduplicatedSources = deduplicateSources(sources)

  // Build context section
  const context = contextParts.length > 0
    ? `Here is relevant information from the knowledge base:\n\n${contextParts.join('\n\n---\n\n')}`
    : 'No relevant information was found in the knowledge base. You MUST let the user know that their question is not covered by your knowledge base. Do NOT attempt to answer using your own knowledge. Instead, politely suggest they ask about topics that your knowledge base covers.'

  // Append formatting instructions if custom prompt doesn't already mention markdown/bold
  const promptWithFormatting = systemPrompt === DEFAULT_SYSTEM_PROMPT || /\*\*bold\*\*|markdown/i.test(systemPrompt)
    ? systemPrompt
    : systemPrompt + FORMATTING_ADDENDUM
  const finalPrompt = promptWithFormatting + SCOPE_GUARDRAIL

  // Build messages for the LLM
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${finalPrompt}\n\n${context}`,
    },
  ]

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  })

  // Generate response
  const completion = await openai.chat.completions.create({
    model,
    messages,
    max_completion_tokens: 4000,
  })

  const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'

  // Calculate confidence based on source quality
  const confidenceScore = calculateConfidence(deduplicatedSources)
  const confidence = confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.4 ? 'medium' : 'low'

  return {
    content: responseContent,
    sources: deduplicatedSources,
    confidence,
    confidenceScore,
  }
}

/**
 * Deduplicate sources — keep the highest-similarity entry per document title
 */
function deduplicateSources(sources: Source[]): Source[] {
  const bestByTitle = new Map<string, Source>()
  for (const source of sources) {
    const existing = bestByTitle.get(source.documentTitle)
    if (!existing || source.similarity > existing.similarity) {
      bestByTitle.set(source.documentTitle, source)
    }
  }
  return Array.from(bestByTitle.values())
}

/**
 * Calculate confidence score based on source relevance
 */
function calculateConfidence(sources: Source[]): number {
  if (sources.length === 0) {
    return 0.15 // Low confidence when no sources found
  }

  // Use the best source's similarity as the primary signal
  const bestSimilarity = Math.max(...sources.map(s => s.similarity))

  // Small bonus for having multiple relevant sources
  const sourceCountBonus = Math.min((sources.length - 1) * 0.03, 0.1)

  return Math.min(bestSimilarity + sourceCountBonus, 1)
}

/**
 * Generate embedding for a user query (can be started early for parallelization)
 */
export async function generateQueryEmbedding(userMessage: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: userMessage,
  })
  return response.data[0].embedding
}

/**
 * Prepare streaming context using a pre-computed embedding
 */
export async function prepareStreamingContextWithEmbedding(
  tenantId: string,
  queryEmbedding: number[],
  options: {
    maxSources?: number
    minSimilarity?: number
  } = {}
): Promise<{ context: string; streamingContext: StreamingChatContext }> {
  const { maxSources = 5, minSimilarity = 0.2 } = options

  // Search for relevant chunks
  const relevantChunks = await searchSimilarChunks(
    tenantId,
    queryEmbedding,
    maxSources,
    minSimilarity
  )

  // Get document/datasource info for citations - batch query to avoid N+1
  const sources: Source[] = []
  const contextParts: string[] = []

  if (relevantChunks.length > 0) {
    const documentIds = [...new Set(relevantChunks.map(chunk => chunk.documentId))]
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      include: {
        dataSource: {
          select: { name: true, sourceUrl: true },
        },
      },
    })
    const documentMap = new Map(documents.map(doc => [doc.id, doc]))

    for (const chunk of relevantChunks) {
      const document = documentMap.get(chunk.documentId)

      if (document) {
        sources.push({
          chunkId: chunk.id,
          content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
          similarity: chunk.similarity,
          documentTitle: document.title || 'Untitled',
          dataSourceName: document.dataSource.name,
          sourceUrl: document.dataSource.sourceUrl || undefined,
        })

        contextParts.push(
          `[Source: ${document.title || document.dataSource.name}]\n${chunk.content}`
        )
      }
    }
  }

  // Deduplicate sources — keep highest similarity per document title
  const deduplicatedSources = deduplicateSources(sources)

  // Build context section
  const context = contextParts.length > 0
    ? `Here is relevant information from the knowledge base:\n\n${contextParts.join('\n\n---\n\n')}`
    : 'No relevant information was found in the knowledge base. You MUST let the user know that their question is not covered by your knowledge base. Do NOT attempt to answer using your own knowledge. Instead, politely suggest they ask about topics that your knowledge base covers.'

  // Calculate confidence
  const confidenceScore = calculateConfidence(deduplicatedSources)
  const confidence = confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.4 ? 'medium' : 'low'

  return {
    context,
    streamingContext: {
      sources: deduplicatedSources,
      confidence,
      confidenceScore,
    },
  }
}

/**
 * Prepare context for streaming chat (convenience wrapper)
 */
export async function prepareStreamingContext(
  tenantId: string,
  userMessage: string,
  options: {
    maxSources?: number
    minSimilarity?: number
  } = {}
): Promise<{ context: string; streamingContext: StreamingChatContext }> {
  const queryEmbedding = await generateQueryEmbedding(userMessage)
  return prepareStreamingContextWithEmbedding(tenantId, queryEmbedding, options)
}

/**
 * Generate streaming chat response
 */
export async function generateStreamingChatResponse(
  context: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: {
    systemPrompt?: string
    model?: string
  } = {}
): Promise<ReadableStream<Uint8Array>> {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = 'gpt-5-mini',
  } = options

  const openai = getOpenAI()

  // Append formatting instructions if custom prompt doesn't already mention markdown/bold
  const promptWithFormatting = systemPrompt === DEFAULT_SYSTEM_PROMPT || /\*\*bold\*\*|markdown/i.test(systemPrompt)
    ? systemPrompt
    : systemPrompt + FORMATTING_ADDENDUM
  const finalPrompt = promptWithFormatting + SCOPE_GUARDRAIL

  // Build messages for the LLM
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${finalPrompt}\n\n${context}`,
    },
  ]

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  })

  // Generate streaming response
  const stream = await openai.chat.completions.create({
    model,
    messages,
    max_completion_tokens: 4000,
    stream: true,
  })

  // Convert OpenAI stream to web ReadableStream
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            // Send as Server-Sent Event format
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
          }
        }
        // Signal end of stream
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
