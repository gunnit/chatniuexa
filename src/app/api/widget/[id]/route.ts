import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'
import { isChatbotOriginAllowed } from '@/lib/origin'

// GET /api/widget/[id] - Get public chatbot config for widget
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const { id } = await params

  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        welcomeEyebrow: true,
        welcomeHeadline: true,
        welcomeMessage: true,
        primaryColor: true,
        secondaryColor: true,
        showBranding: true,
        showSources: true,
        suggestedPrompts: true,
        chatIconType: true,
        chatIconPreset: true,
        chatIconImage: true,
        allowedDomains: true,
      },
    })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: getCorsHeaders(origin, 'GET, OPTIONS') }
      )
    }

    const corsHeaders = getCorsHeaders(origin, 'GET, OPTIONS', chatbot.allowedDomains)

    if (!isChatbotOriginAllowed({ origin, referer, allowedDomains: chatbot.allowedDomains, chatbotId: chatbot.id })) {
      return NextResponse.json(
        { error: 'Origin not allowed for this chatbot' },
        { status: 403, headers: corsHeaders }
      )
    }

    // Strip allowedDomains before returning to client
    const { allowedDomains: _allowed, ...publicConfig } = chatbot
    void _allowed

    return NextResponse.json(
      { chatbot: publicConfig },
      { headers: corsHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getCorsHeaders(origin, 'GET, OPTIONS') }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: getCorsHeaders(request.headers.get('origin'), 'GET, OPTIONS'),
  })
}
