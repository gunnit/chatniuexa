import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'
import { isChatbotOriginAllowed } from '@/lib/origin'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const reactionSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  reaction: z.enum(['up', 'down']),
  sessionId: z.string().min(1, 'Session ID is required'),
})

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST /api/chat/reaction - Save user reaction to a message
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

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
    const { messageId, reaction, sessionId } = reactionSchema.parse(body)

    // Look up message + chatbot in one query so we can validate origin against
    // the configured allow-list before persisting anything.
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { sessionId: sessionId },
      },
      include: {
        conversation: {
          include: {
            chatbot: { select: { id: true, allowedDomains: true } },
          },
        },
      },
    })

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      )
    }

    const chatbot = message.conversation.chatbot
    const corsHeaders = getCorsHeaders(origin, 'POST, OPTIONS', chatbot.allowedDomains)

    if (!isChatbotOriginAllowed({ origin, referer, allowedDomains: chatbot.allowedDomains, chatbotId: chatbot.id })) {
      return NextResponse.json(
        { error: 'Origin not allowed for this chatbot' },
        { status: 403, headers: corsHeaders }
      )
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { reaction },
    })

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    )
  } catch (error) {
    const fallbackHeaders = getCorsHeaders(origin)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400, headers: fallbackHeaders }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: fallbackHeaders }
    )
  }
}
