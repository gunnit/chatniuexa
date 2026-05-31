import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateQueryEmbedding, prepareStreamingContextWithEmbedding, generateStreamingChatResponse } from '@/lib/chat/rag'
import { buildChatbotTools } from '@/lib/chat/tools'
import { generateStreamingChatResponseWithTools } from '@/lib/chat/responses'
import { logUsage } from '@/lib/usage'
import { getCorsHeaders } from '@/lib/cors'
import { isChatbotOriginAllowed } from '@/lib/origin'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const chatSchema = z.object({
  chatbotId: z.string().min(1, 'Chatbot ID is required'),
  sessionId: z.string().min(1, 'Session ID is required'),
  message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
})

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST /api/chat/stream - Send a message and get a streaming response
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getCorsHeaders(origin) }
    )
  }

  try {
    const body = await request.json()
    const { chatbotId, sessionId, message } = chatSchema.parse(body)

    // Fetch chatbot first so we can verify origin before doing any expensive work
    const chatbot = await prisma.chatbot.findUnique({ where: { id: chatbotId } })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      )
    }

    const corsHeaders = getCorsHeaders(origin, 'POST, OPTIONS', chatbot.allowedDomains)

    if (!isChatbotOriginAllowed({ origin, referer, allowedDomains: chatbot.allowedDomains, chatbotId: chatbot.id })) {
      return NextResponse.json(
        { error: 'Origin not allowed for this chatbot' },
        { status: 403, headers: corsHeaders }
      )
    }

    // Phase 2: Fire remaining independent work in parallel
    const embeddingPromise = generateQueryEmbedding(message)
    const conversationPromise = getOrCreateConversation(chatbotId, sessionId)
    const usagePromise = logUsage({ tenantId: chatbot.tenantId, chatbotId: chatbot.id, type: 'chat', tokens: 500, model: chatbot.model })
    const ragPromise = embeddingPromise.then((embedding) =>
      prepareStreamingContextWithEmbedding(chatbot.tenantId, embedding, { userMessage: message }),
    )
    // Build the bot's tool set (web search / MCP) in parallel; [] for non-tool bots.
    const toolsPromise = buildChatbotTools(chatbot)

    const [conversation, usageCheck, ragResult, tools] = await Promise.all([
      conversationPromise,
      usagePromise,
      ragPromise,
      toolsPromise,
    ])

    if (!usageCheck?.allowed) {
      return NextResponse.json(
        { error: usageCheck?.reason || 'Usage limit exceeded' },
        { status: 429, headers: corsHeaders }
      )
    }

    const { context, streamingContext } = ragResult

    // Build conversation history
    const history = conversation.messages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    }))

    // Fire-and-forget user message save (don't block streaming)
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    }).catch((err) => console.error('Failed to save user message:', err))

    // Generate streaming response — tool-enabled bots stream via the Responses
    // API (same SSE shape); everyone else uses the unchanged Chat Completions
    // streamer.
    const stream = tools.length > 0
      ? await generateStreamingChatResponseWithTools(context, message, history, {
          systemPrompt: chatbot.systemPrompt || undefined,
          model: chatbot.model,
          tools,
        })
      : await generateStreamingChatResponse(context, message, history, {
          systemPrompt: chatbot.systemPrompt || undefined,
          model: chatbot.model,
        })

    // Create a TransformStream to capture the full response for saving
    let fullContent = ''
    let savedMessageId: string | null = null
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // Pass through the chunk
        controller.enqueue(chunk)

        // Decode and capture content
        const text = new TextDecoder().decode(chunk)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                fullContent += data.content
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      },
      async flush(controller) {
        // Save the assistant message after stream completes.
        // Errors here must NOT be re-thrown into controller.error — the client
        // already received the streamed content; failing the stream now would
        // leave them with a rendered answer that's missing from history.
        if (!fullContent) return
        try {
          const savedMessage = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'ASSISTANT',
              content: fullContent,
              sources: streamingContext.sources as object[],
            },
          })
          savedMessageId = savedMessage.id
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ messageId: savedMessageId })}\n\n`))
        } catch (err) {
          logger.error('Failed to persist assistant message', { error: String(err) })
        }
      },
    })

    // Pipe through transform and return
    const responseStream = stream.pipeThrough(transformStream)

    // Send metadata as first event, then stream content
    const encoder = new TextEncoder()
    const metadataStream = new ReadableStream({
      start(controller) {
        // Send metadata (sources, confidence) as first event
        const metadata = {
          type: 'metadata',
          sources: streamingContext.sources,
          confidence: streamingContext.confidence,
          confidenceScore: streamingContext.confidenceScore,
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))
        controller.close()
      },
    })

    // Combine metadata stream with content stream
    const combinedStream = new ReadableStream({
      async start(controller) {
        // First send metadata
        const metadataReader = metadataStream.getReader()
        while (true) {
          const { done, value } = await metadataReader.read()
          if (done) break
          controller.enqueue(value)
        }

        // Then send content
        const contentReader = responseStream.getReader()
        while (true) {
          const { done, value } = await contentReader.read()
          if (done) break
          controller.enqueue(value)
        }

        controller.close()
      },
    })

    return new Response(combinedStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    const fallbackHeaders = getCorsHeaders(origin)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400, headers: fallbackHeaders }
      )
    }
    logger.error('Streaming chat error', { error: String(error) })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: fallbackHeaders }
    )
  }
}

async function getOrCreateConversation(chatbotId: string, sessionId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { chatbotId, sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' as const },
        take: 20,
      },
    },
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: { chatbotId, sessionId },
    include: { messages: true },
  })
}
