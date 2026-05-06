import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getPlanLimits, type PlanId } from '@/lib/plans'

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
    const tenantId = session.user.tenantId

    // Wrap count + create in a serializable transaction so two concurrent POSTs
    // can't both pass the limit check and end up creating one chatbot above
    // the plan cap.
    const result = await prisma.$transaction(
      async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true },
        })
        const planLimits = getPlanLimits((tenant?.plan || 'free') as PlanId)
        const chatbotCount = await tx.chatbot.count({ where: { tenantId } })

        if (chatbotCount >= planLimits.maxChatbots) {
          return {
            ok: false as const,
            plan: tenant?.plan || 'free',
            maxChatbots: planLimits.maxChatbots,
          }
        }

        const created = await tx.chatbot.create({
          data: { tenantId, ...data },
        })
        return { ok: true as const, chatbot: created }
      },
      { isolationLevel: 'Serializable' },
    )

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Chatbot limit reached',
          message: `Your ${result.plan} plan allows up to ${result.maxChatbots} chatbot${result.maxChatbots === 1 ? '' : 's'}. Upgrade your plan to create more.`,
          upgrade: true,
        },
        { status: 403 }
      )
    }

    return NextResponse.json({ chatbot: result.chatbot }, { status: 201 })
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
