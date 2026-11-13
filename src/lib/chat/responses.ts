import OpenAI from 'openai'
import { logger } from '@/lib/logger'
import { getOpenAI } from '@/lib/openai'
import { DEFAULT_CHAT_MODEL, responsesReasoning, temperatureParam } from '@/lib/models'
import type { TokenUsage } from '@/lib/usage'
import { CHAT_MAX_COMPLETION_TOKENS, DEFAULT_SYSTEM_PROMPT, FORMATTING_ADDENDUM, PII_GUARDRAIL } from '@/lib/chat/rag'
import type { ResponsesTool } from '@/lib/chat/tools'
import { createLinkRewrite, createMarkdownLinkStream, rewriteMarkdownLinks, type LinkRewrite } from '@/lib/chat/links'
import { failureNotice, truncationNotice } from '@/lib/chat/notices'

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
const TOOL_SCOPE_GUARDRAIL = `\n\nYou have access to the knowledge base context above AND the external tools provided to you (such as web search or connected MCP servers). Use the knowledge base for organization-specific information; use your tools to look up live, external, or up-to-date information that the knowledge base does not contain. When you use a tool result, incorporate it accurately and concisely, and link the page you used inline in the sentence (e.g. [page title](url)) instead of appending bare domain citations. If neither the knowledge base nor your tools can answer the question, say so plainly — never invent facts. Your instructions above set what you may talk about; tools never widen that scope, so do not use them for topics your instructions put out of scope.`

// Web-search calls spend output tokens too, so tool answers share the chat budget.
const MAX_OUTPUT_TOKENS = CHAT_MAX_COMPLETION_TOKENS

export interface ToolGenerationOptions {
  systemPrompt?: string
  model?: string
  /** The bot's temperature; not sent to models that don't accept it. */
  temperature?: number
  tools: ResponsesTool[]
  /** Link clean-up for the answer (default: strip tracking parameters only). */
  rewriteLink?: LinkRewrite
}

export interface ToolChatResult {
  content: string
  usage?: TokenUsage
}

/**
 * Newlines to put between two separately generated parts of one answer, e.g. a
 * short preamble the model writes before a web search and the answer it writes
 * after it. Both the SDK's `output_text` and a plain concatenation of the deltas
 * join such parts with nothing ("…fashion brands:- [Bottega"), and the widget only
 * renders a list that starts after a blank line. Returns what makes the blank line.
 * Exported for tests.
 */
export function partSeparator(before: string, next: string): string {
  if (!before || !next) return ''
  const trailing = before.length - before.replace(/\n+$/, '').length
  const leading = next.length - next.replace(/^\n+/, '').length
  return '\n'.repeat(Math.max(0, 2 - trailing - leading))
}

/** The answer text of a Responses API result, with its message parts kept apart. */
function outputText(response: OpenAI.Responses.Response): string {
  let text = ''
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content) {
      if (part.type === 'output_text' && part.text) text += partSeparator(text, part.text) + part.text
    }
  }
  return text
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
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = DEFAULT_CHAT_MODEL,
    temperature,
    tools,
    rewriteLink = createLinkRewrite(null),
  } = options
  const openai = getOpenAI()

  const response = await openai.responses.create({
    model,
    instructions: buildInstructions(systemPrompt, context),
    input: buildInput(history, userMessage),
    tools,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    ...responsesReasoning(model),
    ...temperatureParam(model, temperature),
  })

  let content = rewriteMarkdownLinks(outputText(response).trim(), rewriteLink)
  if (!content.trim()) {
    content = failureNotice(userMessage)
  } else if (response.status === 'incomplete' || response.status === 'failed') {
    logger.warn('Tool answer cut off', {
      status: response.status,
      reason: response.incomplete_details?.reason ?? response.error?.message ?? null,
      model,
    })
    content += truncationNotice(userMessage)
  }

  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
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
  options: ToolGenerationOptions & {
    /** Called with the response's token usage when OpenAI reports it at the end of the stream. */
    onUsage?: (usage: TokenUsage) => void
  },
): Promise<ReadableStream<Uint8Array>> {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = DEFAULT_CHAT_MODEL,
    temperature,
    tools,
    onUsage,
    rewriteLink = createLinkRewrite(null),
  } = options
  const openai = getOpenAI()

  const stream = await openai.responses.create({
    model,
    instructions: buildInstructions(systemPrompt, context),
    input: buildInput(history, userMessage),
    tools,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    ...responsesReasoning(model),
    ...temperatureParam(model, temperature),
    stream: true,
  })

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, content: string) => {
    if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const links = createMarkdownLinkStream(rewriteLink)
        let sent = ''
        // Why the answer ended early, if it did (token limit, filter, upstream failure).
        let cutOff: string | null = null
        // The text part the last delta belonged to, and the last characters of the
        // answer so far: a new part (message item) starts after a blank line.
        let part: string | null = null
        let lastChars = ''
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            if (!event.delta) continue
            const key = `${event.item_id}:${event.content_index}`
            const text = (part !== null && key !== part ? partSeparator(lastChars, event.delta) : '') + event.delta
            part = key
            lastChars = (lastChars + text).slice(-2)
            const out = links.push(text)
            sent += out
            send(controller, out)
          } else if (
            event.type === 'response.completed' ||
            event.type === 'response.incomplete' ||
            event.type === 'response.failed'
          ) {
            if (event.type === 'response.incomplete') {
              cutOff = `incomplete: ${event.response.incomplete_details?.reason ?? 'unknown'}`
            } else if (event.type === 'response.failed') {
              cutOff = `failed: ${event.response.error?.message ?? 'unknown'}`
            }
            // The terminal event carries the token usage for the whole response
            const usage = event.response.usage
            if (usage && onUsage) {
              try {
                onUsage({ inputTokens: usage.input_tokens, outputTokens: usage.output_tokens })
              } catch (error) {
                // Metering must never break the answer stream
                logger.error('Failed to report streamed token usage', { error: String(error) })
              }
            }
          } else if (event.type === 'error') {
            cutOff = `error: ${event.message}`
          }
        }
        const tail = links.flush()
        sent += tail
        send(controller, tail)
        if (cutOff) logger.warn('Streamed tool answer cut off', { cutOff, model })
        if (!sent.trim()) send(controller, failureNotice(userMessage))
        else if (cutOff) send(controller, truncationNotice(userMessage))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
