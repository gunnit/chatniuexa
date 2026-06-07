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

// Conservative blended cost estimate for the monthly cost-cap safety net.
// gpt-realtime-2 audio pricing (verified 2026-06-07): $32 / $64 per 1M input/output
// audio tokens. At ~600 input + ~1200 output audio tokens per conversational minute
// that is ~$0.10/min; we round up to leave headroom. The monthly minute budget
// (PlanLimits.monthlyVoiceMinutes) is the primary control — this is the backstop.
export const VOICE_COST_PER_MINUTE = 0.15

// Heartbeat cadence the client uses to report elapsed seconds. The server meters on
// every heartbeat so an abandoned tab is still billed up to its last heartbeat.
export const VOICE_HEARTBEAT_SECONDS = 15
