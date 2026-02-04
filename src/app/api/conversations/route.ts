import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/conversations - Get conversations with messages
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const chatbotId = searchParams.get('chatbotId')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const search = searchParams.get('search') || ''

  const skip = (page - 1) * limit

  // Build where clause
  const where = {
    chatbot: {
      tenantId: session.user.tenantId,
      ...(chatbotId && { id: chatbotId }),
    },
    ...(search && {
      messages: {
        some: {
          content: {
            contains: search,
            mode: 'insensitive' as const,
          },
        },
      },
    }),
  }

  // Get total count for pagination
  const total = await prisma.conversation.count({ where })

  // Fetch conversations with messages
  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      chatbot: {
        select: {
          id: true,
          name: true,
          primaryColor: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          sources: true,
          reaction: true,
          createdAt: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    skip,
    take: limit,
  })

  // Get list of chatbots for filter dropdown
  const chatbots = await prisma.chatbot.findMany({
    where: { tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    conversations: conversations.map((conv) => ({
      id: conv.id,
      sessionId: conv.sessionId,
      chatbot: conv.chatbot,
      messageCount: conv._count.messages,
      messages: conv.messages,
      // Get first user message as preview
      preview: conv.messages.find((m) => m.role === 'USER')?.content?.slice(0, 100) || '',
      // Count reactions
      thumbsUp: conv.messages.filter((m) => m.reaction === 'up').length,
      thumbsDown: conv.messages.filter((m) => m.reaction === 'down').length,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    })),
    chatbots,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
