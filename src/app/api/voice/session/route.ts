import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'
import { isChatbotOriginAllowed } from '@/lib/origin'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getPlanLimits, type PlanId } from '@/lib/plans'
import { mintVoiceSession, checkVoiceBudget } from '@/lib/voice/session'
import { z } from 'zod'

const sessionSchema = z.object({
  chatbotId: z.string().min(1, 'Chatbot ID is required'),
})

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST /api/voice/session — mint an ephemeral Realtime token for a voice call.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(ip).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: getCorsHeaders(origin) })
  }

  try {
    let raw: unknown
    try { raw = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: getCorsHeaders(origin) }) }
    const { chatbotId } = sessionSchema.parse(raw)

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: { tenant: { select: { plan: true } } },
    })
    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404, headers: getCorsHeaders(origin) })
    }

    const corsHeaders = getCorsHeaders(origin, 'POST, OPTIONS', chatbot.allowedDomains)

    if (!isChatbotOriginAllowed({ origin, referer, allowedDomains: chatbot.allowedDomains, chatbotId: chatbot.id })) {
      return NextResponse.json({ error: 'Origin not allowed for this chatbot' }, { status: 403, headers: corsHeaders })
    }

    // Gate: plan must allow voice AND the bot must have it switched on.
    const limits = getPlanLimits(chatbot.tenant.plan as PlanId)
    if (!limits.voiceEnabled || !chatbot.voiceEnabled) {
      return NextResponse.json({ error: 'Voice is not available for this chatbot' }, { status: 403, headers: corsHeaders })
    }

    // Gate: monthly voice budget + cost cap.
    const budget = await checkVoiceBudget(chatbot.tenantId)
    if (!budget.allowed) {
      return NextResponse.json({ error: budget.reason || 'Voice limit reached' }, { status: 402, headers: corsHeaders })
    }

    const payload = await mintVoiceSession({
      chatbot: {
        id: chatbot.id,
        tenantId: chatbot.tenantId,
        name: chatbot.name,
        systemPrompt: chatbot.systemPrompt,
        voiceName: chatbot.voiceName,
      },
      maxSessionSeconds: limits.maxVoiceSessionSeconds,
    })

    return NextResponse.json(payload, { headers: corsHeaders })
  } catch (error) {
    const fallback = getCorsHeaders(origin)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400, headers: fallback })
    }
    logger.error('Voice session error', { error: String(error) })
    return NextResponse.json({ error: 'Voice unavailable' }, { status: 502, headers: fallback })
  }
}
