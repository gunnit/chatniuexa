import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'
import { isChatbotOriginAllowed } from '@/lib/origin'
import { logger } from '@/lib/logger'
import { rateLimitCustom } from '@/lib/rate-limit'
import { validateVoiceSession } from '@/lib/voice/session'
import { z } from 'zod'

const leadSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
  note: z.string().max(2000).optional(),
})

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST /api/voice/lead — resolves the realtime model's capture_lead tool call.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  try {
    const { sessionId, name, email, phone, note } = leadSchema.parse(await request.json())

    // A handful of lead saves per session is plenty.
    if (!rateLimitCustom('voice-lead', sessionId, 6, 300).allowed) {
      return NextResponse.json({ ok: false }, { status: 429, headers: getCorsHeaders(origin) })
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

    // Need at least one contact detail to be a useful lead.
    if (!name && !email && !phone) {
      return NextResponse.json({ ok: false, error: 'No contact details' }, { status: 400, headers: corsHeaders })
    }

    await prisma.lead.create({
      data: {
        chatbotId: session.chatbotId,
        tenantId: session.tenantId,
        voiceSessionId: session.id,
        name: name || null,
        email: email || null,
        phone: phone || null,
        note: note || null,
        source: 'voice',
      },
    })

    return NextResponse.json({ ok: true }, { headers: corsHeaders })
  } catch (error) {
    const fallback = getCorsHeaders(origin)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400, headers: fallback })
    }
    logger.error('Voice lead error', { error: String(error) })
    return NextResponse.json({ ok: false }, { status: 500, headers: fallback })
  }
}
