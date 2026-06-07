import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'
import { isChatbotOriginAllowed } from '@/lib/origin'
import { logger } from '@/lib/logger'
import { rateLimitCustom } from '@/lib/rate-limit'
import { prepareStreamingContext } from '@/lib/chat/rag'
import { validateVoiceSession } from '@/lib/voice/session'
import { z } from 'zod'

const MAX_CONTEXT_CHARS = 6000

const retrieveSchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().min(1).max(1000),
})

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST /api/voice/retrieve — resolves the realtime model's search_knowledge tool call
// against the bot's knowledge base (same retrieval the text chat uses).
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  try {
    const { sessionId, query } = retrieveSchema.parse(await request.json())

    // Each retrieve runs a pgvector search — bound the rate per session.
    if (!rateLimitCustom('voice-rt', sessionId, 40, 60).allowed) {
      return NextResponse.json({ context: '' }, { status: 429, headers: getCorsHeaders(origin) })
    }

    const session = await validateVoiceSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401, headers: getCorsHeaders(origin) })
    }

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: session.chatbotId },
      select: { id: true, allowedDomains: true },
    })
    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404, headers: getCorsHeaders(origin) })
    }

    const corsHeaders = getCorsHeaders(origin, 'POST, OPTIONS', chatbot.allowedDomains)
    if (!isChatbotOriginAllowed({ origin, referer, allowedDomains: chatbot.allowedDomains, chatbotId: chatbot.id })) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403, headers: corsHeaders })
    }

    const { context } = await prepareStreamingContext(session.tenantId, query, {})
    return NextResponse.json({ context: context.slice(0, MAX_CONTEXT_CHARS) }, { headers: corsHeaders })
  } catch (error) {
    const fallback = getCorsHeaders(origin)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400, headers: fallback })
    }
    logger.error('Voice retrieve error', { error: String(error) })
    // Return a soft result so the model can apologize rather than hang.
    return NextResponse.json({ context: '' }, { headers: fallback })
  }
}
