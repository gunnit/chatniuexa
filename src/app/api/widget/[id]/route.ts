import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// CORS headers for widget - configurable origin
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['*']

function getCorsHeaders(origin?: string | null) {
  const requestOrigin = origin || ''
  const allowOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)
    ? (allowedOrigins.includes('*') ? '*' : requestOrigin)
    : ''

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// GET /api/widget/[id] - Get public chatbot config for widget
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))
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
    headers: getCorsHeaders(request.headers.get('origin')),
  })
}
