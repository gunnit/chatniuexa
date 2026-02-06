import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat/rag'
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

// POST /api/chat - Send a message and get a response
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
      tokens: 500, // Estimated, will be updated after actual response
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
          take: 20, // Last 20 messages for context
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

    // Generate response using RAG
    const response = await generateChatResponse(
      chatbot.tenantId,
      message,
      history,
      {
        systemPrompt: chatbot.systemPrompt || undefined,
        model: chatbot.model,
        temperature: chatbot.temperature,
      }
    )

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    })

    // Save assistant message with sources
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: response.content,
        sources: response.sources as object[],
      },
    })

    return NextResponse.json(
      {
        message: {
          id: assistantMessage.id,
          content: response.content,
          sources: response.sources,
          confidence: response.confidence,
          confidenceScore: response.confidenceScore,
        },
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400, headers: corsHeaders }
      )
    }
    // Log error details in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in chat:', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
