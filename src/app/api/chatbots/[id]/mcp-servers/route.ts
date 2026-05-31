import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPlanLimits, type PlanId } from '@/lib/plans'
import { encryptSecret } from '@/lib/encryption'
import { isSafeMcpUrl } from '@/lib/chat/tools'
import { z } from 'zod'

// A label is a short slug used as the OpenAI `server_label` — letters, numbers,
// underscores and dashes only (matches OpenAI's allowed label characters).
const labelSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Label may only contain letters, numbers, underscores and dashes')

const createSchema = z.object({
  label: labelSchema,
  serverUrl: z.string().url(),
  description: z.string().max(200).optional(),
  authToken: z.string().max(4000).optional(),
  allowedTools: z.array(z.string().max(100)).max(50).default([]),
})

/** Serialize an MCP server row for the client — never leak the token. */
function serialize(s: {
  id: string
  label: string
  serverUrl: string
  description: string | null
  authToken: string | null
  allowedTools: string[]
  enabled: boolean
  createdAt: Date
}) {
  return {
    id: s.id,
    label: s.label,
    serverUrl: s.serverUrl,
    description: s.description,
    hasAuthToken: !!s.authToken,
    allowedTools: s.allowedTools,
    enabled: s.enabled,
    createdAt: s.createdAt,
  }
}

async function getOwnedChatbot(chatbotId: string, tenantId: string) {
  return prisma.chatbot.findFirst({
    where: { id: chatbotId, tenantId },
    include: { tenant: { select: { plan: true } } },
  })
}

// GET /api/chatbots/[id]/mcp-servers — list configured MCP servers
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const chatbot = await getOwnedChatbot(id, session.user.tenantId)
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const limits = getPlanLimits(chatbot.tenant.plan as PlanId)
  const servers = await prisma.chatbotMcpServer.findMany({
    where: { chatbotId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    servers: servers.map(serialize),
    limits: { mcpServersEnabled: limits.mcpServersEnabled, maxMcpServers: limits.maxMcpServers },
  })
}

// POST /api/chatbots/[id]/mcp-servers — add an MCP server
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const chatbot = await getOwnedChatbot(id, session.user.tenantId)
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const limits = getPlanLimits(chatbot.tenant.plan as PlanId)
  if (!limits.mcpServersEnabled) {
    return NextResponse.json(
      { error: 'Remote MCP servers require the Business plan' },
      { status: 403 },
    )
  }

  try {
    const data = createSchema.parse(await request.json())

    if (!isSafeMcpUrl(data.serverUrl)) {
      return NextResponse.json(
        { error: 'Server URL must be a public https URL (private and localhost addresses are blocked)' },
        { status: 400 },
      )
    }

    const count = await prisma.chatbotMcpServer.count({ where: { chatbotId: id } })
    if (count >= limits.maxMcpServers) {
      return NextResponse.json(
        { error: `Your plan allows at most ${limits.maxMcpServers} MCP servers per chatbot` },
        { status: 403 },
      )
    }

    const server = await prisma.chatbotMcpServer.create({
      data: {
        chatbotId: id,
        label: data.label,
        serverUrl: data.serverUrl,
        description: data.description || null,
        authToken: data.authToken ? encryptSecret(data.authToken) : null,
        allowedTools: data.allowedTools,
        enabled: true,
      },
    })

    return NextResponse.json({ server: serialize(server) }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    // Unique constraint on (chatbotId, label)
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'An MCP server with that label already exists' }, { status: 409 })
    }
    throw error
  }
}
