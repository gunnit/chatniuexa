// OpenAI chat models — the single source of truth for the dashboard model
// picker, per-request parameters, and usage cost estimates. Pure data (no
// server imports) so client components can use it too.
//
// Pricing and parameter support verified against developers.openai.com on
// 2026-09-29. When adding a model, add it here only.

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high'

export interface ChatModelInfo {
  id: string
  label: string
  /** USD per 1M tokens, Standard tier, prompts up to 272K tokens. */
  inputPer1M: number
  outputPer1M: number
  /**
   * Sent explicitly on every request. GPT-6 Sol/Luna default to `medium`
   * reasoning, which adds latency before the first token and spends
   * max_completion_tokens on reasoning; `none` keeps the behaviour of the
   * GPT-5.4 generation, whose default was `none`. Omitted = keep the model's
   * own default (what we have always sent to the previous generation).
   */
  reasoningEffort?: ReasoningEffort
  /**
   * Whether requests may carry the bot's `temperature`. GPT-5.2, GPT-5.4 and
   * GPT-6 accept it only while the effective reasoning effort is `none` (the
   * `reasoningEffort` above, or the model's own default when that is omitted)
   * and reject it with a 400 at any other effort; GPT-6 Astra has no `none`, so
   * never. Required so that every model added gets a deliberate answer.
   */
  supportsTemperature: boolean
  /** Superseded but still served by OpenAI — shown under "Previous generation". */
  previous?: boolean
}

export const CHAT_MODELS: readonly ChatModelInfo[] = [
  {
    id: 'gpt-6-luna',
    label: 'GPT-6 Luna (Recommended — Fast & Affordable)',
    inputPer1M: 0.1,
    outputPer1M: 0.5,
    reasoningEffort: 'none',
    supportsTemperature: true,
  },
  {
    id: 'gpt-6-sol',
    label: 'GPT-6 Sol (Smartest — Higher Cost)',
    inputPer1M: 2.0,
    outputPer1M: 10.0,
    reasoningEffort: 'none',
    supportsTemperature: true,
  },
  // All four default to reasoning effort `none`, so they accept temperature.
  { id: 'gpt-5.4', label: 'GPT-5.4', inputPer1M: 2.5, outputPer1M: 15.0, supportsTemperature: true, previous: true },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', inputPer1M: 0.75, outputPer1M: 4.5, supportsTemperature: true, previous: true },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', inputPer1M: 0.2, outputPer1M: 1.25, supportsTemperature: true, previous: true },
  { id: 'gpt-5.2', label: 'GPT-5.2', inputPer1M: 1.75, outputPer1M: 14.0, supportsTemperature: true, previous: true },
]

export const DEFAULT_CHAT_MODEL = 'gpt-6-luna'

export function getChatModel(id: string): ChatModelInfo | undefined {
  return CHAT_MODELS.find((m) => m.id === id)
}

/** Whether a model id may be assigned to a chatbot. */
export function isSelectableChatModel(id: string): boolean {
  return getChatModel(id) !== undefined
}

/** Reasoning params for `chat.completions.create` — spread into the request body. */
export function chatCompletionsReasoning(model: string): { reasoning_effort?: ReasoningEffort } {
  const effort = getChatModel(model)?.reasoningEffort
  return effort ? { reasoning_effort: effort } : {}
}

/** Reasoning params for `responses.create` — spread into the request body. */
export function responsesReasoning(model: string): { reasoning?: { effort: ReasoningEffort } } {
  const effort = getChatModel(model)?.reasoningEffort
  return effort ? { reasoning: { effort } } : {}
}

/**
 * Whether requests to this model may carry `temperature`. Also requires the
 * effort we send to be `none` (omitted = the model's default, which the flag
 * already accounts for), so raising a model's `reasoningEffort` can never start
 * sending a parameter OpenAI rejects. Unknown ids → false.
 */
export function supportsTemperature(model: string): boolean {
  const info = getChatModel(model)
  if (!info?.supportsTemperature) return false
  return info.reasoningEffort === undefined || info.reasoningEffort === 'none'
}

/** Temperature param for `chat.completions.create` and `responses.create` — spread into the request body. */
export function temperatureParam(model: string, temperature: number | undefined): { temperature?: number } {
  return temperature !== undefined && supportsTemperature(model) ? { temperature } : {}
}
