import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { prepareStreamingContext, generateStreamingChatResponse } from '@/lib/chat/rag'
import { logUsage } from '@/lib/usage'
import { getCorsHeaders } from '@/lib/cors'
import { rateLimit } from '@/lib/rate-limit'
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
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: corsHeaders }
    )
  }

  try {
    const body = await request.json()
    const { chatbotId, sessionId, message } = chatSchema.parse(body)

    // Get chatbot (no auth required - this is the public API)
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
    })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Check usage limits (estimate ~500 tokens per message)
    const usageCheck = await logUsage({
      tenantId: chatbot.tenantId,
      chatbotId: chatbot.id,
      type: 'chat',
      tokens: 500,
      model: chatbot.model,
    })

    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.reason || 'Usage limit exceeded' },
        { status: 429, headers: corsHeaders }
      )
    }

    // Get or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        chatbotId,
        sessionId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    })

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          chatbotId,
          sessionId,
        },
        include: {
          messages: true,
        },
      })
    }

    // Build conversation history
    const history = conversation.messages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    }))

    // Prepare context (retrieves sources)
    const { context, streamingContext } = await prepareStreamingContext(
      chatbot.tenantId,
      message,
      {}
    )

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    })

    // Generate streaming response
    const stream = await generateStreamingChatResponse(
      context,
      message,
      history,
      {
        systemPrompt: chatbot.systemPrompt || undefined,
        model: chatbot.model,
        temperature: chatbot.temperature,
      }
    )

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
        // Save the assistant message after stream completes
        if (fullContent) {
          const savedMessage = await prisma.message.create({
            data: {
              conversationId: conversation!.id,
              role: 'ASSISTANT',
              content: fullContent,
              sources: streamingContext.sources as object[],
            },
          })
          savedMessageId = savedMessage.id

          // Send messageId event before [DONE]
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ messageId: savedMessageId })}\n\n`))
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400, headers: corsHeaders }
      )
    }
    console.error('Error in streaming chat:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
