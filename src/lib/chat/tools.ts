import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { getOpenAI } from '@/lib/openai'
import { decryptSecret } from '@/lib/encryption'
import { getPlanLimits, type PlanId } from '@/lib/plans'
import { logger } from '@/lib/logger'

export type ResponsesTool = OpenAI.Responses.Tool

// Minimal chatbot shape needed to decide/build tools. Matches the scalar fields
// returned by prisma.chatbot.findUnique.
export interface ToolChatbot {
  id: string
  tenantId: string
  webSearchEnabled: boolean
}

// Cheap model used only for on-demand MCP tool discovery.
const DISCOVERY_MODEL = 'gpt-5.4-mini'

/**
 * SSRF guard for tenant-supplied MCP server URLs. Fails closed: only https to a
 * public host is allowed. Blocks localhost, private / link-local / unique-local
 * ranges, CGNAT, and cloud metadata endpoints (e.g. 169.254.169.254).
 *
 * Note: this checks the literal URL host. It does not resolve DNS, so a hostname
 * that resolves to a private IP is not caught here — acceptable because the
 * feature is Business-gated and config-time-reviewed, but worth revisiting if it
 * is ever opened to lower tiers.
 */
export function isSafeMcpUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (host === 'metadata.google.internal') return false

  // IPv4 literal ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const octets = v4.slice(1).map(Number)
    if (octets.some((n) => n > 255)) return false
    const [a, b] = octets
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  }

  // IPv6 literal loopback / link-local / unique-local / IPv4-mapped
  if (host.includes(':')) {
    const h = host.replace(/^\[|\]$/g, '')
    if (h === '::1' || h === '::') return false
    if (h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd')) return false
    if (h.startsWith('::ffff:')) return false
  }

  return true
}

/**
 * Build the OpenAI Responses `tools` array for a chatbot, enforcing plan gating
 * and the read-only / config-time-approval security posture.
 *
 * - Web search (Pro+): OpenAI-hosted, read-only.
 * - Remote MCP servers (Business): each enabled server with a non-empty
 *   `allowedTools` allowlist becomes an `mcp` tool with `require_approval:"never"`
 *   (approval already happened when the tenant picked the allowlist). Unsafe URLs
 *   and undecryptable tokens are skipped (fail closed).
 *
 * Returns [] when the bot has no usable tools — the caller then uses the plain
 * Chat Completions path, so non-tool bots are completely unaffected.
 */
export async function buildChatbotTools(chatbot: ToolChatbot): Promise<ResponsesTool[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: chatbot.tenantId },
    select: { plan: true },
  })
  const limits = getPlanLimits((tenant?.plan ?? 'free') as PlanId)
  const tools: ResponsesTool[] = []

  if (chatbot.webSearchEnabled && limits.toolsEnabled) {
    tools.push({ type: 'web_search' })
  }

  if (limits.mcpServersEnabled) {
    const servers = await prisma.chatbotMcpServer.findMany({
      where: { chatbotId: chatbot.id, enabled: true },
      orderBy: { createdAt: 'asc' },
    })

    for (const s of servers) {
      if (!isSafeMcpUrl(s.serverUrl)) {
        logger.warn('Skipping MCP server with unsafe URL', { chatbotId: chatbot.id, label: s.label })
        continue
      }
      // No approved tools means the bot cannot call anything — skip the server
      // entirely rather than exposing its full tool surface.
      if (!s.allowedTools || s.allowedTools.length === 0) continue

      let headers: Record<string, string> | undefined
      if (s.authToken) {
        try {
          headers = { Authorization: `Bearer ${decryptSecret(s.authToken)}` }
        } catch (err) {
          logger.error('Failed to decrypt MCP token; skipping server', {
            chatbotId: chatbot.id,
            label: s.label,
            error: String(err),
          })
          continue
        }
      }

      tools.push({
        type: 'mcp',
        server_label: s.label,
        server_url: s.serverUrl,
        ...(s.description ? { server_description: s.description } : {}),
        allowed_tools: s.allowedTools,
        require_approval: 'never',
        ...(headers ? { headers } : {}),
      })
    }
  }

  return tools
}

export interface DiscoveredTool {
  name: string
  description?: string
}

/**
 * Discover the tools a remote MCP server exposes, for the config-time allowlist
 * UI. Rather than re-implement the MCP handshake, we register the server with
 * OpenAI's Responses API and read the `mcp_list_tools` output item it emits when
 * importing the server's schema. `tool_choice:"none"` prevents any actual call.
 *
 * Throws on unsafe URLs or connection/auth failures so the UI can surface the
 * reason.
 */
export async function discoverMcpTools(serverUrl: string, token?: string): Promise<DiscoveredTool[]> {
  if (!isSafeMcpUrl(serverUrl)) {
    throw new Error('MCP server URL must be a public https URL')
  }

  const openai = getOpenAI()
  const resp = await openai.responses.create({
    model: DISCOVERY_MODEL,
    input: 'Respond with "ok".',
    tool_choice: 'none',
    max_output_tokens: 16,
    tools: [
      {
        type: 'mcp',
        server_label: 'discovery',
        server_url: serverUrl,
        require_approval: 'never',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      },
    ],
  })

  const listItem = resp.output.find((o) => o.type === 'mcp_list_tools')
  if (!listItem || !('tools' in listItem) || !Array.isArray(listItem.tools)) {
    return []
  }

  return listItem.tools.map((t: { name: string; description?: string | null }) => ({
    name: t.name,
    description: t.description ?? undefined,
  }))
}
