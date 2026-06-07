# Realtime Voice Widget — Design Spec

**Date:** 2026-06-07
**Status:** Approved (decisions delegated to Claude by owner)
**Author:** Gregor Maric + Claude

## One-liner

Add a **"🎙 Talk" voice mode** to the embeddable ChatAziendale widget: a site visitor
clicks a button and has a natural, low-latency spoken conversation with the company's
bot — answers spoken aloud, **grounded in the existing pgvector RAG knowledge base**,
and able to **capture a lead by voice**. Powered by OpenAI's Realtime API
(`gpt-realtime-2`) over WebRTC.

## Why (goal)

Primary goal: **sales differentiation** — a demo-able "wow" that closes deals. A prospect
pastes their site, the bot already knows their content, they click the mic and *talk to
their own data*. Almost no SMB chatbot SaaS does grounded realtime voice. Secondary
benefits: clean Business-tier upsell, and a credible path to a phone-line / "AI
receptionist" product later.

## Scope (v1)

**In scope**
- Voice mode on the **web widget** (and the hosted `/c/[token]` share page).
- **Spoken Q&A grounded in RAG** via a `search_knowledge` function tool that round-trips
  to the existing retrieval layer.
- **Voice lead capture** via a `capture_lead` function tool → saved as a `Lead`.
- **Bilingual EN/IT** (model auto-switches per the user's spoken language).
- **Per-bot config**: enable/disable voice, pick a voice.
- **Metering + gating**: Business plan only; per-session hard cap (5 min, auto-disconnect);
  monthly voice-minute budget; voice cost folded into the existing monthly cost cap.

**Out of scope (deferred)**
- Phone number / Twilio channel (phase 2 — reuses comtel-voice-agent patterns).
- WhatsApp voice notes.
- Full tool parity (web search / MCP) inside voice.
- Voice on Free/Pro tiers.

## Key decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Model | `gpt-realtime-2` (config: fallback `gpt-realtime-1.5`) | GA, strongest tool use + instruction following |
| Transport | **WebRTC**, browser ↔ OpenAI direct | API key never on client; audio never transits our servers → lower latency + cost |
| Auth to OpenAI | **Ephemeral client secret** minted server-side | `POST /v1/realtime/client_secrets`; key stays server-side |
| RAG grounding | **Function calling** (`search_knowledge`) | Reuses `prepareStreamingContext`; model decides when to retrieve |
| Lead capture | **Function calling** (`capture_lead`) | One tool; "AI receptionist" story |
| Gating | **Business only** | Premium differentiator; contains cost to tier that absorbs it |
| Session cap | **5 min** auto-disconnect | Cost-blowup protection (open-mic abandonment) |
| Metering | seconds → monthly voice-minute budget + cost cap | Realtime audio is billed per minute, far pricier than text |

## Architecture

```
Browser widget                       Our server (Next.js)                 OpenAI
─────────────                        ────────────────────                 ──────
[Talk] click ──POST /api/voice/session──▶ validate plan+budget+CORS
                                          build instructions+tools
                                          POST /v1/realtime/client_secrets ─▶
              ◀── {token,sessionId,maxSeconds,voice} ── create VoiceSession
RTCPeerConnection
  createOffer ──POST https://api.openai.com/v1/realtime/calls (Bearer EPHEMERAL)──▶
  ◀── SDP answer ──────────────────────────────────────────────────────────────────
  audio tracks <──── speech-to-speech ──────────────────────────────────────────────
  data channel "oai-events":
    response.done {function_call search_knowledge}
       └─POST /api/voice/retrieve {sessionId,query}─▶ prepareStreamingContext()
         ◀── {context} ── send function_call_output + response.create ──▶ OpenAI
    response.done {function_call capture_lead}
       └─POST /api/voice/lead {sessionId,...}─▶ create Lead
  every 15s ──POST /api/voice/heartbeat {sessionId,elapsed}──▶ meter; {stop?} if over budget
  end / 5-min cap ──POST /api/voice/heartbeat {sessionId,elapsed,final:true}──▶ finalize
```

### Components

**1. Plan gating — `src/lib/plans.ts`**
Add to `PlanLimits`: `voiceEnabled: boolean`, `monthlyVoiceMinutes: number`,
`maxVoiceSessionSeconds: number`. Free/Pro: `false/0/0`. Business:
`true / 300 / 300`. Add a Business feature string. `applyPlanLimits` writes
`monthlyVoiceMinutes` into the usage row.

**2. Data model — `prisma/schema.prisma`** (migration `*_add_voice`)
- `UsageLimit`: `+ monthlyVoiceMinutes Int @default(0)`,
  `+ currentMonthVoiceSeconds Int @default(0)`.
- `Chatbot`: `+ voiceEnabled Boolean @default(false)`, `+ voiceName String @default("marin")`.
- New `VoiceSession` — minted-session ledger for metering + endpoint auth:
  `id` (cuid, == sessionId handed to client), `chatbotId`, `tenantId`,
  `secondsUsed Int @default(0)`, `status` (`active|ended|expired`), `createdAt`, `updatedAt`,
  `expiresAt`. Indexed on `chatbotId`, `createdAt`.
- New `Lead`: `id`, `chatbotId`, `tenantId`, `voiceSessionId?`, `name?`, `email?`,
  `phone?`, `note?`, `createdAt`. Indexed on `chatbotId`, `createdAt`.
- `Conversation.channel` already exists → voice transcripts (optional) tagged `'voice'`.

**3. Server lib — `src/lib/voice/`**
- `session.ts`: `mintVoiceSession(chatbot)` → calls OpenAI client_secrets, builds
  instructions (`buildVoiceInstructions`) + tool schemas (`VOICE_TOOLS`), creates
  `VoiceSession`, returns client payload. `validateSession(sessionId)` → loads + checks
  active/expiry. `meterVoiceSession(sessionId, elapsedSeconds, final)` → atomic SQL
  increment of `currentMonthVoiceSeconds` + cost (mirrors `logUsage` pattern), returns
  `{ allowed, remainingSeconds }`.
- `instructions.ts`: `buildVoiceInstructions(bot)` — bot system prompt + voice-specific
  guardrails (concise spoken answers, **always call `search_knowledge` before answering
  factual questions**, KB-only scope, PII rules reused from `rag.ts`, bilingual rule:
  "Default to the language the visitor speaks; support Italian and English").
- `tools.ts`: JSON schemas for `search_knowledge({query})` and
  `capture_lead({name?,email?,phone?,note?})`.
- `cost.ts`: `VOICE_COST_PER_MINUTE` constant → fold into monthly cost cap.

**4. API routes — `src/app/api/voice/`** (all CORS-enabled like the widget; added to
`publicPrefixes` in middleware)
- `POST /api/voice/session` — body `{ chatbotId }` (+ Origin checked against
  `allowedDomains`). Gate: tenant plan `voiceEnabled` && `chatbot.voiceEnabled` &&
  monthly voice budget remaining. Returns `{ token, sessionId, model, voice,
  maxSessionSeconds, expiresAt }`. 402/403 with reason otherwise.
- `POST /api/voice/retrieve` — body `{ sessionId, query }` → validate session →
  `prepareStreamingContext(tenantId, query)` → `{ context }` (length-bounded).
- `POST /api/voice/lead` — body `{ sessionId, name?, email?, phone?, note? }` → create
  `Lead` → `{ ok: true }`.
- `POST /api/voice/heartbeat` — body `{ sessionId, elapsedSeconds, final? }` →
  `meterVoiceSession` → `{ stop: boolean, remainingSeconds }`.

**5. Widget front-end** (vanilla JS injected by `src/app/api/widget/[id]/route.ts`, mirrored
in the React `PublicChatClient`)
- A mic button appears only when `voiceEnabled` for the bot.
- `VoiceController`: requests mic, `POST /api/voice/session`, builds `RTCPeerConnection`,
  SDP exchange with `https://api.openai.com/v1/realtime/calls`, attaches remote audio,
  opens `oai-events` data channel.
- Data-channel handler: on `response.done` with a `function_call`, dispatch to
  `/api/voice/retrieve` or `/api/voice/lead`, then send `function_call_output` +
  `response.create`. Render live transcript from `response.output_text`/transcript events.
- UI: animated mic orb (speaking/listening states), live transcript, countdown timer,
  "End" button. Barge-in handled natively by the Realtime VAD.
- Enforces `maxSessionSeconds` client-side (hard stop) + obeys `stop:true` from heartbeat.

**6. Dashboard config** — Channels/Settings tab gains a **Voice** card (Business-gated):
toggle `voiceEnabled`, voice picker (`marin`, `cedar`, …), live-preview hint. Extends the
existing chatbot config API (`PATCH /api/chatbots/[id]`). A **Leads** view lists captured
leads. i18n keys added to `messages/en.json` + `messages/it.json`.

## Data flow — RAG-grounded answer

1. Visitor speaks → Realtime VAD → model transcribes + reasons.
2. Model emits `function_call search_knowledge {query}` on the data channel.
3. Widget `POST /api/voice/retrieve {sessionId, query}`.
4. Server validates session, runs `prepareStreamingContext(tenantId, query)` (same
   retrieval, directory recall, confidence as text chat), returns bounded `context`.
5. Widget sends `function_call_output` (the context) then `response.create`.
6. Model speaks an answer grounded only in that context (KB-only guardrail).

## Error handling

- **No mic permission** → inline message, fall back to text chat.
- **Not entitled / over budget** → `/api/voice/session` returns 402/403; widget hides or
  disables the mic with a tooltip ("Voice is a Business feature" / "Monthly voice limit
  reached").
- **OpenAI client_secrets failure** → 502; widget shows "Voice unavailable, try text."
- **Session expiry / 5-min cap** → client hard-stops, closes peer connection, final
  heartbeat with `final:true`.
- **Abandoned tab** → 15s heartbeats stop arriving; a sweep (cron or lazy on next mint)
  marks sessions `expired` and meters their last-known `secondsUsed` (already persisted
  each heartbeat, so cost is captured even without a clean end).
- **Retrieve/lead failures** → return a graceful `function_call_output` so the model can
  apologize rather than hang.

## Security

- API key never leaves the server; client gets only a short-lived ephemeral token.
- `sessionId` is an opaque server-issued id tied to chatbot/tenant with an `expiresAt`;
  all voice endpoints authorize via it. Retrieval is read-only over the same public KB the
  text widget already exposes.
- CORS: voice endpoints validate `Origin` against the bot's `allowedDomains` (same as the
  widget chat endpoints).
- SSRF: N/A (no outbound URLs from voice tools in v1).
- PII: lead capture is intentional/consented; the KB PII guardrail from `rag.ts` is carried
  into the voice instructions so the bot won't echo private data.
- Cost-abuse: per-session cap + monthly budget + cost-cap fold + heartbeat metering.

## Metering & cost

- Track **seconds** in `currentMonthVoiceSeconds`; budget = `monthlyVoiceMinutes * 60`.
- Each heartbeat increments seconds atomically (same conditional-UPDATE pattern as
  `logUsage`) and adds `elapsedDelta/60 * VOICE_COST_PER_MINUTE` to `currentMonthCost`.
- When seconds ≥ budget OR cost ≥ `monthlyCostLimit`, heartbeat returns `stop:true`.

## Testing

- `npx tsc --noEmit` after each layer (primary verification per WSL rules).
- Unit-test pure functions: `buildVoiceInstructions`, tool-schema validity, metering math
  (`meterVoiceSession` budget arithmetic), CORS/origin check.
- Manual realtime audio test happens **on Render** (WSL can't reliably run the dev server;
  WebRTC mic needs a real browser). Smoke checklist: mint session → talk → factual question
  triggers `search_knowledge` → grounded spoken answer → "leave my email" triggers
  `capture_lead` → Lead row appears → 5-min cap disconnects → minutes metered.

## Build sequence

1. Plans + Prisma schema + migration (gating + metering + Lead/VoiceSession). `tsc`.
2. `src/lib/voice/*` (instructions, tools, session mint, metering, cost). `tsc`.
3. API routes (`session`, `retrieve`, `lead`, `heartbeat`) + middleware public prefix. `tsc`.
4. Widget `VoiceController` + UI (vanilla JS) and React mirror. `tsc`.
5. Dashboard config card + Leads view + i18n. `tsc`.
6. Deploy to Render; run smoke checklist.

## Open questions (resolved by owner delegation — defaults chosen)

- Session cap: **5 min**. Monthly Business budget: **300 min**. Voice cost/min: set from
  live OpenAI Realtime audio pricing at implementation time (verify before shipping).
- Default voice: **marin**. Bilingual: automatic by spoken language.
- Transcript persistence: store as a `Conversation(channel:'voice')` with messages
  (best-effort) so voice chats show in history like text — low risk, high analytics value.
