import { DEFAULT_SYSTEM_PROMPT, PII_GUARDRAIL } from '@/lib/chat/rag'
import { TONE_SNIPPETS, normalizeTone, normalizeLanguage, type VoiceLanguage } from './config'

// Voice-specific behavior layered on top of the bot's own system prompt. Realtime
// answers are spoken, so they must be short and natural; and the model must ground
// every factual answer in the knowledge base via the search_knowledge tool (the
// same KB-only contract the text chat enforces).
const VOICE_GUARDRAILS = `

## Voice mode
You are answering OUT LOUD over a live voice call. Speak naturally and concisely — short,
conversational sentences, no markdown, no bullet symbols, no emoji. Do not read out URLs
character by character; mention the company name instead.

## Grounding (mandatory)
- For ANY factual question about the company, its products, services, people, members, or
  content, you MUST call the search_knowledge tool FIRST and base your answer ONLY on what it
  returns. Never answer factual questions from your own training knowledge.
- If search_knowledge returns nothing relevant, say you don't have that information and offer
  to take the visitor's details so the team can follow up.
- You may handle greetings and small talk briefly without a tool call.

## Lead capture
- If the visitor wants to be contacted, asks for a quote/demo/callback, or volunteers their
  contact details, call the capture_lead tool, then confirm warmly that you've passed it on.

## Style
- Keep answers to a few sentences. Offer to go deeper rather than monologuing.`

// Language rule appended after the guardrails. `auto` keeps the bilingual auto-switch
// behavior; a pinned language overrides it entirely.
function languageRule(language: VoiceLanguage): string {
  if (language === 'en') {
    return `\n\n## Language\n- Always speak English, regardless of the language the visitor uses.`
  }
  if (language === 'it') {
    return `\n\n## Language\n- Always speak Italian (parla sempre in italiano), regardless of the language the visitor uses.`
  }
  return `\n\n## Language\n- Speak the language the visitor speaks. Support English and Italian. Switch only when the\n  visitor clearly speaks the other language — never based on an accent or a single word.`
}

// Greeting rule. The greeting text stays server-side in the instructions (never sent to the
// browser). It is used to open the call whether spoken proactively on connect or in the
// model's first reply.
function greetingRule(greeting: string): string {
  const g = greeting.trim()
  if (!g) return ''
  return `\n\n## Opening\n- Open the conversation with this greeting, adapted naturally and spoken in one short sentence: "${g.replace(/"/g, "'")}"`
}

export interface VoicePersona {
  systemPrompt?: string | null
  name?: string | null
  voiceTone?: string | null
  voiceLanguage?: string | null
  voiceGreeting?: string | null
}

/**
 * Build the full instruction string for a realtime voice session: the bot's own
 * system prompt (or the default KB-only prompt) + voice guardrails + tone + language
 * + greeting + PII rules.
 */
export function buildVoiceInstructions(bot: VoicePersona): string {
  const base = bot.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const intro = bot.name ? `You are the voice assistant for ${bot.name}.\n\n` : ''

  const tone = TONE_SNIPPETS[normalizeTone(bot.voiceTone)]
  const toneRule = tone ? `\n\n## Tone\n- ${tone}` : ''
  const langRule = languageRule(normalizeLanguage(bot.voiceLanguage))
  const greeting = greetingRule(bot.voiceGreeting ?? '')

  return intro + base + VOICE_GUARDRAILS + toneRule + langRule + greeting + PII_GUARDRAIL
}
