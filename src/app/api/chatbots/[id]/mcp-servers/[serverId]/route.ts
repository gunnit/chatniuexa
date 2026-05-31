import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/encryption'
import { isSafeMcpUrl } from '@/lib/chat/tools'
import { z } from 'zod'

const updateSchema = z.object({
  description: z.string().max(200).nullish(),
  serverUrl: z.string().url().optional(),
  // Pass an empty string to clear the stored token; omit to leave it unchanged.
  authToken: z.string().max(4000).nullish(),
  allowedTools: z.array(z.string().max(100)).max(50).optional(),
  enabled: z.boolean().optional(),
})

/** Confirm the server belongs to a chatbot owned by the caller's tenant. */
async function getOwnedServer(chatbotId: string, serverId: string, tenantId: string) {
  const chatbot = await prisma.chatbot.findFirst({ where: { id: chatbotId, tenantId } })
  if (!chatbot) return null
  return prisma.chatbotMcpServer.findFirst({ where: { id: serverId, chatbotId } })
}

// PATCH /api/chatbots/[id]/mcp-servers/[serverId] — update a server
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> },
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, serverId } = await params
  const server = await getOwnedServer(id, serverId, session.user.tenantId)
  if (!server) {
    return NextResponse.json({ error: 'MCP server not found' }, { status: 404 })
  }

  try {
    const data = updateSchema.parse(await request.json())

    if (data.serverUrl !== undefined && !isSafeMcpUrl(data.serverUrl)) {
      return NextResponse.json(
        { error: 'Server URL must be a public https URL' },
        { status: 400 },
      )
    }

    const updates: Record<string, unknown> = {}
    if (data.description !== undefined) updates.description = data.description || null
    if (data.serverUrl !== undefined) updates.serverUrl = data.serverUrl
    if (data.allowedTools !== undefined) updates.allowedTools = data.allowedTools
    if (data.enabled !== undefined) updates.enabled = data.enabled
    if (data.authToken !== undefined) {
      // null or empty string clears the token; a value re-encrypts it.
      updates.authToken = data.authToken ? encryptSecret(data.authToken) : null
    }

    const updated = await prisma.chatbotMcpServer.update({
      where: { id: serverId },
      data: updates,
    })

    return NextResponse.json({
      server: {
        id: updated.id,
        label: updated.label,
        serverUrl: updated.serverUrl,
        description: updated.description,
        hasAuthToken: !!updated.authToken,
        allowedTools: updated.allowedTools,
        enabled: updated.enabled,
        createdAt: updated.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    throw error
  }
}

// DELETE /api/chatbots/[id]/mcp-servers/[serverId] — remove a server
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> },
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, serverId } = await params
  const server = await getOwnedServer(id, serverId, session.user.tenantId)
  if (!server) {
    return NextResponse.json({ error: 'MCP server not found' }, { status: 404 })
  }

  await prisma.chatbotMcpServer.delete({ where: { id: serverId } })
  return NextResponse.json({ success: true })
}
