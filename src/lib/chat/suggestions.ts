/**
 * Follow-up suggestions: after an answer, a small model call proposes the next
 * questions a visitor is likely to ask. The widget, the public chat page and the
 * dashboard test chat show them as clickable chips under the latest answer.
 *
 * Runs only for bots with `followUpSuggestions` on, after the answer has been
 * streamed, so it never delays or alters the answer itself. Best effort: any
 * failure (timeout, refusal, malformed output) just means no chips.
 */
import type OpenAI from 'openai'
import { getOpenAI } from '@/lib/openai'
import { logger } from '@/lib/logger'
import { DEFAULT_CHAT_MODEL, chatCompletionsReasoning, temperatureParam } from '@/lib/models'
import type { TokenUsage } from '@/lib/usage'
import type { ChatTurn } from '@/lib/chat/history'

export const MAX_SUGGESTIONS = 3
/** Hard cap for one chip; the model is asked for 60 characters. */
export const MAX_SUGGESTION_CHARS = 90
const MIN_SUGGESTION_CHARS = 4

/** Registry model: cheap and fast is enough to phrase three short questions. */
export const SUGGESTIONS_MODEL = DEFAULT_CHAT_MODEL
const SUGGESTIONS_TIMEOUT_MS = 8000
const MAX_ANSWER_CHARS = 3000
const MAX_PRIOR_TURN_CHARS = 600
const MAX_PRIOR_TURNS = 4

export interface SuggestionsInput {
  botName: string
  botDescription?: string | null
  /** Earlier turns, oldest first, NOT including the current question and answer. */
  history?: ChatTurn[]
  userMessage: string
  answer: string
  /** Titles of the knowledge-base documents the answer drew on. */
  sourceTitles?: string[]
}

export interface SuggestionsResult {
  suggestions: string[]
  usage?: TokenUsage
  model: string
}

const SYSTEM_PROMPT = `You write the follow-up questions shown as clickable buttons under a website assistant's latest answer. A visitor clicks one to continue the conversation.

Return exactly ${MAX_SUGGESTIONS} questions the visitor is most likely to want to ask next.
- Write each one as the visitor would type it to the assistant, in the language of the visitor's last message.
- Move the conversation forward: go one step deeper into the answer (details about something it named, how to contact them, how to join or register, a related member, event or topic) or take the natural next step. Never repeat or rephrase the visitor's question, and never ask for something the answer already gives in full.
- Only suggest questions this assistant can answer, given what it covers (described below). Never suggest something the answer said it cannot help with.
- Use names exactly as they appear in the answer. Do not introduce facts, prices or dates that are not in the conversation.
- Each question at most 60 characters, a single question ending with "?", no numbering, quotes or emojis.
- The ${MAX_SUGGESTIONS} questions must be clearly different from each other.`

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s)

/** Build the chat messages for the suggestions call. Exported for tests. */
export function buildSuggestionsMessages(
  input: SuggestionsInput,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const lines: string[] = [`Assistant: ${input.botName}`]
  if (input.botDescription?.trim()) lines.push(`What it covers: ${input.botDescription.trim()}`)
  const titles = [...new Set((input.sourceTitles || []).map((t) => t.trim()).filter(Boolean))].slice(0, 8)
  if (titles.length) lines.push(`Knowledge it used for this answer: ${titles.join('; ')}`)
  lines.push('', 'Conversation (oldest first):')
  for (const turn of (input.history || []).slice(-MAX_PRIOR_TURNS)) {
    lines.push(`${turn.role === 'user' ? 'Visitor' : 'Assistant'}: ${clip(turn.content.trim(), MAX_PRIOR_TURN_CHARS)}`)
  }
  lines.push(`Visitor: ${clip(input.userMessage.trim(), MAX_PRIOR_TURN_CHARS)}`)
  lines.push(`Assistant (latest answer): ${clip(input.answer.trim(), MAX_ANSWER_CHARS)}`)
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}

const normalizeForCompare = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Clean one model-written suggestion; null when it is unusable. Exported for tests. */
export function sanitizeSuggestion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let s = value.replace(/\s+/g, ' ').trim()
  s = s.replace(/^(?:\d+\s*[.)]\s*|[-*•·]\s+)/, '') // list markers
  s = s.replace(/[*_`]+/g, '') // markdown emphasis / code
  s = s.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim() // wrapping quotes
  if (s.length < MIN_SUGGESTION_CHARS || s.length > MAX_SUGGESTION_CHARS) return null
  if (!/[\p{L}\p{N}]/u.test(s)) return null
  return s
}

/**
 * Parse the model's output into at most MAX_SUGGESTIONS clean, distinct
 * questions. Accepts `{"suggestions": [...]}` or a bare array, with or without a
 * code fence. Drops a suggestion that just repeats the visitor's question.
 */
export function parseSuggestions(raw: string | null | undefined, userMessage = ''): string[] {
  if (!raw) return []
  const text = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    const obj = text.match(/\{[\s\S]*\}/)
    const arr = text.match(/\[[\s\S]*\]/)
    try {
      data = JSON.parse((obj ?? arr)?.[0] ?? '')
    } catch {
      return []
    }
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { suggestions?: unknown }).suggestions)
      ? (data as { suggestions: unknown[] }).suggestions
      : []

  const seen = new Set<string>()
  const asked = normalizeForCompare(userMessage)
  if (asked) seen.add(asked)
  const out: string[] = []
  for (const item of list) {
    const s = sanitizeSuggestion(item)
    if (!s) continue
    const key = normalizeForCompare(s)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length === MAX_SUGGESTIONS) break
  }
  return out
}

const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'follow_up_suggestions',
    strict: true,
    schema: {
      type: 'object',
      properties: { suggestions: { type: 'array', items: { type: 'string' } } },
      required: ['suggestions'],
      additionalProperties: false,
    },
  },
}

/**
 * Ask the model for follow-up questions. Never throws; resolves to null when
 * nothing usable came back (the caller then simply shows no chips).
 */
export async function generateFollowUpSuggestions(
  input: SuggestionsInput,
  options: { timeoutMs?: number } = {},
): Promise<SuggestionsResult | null> {
  if (!input.answer.trim()) return null
  const model = SUGGESTIONS_MODEL
  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model,
        messages: buildSuggestionsMessages(input),
        response_format: RESPONSE_FORMAT,
        max_completion_tokens: 400,
        ...chatCompletionsReasoning(model),
        ...temperatureParam(model, 0.5),
      },
      { timeout: options.timeoutMs ?? SUGGESTIONS_TIMEOUT_MS, maxRetries: 0 },
    )
    const usage = completion.usage
      ? { inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }
      : undefined
    const suggestions = parseSuggestions(completion.choices[0]?.message?.content, input.userMessage)
    return { suggestions, usage, model }
  } catch (error) {
    logger.warn('Follow-up suggestions failed', { error: String(error) })
    return null
  }
}
