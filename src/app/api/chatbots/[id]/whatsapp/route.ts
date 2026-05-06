import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPlanLimits, type PlanId } from '@/lib/plans'
import { encryptToken } from '@/lib/whatsapp'
import { z } from 'zod'
import crypto from 'crypto'

const whatsappConfigSchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  whatsappBusinessAccountId: z.string().optional(),
})

// GET /api/chatbots/[id]/whatsapp - Get WhatsApp config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify chatbot ownership
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
  })
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const config = await prisma.whatsAppConfig.findUnique({
    where: { chatbotId: id },
  })

  if (!config) {
    return NextResponse.json({ config: null })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chataziendale.it'
  const webhookUrl = `${appUrl}/api/webhooks/whatsapp`

  return NextResponse.json({
    config: {
      id: config.id,
      phoneNumberId: config.phoneNumberId,
      whatsappBusinessAccountId: config.whatsappBusinessAccountId,
      // The stored token is AES ciphertext; never return it (or any prefix of
      // it) to the client. Just signal that a token is configured.
      accessTokenMasked: '[configured]',
      webhookVerifyToken: config.webhookVerifyToken,
      isActive: config.isActive,
      webhookUrl,
      createdAt: config.createdAt,
    },
  })
}

// POST /api/chatbots/[id]/whatsapp - Create/update WhatsApp config
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify chatbot ownership
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { tenant: true },
  })
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  // Plan gating
  const plan = chatbot.tenant.plan as PlanId
  const limits = getPlanLimits(plan)
  if (!limits.whatsappEnabled) {
    return NextResponse.json(
      { error: 'WhatsApp integration requires a Pro or Business plan' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const data = whatsappConfigSchema.parse(body)

    const encryptedToken = encryptToken(data.accessToken)
    const webhookVerifyToken = crypto.randomBytes(16).toString('hex')

    const config = await prisma.whatsAppConfig.upsert({
      where: { chatbotId: id },
      update: {
        phoneNumberId: data.phoneNumberId,
        whatsappBusinessAccountId: data.whatsappBusinessAccountId || null,
        accessToken: encryptedToken,
        webhookVerifyToken,
        isActive: true,
      },
      create: {
        chatbotId: id,
        phoneNumberId: data.phoneNumberId,
        whatsappBusinessAccountId: data.whatsappBusinessAccountId || null,
        accessToken: encryptedToken,
        webhookVerifyToken,
        isActive: true,
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chataziendale.it'
    const webhookUrl = `${appUrl}/api/webhooks/whatsapp`

    return NextResponse.json({
      config: {
        id: config.id,
        phoneNumberId: config.phoneNumberId,
        whatsappBusinessAccountId: config.whatsappBusinessAccountId,
        accessTokenMasked: '[configured]',
        webhookVerifyToken: config.webhookVerifyToken,
        isActive: config.isActive,
        webhookUrl,
        createdAt: config.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    throw error
  }
}

// DELETE /api/chatbots/[id]/whatsapp - Disconnect WhatsApp
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify chatbot ownership
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
  })
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  await prisma.whatsAppConfig.deleteMany({
    where: { chatbotId: id },
  })

  return NextResponse.json({ success: true })
}
