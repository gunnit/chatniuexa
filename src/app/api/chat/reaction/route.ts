import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCorsHeaders } from '@/lib/cors'
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
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))

  try {
    const body = await request.json()
    const { messageId, reaction, sessionId } = reactionSchema.parse(body)

    // Find the message and verify it belongs to the session
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: {
          sessionId: sessionId,
        },
      },
    })

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Update the reaction
    await prisma.message.update({
      where: { id: messageId },
      data: { reaction },
    })

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400, headers: corsHeaders }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
