# Bot Tools & Remote MCP Servers — Design Spec

**Date:** 2026-05-31
**Status:** Approved (Phase 1), implementing
**Author:** brainstormed with the user

## Goal

Let chatbots call **tools** at answer time instead of only reciting their RAG knowledge base:
1. **Web search** — OpenAI-hosted, read-only, zero-config. (Pro+)
2. **Remote MCP servers** — tenant attaches a remote MCP server (URL + auth); the bot can call its read-only tools. (Business)

## Key technical constraint

Remote MCP servers and hosted web search are **built-in tools of the OpenAI Responses API** (`openai.responses.create`), not Chat Completions. The bots today run entirely on `openai.chat.completions.create` (`src/lib/chat/rag.ts`). So tool-enabled bots must route through a new Responses-API path.

## Threat model (decisive)

Bots serve **anonymous public end-users** (website embed, public `/c/[token]`, WhatsApp). The person triggering a tool call is NOT the trusted account owner. OpenAI warns: *"a malicious server can exfiltrate sensitive data from anything that enters the model's context."* Therefore:

- **Read-only for v1.** No write/act tools.
- **Approval at config time, not runtime.** Runtime `mcp_approval_request` is nonsensical for anonymous chat. The tenant picks an explicit `allowed_tools` allowlist when adding a server; we then run `require_approval: "never"` on exactly that list. Empty allowlist ⇒ nothing runs.
- **SSRF guard** on `server_url`: https-only; block localhost, private ranges, `169.254.169.254`.
- **Audit log** every `mcp_call`.
- Tokens encrypted at rest (AES-256-GCM), never returned to client, re-sent per request (OpenAI does not store them).

## Architecture

Hybrid, not a big-bang migration:

```
chat route ─┬─ no tools ─→ rag.ts (chat.completions)      [unchanged, zero regression]
            └─ has tools ─→ responses.ts (responses.create)
                              tools: [ {type:"web_search"},
                                       {type:"mcp", server_label, server_url, headers,
                                        allowed_tools, require_approval:"never"} ]
```

- RAG context is still retrieved and injected (as `instructions` + `input`).
- Streaming: Responses emits semantic events (`response.output_text.delta`); we map them back to the existing `data: {content}` SSE shape so **the frontend does not change**.
- Usage accounting switches to real `response.usage` (tools inflate tokens; cost is gated by `monthlyCostLimit`).
- Guardrail softens for tool-enabled bots: "knowledge base **and** your connected tools."

## Data model (Prisma, additive)

```prisma
// on Chatbot
webSearchEnabled  Boolean  @default(false)
mcpServers        ChatbotMcpServer[]

model ChatbotMcpServer {
  id           String   @id @default(cuid())
  chatbotId    String
  label        String   // server_label (slug)
  serverUrl    String   // server_url (https, SSRF-guarded)
  description  String?
  authToken    String?  @db.Text   // AES-256-GCM ciphertext, nullable
  allowedTools String[] @default([])  // explicit allowlist — empty = nothing runs
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  chatbot      Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  @@index([chatbotId])
}
```

Migration is hand-written (additive: nullable column w/ default + new table) and applied via `prisma migrate deploy` on the Render build — never `migrate dev`/`db push` against the production DB.

## Plan gating (`src/lib/plans.ts`)

| Plan | `toolsEnabled` (web search) | `mcpServersEnabled` | `maxMcpServers` |
|------|------|------|------|
| free | false | false | 0 |
| pro  | true  | false | 0 |
| business | true | true | 5 |

## Files

- `prisma/schema.prisma` + `prisma/migrations/20260531000000_add_chatbot_tools/migration.sql`
- `src/lib/plans.ts` — gating flags
- `src/lib/encryption.ts` — generic `encryptSecret`/`decryptSecret` (reuses `WHATSAPP_ENCRYPTION_KEY`)
- `src/lib/chat/tools.ts` — `chatbotHasTools()`, `buildChatbotTools()`, SSRF guard, MCP tool-list discovery
- `src/lib/chat/responses.ts` — Responses-API generation (streaming + non-streaming), SSE mapping
- `src/app/api/chat/route.ts` + `src/app/api/chat/stream/route.ts` — branch on tools
- `src/app/api/chatbots/[id]/mcp-servers/route.ts` (GET/POST) + `[serverId]/route.ts` (DELETE) + `discover/route.ts`
- `src/app/[locale]/dashboard/chatbots/[id]/page.tsx` — "Tools" tab UI

## Testing / audit

1. `tsc --noEmit` after each slice.
2. Direct integration check: call the tool path with a real `OPENAI_API_KEY`, assert web_search is invoked and a live answer returns.
3. Deploy to Render (Linux, applies migration), then **Playwright** against the live public chat of a tools-enabled bot — confirm (a) tool-enabled bot answers with live info, (b) RAG-only bots unchanged, (c) config UI toggles persist.

## Phase 2 (future, separate spec)

First-party safe-write tools (lead capture / booking / ticketing) with per-tool rate limits + validation; optional connector catalog.
