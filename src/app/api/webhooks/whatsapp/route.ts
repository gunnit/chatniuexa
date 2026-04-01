import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat/rag'
import { logUsage } from '@/lib/usage'
import { logger } from '@/lib/logger'
import {
  verifyWebhookSignature,
  parseIncomingMessages,
  sendWhatsAppMessage,
  splitMessage,
  decryptToken,
} from '@/lib/whatsapp'

// In-memory deduplication (single-instance on Render)
const recentMessageIds = new Set<string>()
const MESSAGE_ID_TTL = 60_000 // 60 seconds

function markProcessed(messageId: string) {
  recentMessageIds.add(messageId)
  setTimeout(() => recentMessageIds.delete(messageId), MESSAGE_ID_TTL)
}

// GET /api/webhooks/whatsapp - Meta webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const verifyToken = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !verifyToken || !challenge) {
    return new NextResponse('Bad request', { status: 400 })
  }

  // Check env-level fallback token first (for initial Meta webhook setup)
  const envVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (envVerifyToken && verifyToken === envVerifyToken) {
    logger.info('WhatsApp webhook verified via env token')
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Look up the config with this verify token
  const config = await prisma.whatsAppConfig.findFirst({
    where: { webhookVerifyToken: verifyToken, isActive: true },
  })

  if (!config) {
    logger.warn('WhatsApp webhook verification failed: unknown verify token')
    return new NextResponse('Forbidden', { status: 403 })
  }

  logger.info('WhatsApp webhook verified', { chatbotId: config.chatbotId })
  // Meta expects the challenge as plain text
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

// POST /api/webhooks/whatsapp - Incoming messages
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature if META_APP_SECRET is configured
  const appSecret = process.env.META_APP_SECRET
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256')
    if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
      logger.error('WhatsApp webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // Always return 200 quickly to prevent Meta retries
  // Process messages after parsing
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ received: true })
  }

  const messages = parseIncomingMessages(payload)

  // Process each message
  for (const msg of messages) {
    // Deduplication
    if (recentMessageIds.has(msg.messageId)) {
      logger.info('Skipping duplicate WhatsApp message', { messageId: msg.messageId })
      continue
    }
    markProcessed(msg.messageId)

    try {
      await processWhatsAppMessage(msg)
    } catch (error) {
      logger.error('Failed to process WhatsApp message', {
        messageId: msg.messageId,
        error: String(error),
      })
    }
  }

  return NextResponse.json({ received: true })
}

async function processWhatsAppMessage(msg: {
  from: string
  text: string
  messageId: string
  phoneNumberId: string
  type: string
  senderName?: string
}) {
  // Find the chatbot config for this phone number
  const config = await prisma.whatsAppConfig.findFirst({
    where: { phoneNumberId: msg.phoneNumberId, isActive: true },
    include: { chatbot: true },
  })

  if (!config) {
    logger.warn('No WhatsApp config found for phone number', { phoneNumberId: msg.phoneNumberId })
    return
  }

  const { chatbot } = config
  const accessToken = decryptToken(config.accessToken)

  // Handle non-text messages
  if (msg.type !== 'text' || !msg.text) {
    await sendWhatsAppMessage(
      config.phoneNumberId,
      accessToken,
      msg.from,
      'I can only process text messages at the moment. Please send me a text message.'
    )
    return
  }

  // Check usage limits
  const usageCheck = await logUsage({
    tenantId: chatbot.tenantId,
    chatbotId: chatbot.id,
    type: 'chat',
    tokens: 500,
    model: chatbot.model,
  })

  if (!usageCheck.allowed) {
    await sendWhatsAppMessage(
      config.phoneNumberId,
      accessToken,
      msg.from,
      'Sorry, this chatbot has reached its usage limit. Please try again later.'
    )
    return
  }

  // Get or create conversation (use sender phone as sessionId)
  let conversation = await prisma.conversation.findFirst({
    where: {
      chatbotId: chatbot.id,
      sessionId: msg.from,
      channel: 'whatsapp',
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 20,
      },
    },
  })

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        chatbotId: chatbot.id,
        sessionId: msg.from,
        channel: 'whatsapp',
      },
      include: { messages: true },
    })
  }

  // Build conversation history
  const history = conversation.messages.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }))

  // Generate RAG response
  const response = await generateChatResponse(
    chatbot.tenantId,
    msg.text,
    history,
    {
      systemPrompt: chatbot.systemPrompt || undefined,
      model: chatbot.model,
    }
  )

  // Save user message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: msg.text,
    },
  })

  // Save assistant message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: response.content,
      sources: response.sources as object[],
    },
  })

  // Send reply via WhatsApp (split if too long)
  // Strip markdown formatting for WhatsApp (basic cleanup)
  const plainText = response.content
    .replace(/\*\*(.*?)\*\*/g, '*$1*')  // **bold** → *bold* (WhatsApp format)
    .replace(/#{1,6}\s/g, '')            // Remove markdown headings

  const chunks = splitMessage(plainText)
  for (const chunk of chunks) {
    await sendWhatsAppMessage(config.phoneNumberId, accessToken, msg.from, chunk)
  }

  logger.info('WhatsApp message processed', {
    chatbotId: chatbot.id,
    from: msg.from,
    confidence: response.confidence,
  })
}
