import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

function generateToken(): string {
  return crypto.randomBytes(5).toString('base64url') // ~7 URL-safe chars
}

// POST /api/chatbots/[id]/share - Enable sharing (generate token)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { shareToken: true },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  // Already has a token
  if (chatbot.shareToken) {
    return NextResponse.json({ shareToken: chatbot.shareToken })
  }

  // Generate a unique token with retry on collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateToken()
    try {
      const updated = await prisma.chatbot.update({
        where: { id },
        data: { shareToken: token },
        select: { shareToken: true },
      })
      return NextResponse.json({ shareToken: updated.shareToken })
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2002' && attempt < 2) continue // unique constraint, retry
      throw error
    }
  }

  return NextResponse.json({ error: 'Failed to generate unique token' }, { status: 500 })
}

// DELETE /api/chatbots/[id]/share - Disable sharing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  await prisma.chatbot.update({
    where: { id },
    data: { shareToken: null },
  })

  return NextResponse.json({ success: true })
}
