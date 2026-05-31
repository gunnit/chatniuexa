import OpenAI from 'openai'
import { getOpenAI } from '@/lib/openai'
import { DEFAULT_SYSTEM_PROMPT, FORMATTING_ADDENDUM, PII_GUARDRAIL } from '@/lib/chat/rag'
import type { ResponsesTool } from '@/lib/chat/tools'

/**
 * Tool-enabled chat generation via the OpenAI Responses API.
 *
 * This mirrors the Chat Completions path in `rag.ts` but runs through
 * `openai.responses.create`, which is the only API that supports the hosted
 * `web_search` and remote `mcp` tools. The RAG context is still retrieved by the
 * caller and injected here as part of the instructions, so tool-enabled bots stay
 * grounded in their knowledge base AND can reach their tools.
 *
 * The streaming variant emits the exact same `data: {content}` / `data: [DONE]`
 * SSE shape as the Chat Completions streamer, so the widget/front-end and the
 * stream route's capture logic need no changes.
 */

// For tool-enabled bots the strict "only the knowledge base" scope rule is
// replaced with one that also permits the connected tools, while keeping the
// anti-hallucination posture.
const TOOL_SCOPE_GUARDRAIL = `\n\nYou have access to the knowledge base context above AND the external tools provided to you (such as web search or connected MCP servers). Use the knowledge base for organization-specific information; use your tools to look up live, external, or up-to-date information that the knowledge base does not contain. When you use a tool result, incorporate it accurately and concisely, and prefer citing the source. If neither the knowledge base nor your tools can answer the question, say so plainly — never invent facts.`

const MAX_OUTPUT_TOKENS = 2048
const DEFAULT_MODEL = 'gpt-5.4-mini'

export interface ToolGenerationOptions {
  systemPrompt?: string
  model?: string
  tools: ResponsesTool[]
}

export interface ToolUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ToolChatResult {
  content: string
  usage?: ToolUsage
}

function buildInstructions(systemPrompt: string, context: string): string {
  const base = systemPrompt && systemPrompt.trim().length > 0 ? systemPrompt : DEFAULT_SYSTEM_PROMPT
  const withFormatting =
    base === DEFAULT_SYSTEM_PROMPT || /\*\*bold\*\*|markdown/i.test(base) ? base : base + FORMATTING_ADDENDUM
  return `${withFormatting}${TOOL_SCOPE_GUARDRAIL}${PII_GUARDRAIL}\n\n${context}`
}

function buildInput(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): OpenAI.Responses.ResponseInput {
  const items: OpenAI.Responses.ResponseInputItem[] = []
  for (const msg of history.slice(-10)) {
    items.push({ role: msg.role, content: msg.content })
  }
  items.push({ role: 'user', content: userMessage })
  return items
}

/**
 * Non-streaming tool-enabled generation (used by POST /api/chat).
 */
export async function generateChatResponseWithTools(
  context: string,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: ToolGenerationOptions,
): Promise<ToolChatResult> {
  const { systemPrompt = DEFAULT_SYSTEM_PROMPT, model = DEFAULT_MODEL, tools } = options
  const openai = getOpenAI()

  const response = await openai.responses.create({
    model,
    instructions: buildInstructions(systemPrompt, context),
    input: buildInput(history, userMessage),
    tools,
    max_output_tokens: MAX_OUTPUT_TOKENS,
  })

  const content =
    response.output_text?.trim() || 'I apologize, but I was unable to generate a response.'

  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : undefined

  return { content, usage }
}

/**
 * Streaming tool-enabled generation (used by POST /api/chat/stream). Returns a
 * web ReadableStream of SSE bytes in the same shape as the Chat Completions
 * streamer: `data: {"content":"..."}` events followed by `data: [DONE]`.
 */
export async function generateStreamingChatResponseWithTools(
  context: string,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: ToolGenerationOptions,
): Promise<ReadableStream<Uint8Array>> {
  const { systemPrompt = DEFAULT_SYSTEM_PROMPT, model = DEFAULT_MODEL, tools } = options
  const openai = getOpenAI()

  const stream = await openai.responses.create({
    model,
    instructions: buildInstructions(systemPrompt, context),
    input: buildInput(history, userMessage),
    tools,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
  })

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: event.delta })}\n\n`),
            )
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
