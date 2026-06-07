// Realtime voice configuration shared by server (session minting / metering) and
// surfaced to the client (model + voice). Keep this the single source of truth.

// GA reasoning speech-to-speech model with strong tool use + instruction following.
// (`gpt-realtime-1.5` is the faster non-reasoning alternative.)
export const VOICE_MODEL = 'gpt-realtime-2'

// OpenAI Realtime SDP exchange endpoint (browser posts its SDP offer here with the
// ephemeral key). The ephemeral secret is minted server-side via /v1/realtime/client_secrets.
export const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'
export const REALTIME_CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets'

// Voices offered in the dashboard picker. `marin` is the default.
export const VOICE_OPTIONS = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'sage', 'verse'] as const
export type VoiceName = (typeof VOICE_OPTIONS)[number]
export const DEFAULT_VOICE: VoiceName = 'marin'

export function normalizeVoice(voice: string | null | undefined): VoiceName {
  return (VOICE_OPTIONS as readonly string[]).includes(voice ?? '')
    ? (voice as VoiceName)
    : DEFAULT_VOICE
}

// --- Brand & personality presets -------------------------------------------------
// These knobs are surfaced in the dashboard and compiled into the session
// instruction string at mint time (see instructions.ts), except `speed`, which maps
// directly to the Realtime `audio.output.speed` param.

export const VOICE_TONES = ['default', 'friendly', 'professional', 'energetic', 'calm'] as const
export type VoiceTone = (typeof VOICE_TONES)[number]
export const DEFAULT_VOICE_TONE: VoiceTone = 'default'

// Tone → instruction snippet. `default` adds nothing (keeps the bot's own system prompt voice).
export const TONE_SNIPPETS: Record<VoiceTone, string> = {
  default: '',
  friendly: 'Speak in a warm, friendly, approachable way — like a helpful colleague.',
  professional: 'Speak in a polished, professional, businesslike manner.',
  energetic: 'Speak with an upbeat, enthusiastic, energetic delivery.',
  calm: 'Speak in a calm, measured, reassuring way.',
}

export function normalizeTone(tone: string | null | undefined): VoiceTone {
  return (VOICE_TONES as readonly string[]).includes(tone ?? '') ? (tone as VoiceTone) : DEFAULT_VOICE_TONE
}

// `auto` keeps the existing EN/IT auto-switch rule; `en`/`it` hard-pin the spoken language.
export const VOICE_LANGUAGES = ['auto', 'en', 'it'] as const
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]
export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = 'auto'

export function normalizeLanguage(lang: string | null | undefined): VoiceLanguage {
  return (VOICE_LANGUAGES as readonly string[]).includes(lang ?? '')
    ? (lang as VoiceLanguage)
    : DEFAULT_VOICE_LANGUAGE
}

// Realtime `audio.output.speed` accepts 0.25–1.5; we clamp to a sane conversational band.
export const VOICE_SPEED_MIN = 0.75
export const VOICE_SPEED_MAX = 1.25
export const DEFAULT_VOICE_SPEED = 1.0

export function clampSpeed(speed: number | null | undefined): number {
  const n = typeof speed === 'number' && Number.isFinite(speed) ? speed : DEFAULT_VOICE_SPEED
  return Math.min(VOICE_SPEED_MAX, Math.max(VOICE_SPEED_MIN, n))
}

// Conservative blended cost estimate for the monthly cost-cap safety net.
// gpt-realtime-2 audio pricing (verified 2026-06-07): $32 / $64 per 1M input/output
// audio tokens. At ~600 input + ~1200 output audio tokens per conversational minute
// that is ~$0.10/min; we round up to leave headroom. The monthly minute budget
// (PlanLimits.monthlyVoiceMinutes) is the primary control — this is the backstop.
export const VOICE_COST_PER_MINUTE = 0.15

// Heartbeat cadence the client uses to report elapsed seconds. The server meters on
// every heartbeat so an abandoned tab is still billed up to its last heartbeat.
export const VOICE_HEARTBEAT_SECONDS = 15
