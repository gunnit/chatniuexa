import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// GET /api/chatbots - List all chatbots for the tenant
export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const chatbots = await prisma.chatbot.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { conversations: true },
      },
    },
  })

  return NextResponse.json({ chatbots })
}

// POST /api/chatbots - Create a new chatbot
const createChatbotSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
  primaryColor: z.string().optional(),
  welcomeMessage: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createChatbotSchema.parse(body)

    const chatbot = await prisma.chatbot.create({
      data: {
        tenantId: session.user.tenantId,
        ...data,
      },
    })

    return NextResponse.json({ chatbot }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
