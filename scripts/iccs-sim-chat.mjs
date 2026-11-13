#!/usr/bin/env node
/**
 * One simulated-visitor turn against the live ICCS bot, sent exactly the way the
 * widget on italchamber.org.sg sends it (same endpoint, body, Origin and Referer).
 * Used by the daily visitor simulation (docs/iccs-visitor-simulation.md): the
 * person or agent playing the visitor reads each answer and writes the next turn.
 *
 *   node scripts/iccs-sim-chat.mjs --personas-today                → today's two persona ids
 *   node scripts/iccs-sim-chat.mjs --new <persona>                 → prints a new session id
 *   node scripts/iccs-sim-chat.mjs --session <id> [--page /events] "message"
 *   node scripts/iccs-sim-chat.mjs --session <id> --json "message" → machine-readable turn
 *
 * Every session id starts with "sim-", so these chats are stored like any other
 * conversation but never count as real visitors (scripts/iccs-stats.mjs puts them
 * under internal_sim, next to audit-* and test-*). Each turn is appended to
 * <SIM_LOG_DIR or ./sim-logs>/<session>.jsonl.
 *
 * Env: BOT_BASE (default https://chatniuexa.onrender.com, the host the ICCS embed
 * loads widget.js from), BOT_ID (default the ICCS bot), SIM_SITE (default
 * https://italchamber.org.sg), SIM_LOG_DIR.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BOT_BASE || 'https://chatniuexa.onrender.com'
const CHATBOT_ID = process.env.BOT_ID || 'cmn93l00d00d713vkdcnkymzn'
const SITE = (process.env.SIM_SITE || 'https://italchamber.org.sg').replace(/\/$/, '')
const LOG_DIR = process.env.SIM_LOG_DIR || 'sim-logs'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const SESSION_PREFIX = 'sim-'

/** Persona ids from docs/iccs-visitor-simulation.md, in rotation order. */
export const PERSONAS = [
  'furniture-sme-it', 'hotel-fnb-buyer', 'expat-networker', 'student-internship-it', 'consultant-governance',
  'legal-search', 'startup-founder-tech', 'wine-exporter-it', 'member-hr', 'journalist',
  'logistics-buyer', 'restaurateur-it', 'off-topic-tourist', 'pharma-manager',
]

/** The two personas for a day: a fixed rotation that covers all of them every week. */
export function personasForDay(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000)
  const i = (((day * 2) % PERSONAS.length) + PERSONAS.length) % PERSONAS.length
  return [PERSONAS[i], PERSONAS[(i + 1) % PERSONAS.length]]
}

export function newSessionId(persona = 'visitor', now = new Date()) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '')
  const slug = String(persona).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'visitor'
  return `${SESSION_PREFIX}${day}-${slug}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Parse a complete SSE body from /api/chat/stream into its parts. Events are
 * separated by a blank line; each carries one `data: ` line.
 */
export function parseSse(text) {
  const out = { content: '', metadata: null, messageId: null, suggestions: [], done: false, events: 0 }
  for (const block of text.split(/\n\n/)) {
    const line = block.split('\n').find((l) => l.startsWith('data: '))
    if (!line) continue
    out.events++
    const payload = line.slice(6)
    if (payload === '[DONE]') { out.done = true; continue }
    let parsed
    try { parsed = JSON.parse(payload) } catch { continue }
    if (parsed.type === 'metadata') out.metadata = parsed
    else if (parsed.type === 'suggestions' && Array.isArray(parsed.suggestions)) out.suggestions = parsed.suggestions
    else if (parsed.messageId) out.messageId = parsed.messageId
    else if (typeof parsed.content === 'string') out.content += parsed.content
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Send one message; resolves with the parsed answer and timings. Retries 429s. */
export async function sendTurn({ sessionId, message, page = '/' }) {
  if (!sessionId.startsWith(SESSION_PREFIX)) throw new Error(`session id must start with "${SESSION_PREFIX}"`)
  const pagePath = page.startsWith('/') ? page : `/${page}`
  for (let attempt = 1; ; attempt++) {
    const started = Date.now()
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        Origin: SITE,
        Referer: `${SITE}${pagePath}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ chatbotId: CHATBOT_ID, sessionId, message }),
    })
    if (res.status === 429 && attempt <= 4) { await sleep(15000 * attempt); continue }
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${body.slice(0, 300)}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let raw = ''
    let firstTokenMs = null
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      raw += decoder.decode(value, { stream: true })
      if (firstTokenMs === null && raw.includes('"content"')) firstTokenMs = Date.now() - started
    }
    raw += decoder.decode()
    const parsed = parseSse(raw)
    return { ...parsed, firstTokenMs, totalMs: Date.now() - started }
  }
}

function logTurn(sessionId, entry) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  fs.appendFileSync(path.join(LOG_DIR, `${sessionId}.jsonl`), JSON.stringify(entry) + '\n')
}

function parseArgs(argv) {
  const args = { page: '/', json: false, rest: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--new') args.newPersona = argv[++i] ?? 'visitor'
    else if (a === '--personas-today') args.personasToday = true
    else if (a === '--session') args.session = argv[++i]
    else if (a === '--page') args.page = argv[++i] ?? '/'
    else if (a === '--json') args.json = true
    else args.rest.push(a)
  }
  args.message = args.rest.join(' ').trim()
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.personasToday) { console.log(personasForDay().join(' ')); return }
  if (args.newPersona !== undefined) { console.log(newSessionId(args.newPersona)); return }
  if (!args.session || !args.message) {
    console.error('Usage: node scripts/iccs-sim-chat.mjs --session <sim-...> [--page /path] [--json] "message"')
    process.exit(2)
  }
  const at = new Date().toISOString()
  const turn = await sendTurn({ sessionId: args.session, message: args.message, page: args.page })
  const entry = {
    at, sessionId: args.session, page: args.page, user: args.message, assistant: turn.content,
    messageId: turn.messageId, suggestions: turn.suggestions, confidence: turn.metadata?.confidence ?? null,
    sources: turn.metadata?.sources?.length ?? 0, firstTokenMs: turn.firstTokenMs, totalMs: turn.totalMs, done: turn.done,
  }
  logTurn(args.session, entry)
  if (args.json) { console.log(JSON.stringify(entry)); return }
  console.log(turn.content || '(empty answer)')
  console.log('\n---')
  if (turn.suggestions.length) console.log(`suggested follow-ups: ${turn.suggestions.map((s) => `"${s}"`).join(' | ')}`)
  console.log(`first token ${turn.firstTokenMs ?? '-'} ms · total ${turn.totalMs} ms · ${entry.sources} sources · confidence ${entry.confidence} · messageId ${turn.messageId ?? 'MISSING'}${turn.done ? '' : ' · NO [DONE]'}`)
}

// Run only when executed directly, so tests can import the helpers. (fileURLToPath +
// realpath: correct for paths with spaces, symlinks and Windows drive letters.)
export function isEntryPoint(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false
  try {
    return fs.realpathSync(path.resolve(argv1)) === fs.realpathSync(fileURLToPath(metaUrl))
  } catch {
    return false
  }
}
if (isEntryPoint(import.meta.url)) {
  main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
