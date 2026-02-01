import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// GET /api/chatbots/[id] - Get a specific chatbot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const chatbot = await prisma.chatbot.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  return NextResponse.json({ chatbot })
}

// PATCH /api/chatbots/[id] - Update a chatbot
const updateChatbotSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  systemPrompt: z.string().nullish(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
  primaryColor: z.string().nullish(),
  welcomeMessage: z.string().nullish(),
  showBranding: z.boolean().optional(),
  suggestedPrompts: z.array(z.string()).max(4).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const existing = await prisma.chatbot.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const data = updateChatbotSchema.parse(body)

    const chatbot = await prisma.chatbot.update({
      where: { id },
      data,
    })

    return NextResponse.json({ chatbot })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/chatbots/[id] - Delete a chatbot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  await prisma.chatbot.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
