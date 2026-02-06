import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'

// GET /api/widget/[id] - Get public chatbot config for widget
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'), 'GET, OPTIONS')
  const { id } = await params

  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        welcomeMessage: true,
        primaryColor: true,
        showBranding: true,
        suggestedPrompts: true,
      },
    })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { chatbot },
      { headers: corsHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: getCorsHeaders(request.headers.get('origin'), 'GET, OPTIONS'),
  })
}
