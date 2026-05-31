import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPlanLimits, type PlanId } from '@/lib/plans'
import { decryptSecret } from '@/lib/encryption'
import { discoverMcpTools, isSafeMcpUrl } from '@/lib/chat/tools'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Either probe a brand-new server (serverUrl + optional authToken) or re-probe an
// already-saved server by id (reusing its stored, encrypted token).
const discoverSchema = z.object({
  serverUrl: z.string().url().optional(),
  authToken: z.string().max(4000).optional(),
  serverId: z.string().optional(),
})

// POST /api/chatbots/[id]/mcp-servers/discover — list a server's tools
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { tenant: { select: { plan: true } } },
  })
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const limits = getPlanLimits(chatbot.tenant.plan as PlanId)
  if (!limits.mcpServersEnabled) {
    return NextResponse.json({ error: 'Remote MCP servers require the Business plan' }, { status: 403 })
  }

  let data: z.infer<typeof discoverSchema>
  try {
    data = discoverSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    throw error
  }

  // Resolve target URL + token, either from the request or a saved server.
  let serverUrl = data.serverUrl
  let token = data.authToken
  if (data.serverId) {
    const saved = await prisma.chatbotMcpServer.findFirst({
      where: { id: data.serverId, chatbotId: id },
    })
    if (!saved) {
      return NextResponse.json({ error: 'MCP server not found' }, { status: 404 })
    }
    serverUrl = saved.serverUrl
    if (!token && saved.authToken) {
      try {
        token = decryptSecret(saved.authToken)
      } catch {
        return NextResponse.json({ error: 'Stored credentials could not be read' }, { status: 500 })
      }
    }
  }

  if (!serverUrl || !isSafeMcpUrl(serverUrl)) {
    return NextResponse.json(
      { error: 'A public https server URL is required' },
      { status: 400 },
    )
  }

  try {
    const tools = await discoverMcpTools(serverUrl, token)
    return NextResponse.json({ tools })
  } catch (error) {
    logger.warn('MCP discovery failed', { chatbotId: id, error: String(error) })
    return NextResponse.json(
      { error: 'Could not connect to the MCP server or list its tools. Check the URL and credentials.' },
      { status: 502 },
    )
  }
}
