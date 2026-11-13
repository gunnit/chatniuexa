#!/usr/bin/env node
/**
 * Automated checks over simulated-visitor transcripts written by
 * scripts/iccs-sim-chat.mjs (one JSON object per turn, one .jsonl file per
 * session). Part of the daily simulation (docs/iccs-visitor-simulation.md); the
 * agent playing the visitors adds its own judgement on accuracy and tone.
 *
 *   node scripts/iccs-sim-report.mjs <file.jsonl | dir> [...] [--check-links] [--expect-suggestions] [--json]
 *
 *   --check-links         open every member link on italchamber.org.sg and fail the ones that
 *                         show an empty profile (pages behind the site's bot check: "unverified")
 *   --expect-suggestions  warn when an answer came without follow-up questions
 *   --json                machine-readable output
 *
 * Exit code 1 when any check FAILs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { isEntryPoint } from './iccs-sim-chat.mjs'

const SITE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MEMBER_LINK_RE = /\]\((https?:\/\/(?:www\.)?italchamber\.org\.sg\/membership-directory\/corporate\/(\d+)[^)\s]*)\)/g
const CANONICAL_MEMBER_RE = /^https:\/\/italchamber\.org\.sg\/membership-directory\/corporate\/\d+#page-member-ajax$/
const GREETING_RE = /^\W*(hello|hi|hey|ciao|buongiorno|buonasera|salve|good (morning|afternoon|evening)|welcome|benvenut[oiae])\b/i
const JARGON_RE = /knowledge[ -]base|base di conoscenza|provided (context|information|documents)|informazioni (fornite|a mia disposizione)|as an ai\b/i
const BARE_CITATION_RE = /\(\[[a-z0-9.-]+\.[a-z]{2,}\]\(https?:[^)]+\)\)/i
const TRACKING_RE = /utm_source=(openai|chatgpt\.com)/i
const CUT_OFF_RE = /Answer cut short|Risposta interrotta|couldn't complete that answer|non sono riuscito a completare/i
const LIST_REQUEST_RE = /\b(list|all|every|which|elenca|elencami|tutti|tutte|quali)\b/i
const IT_RE = /(?<![\p{L}])(?:il|lo|la|gli|di|del|della|che|per|non|sono|una|come|cosa|quali|dove|quando|perch[eé]|grazie|ciao|buongiorno|con|vorrei|posso|anche)(?![\p{L}])/giu
const EN_RE = /(?<![\p{L}])(?:the|is|are|what|which|how|where|when|who|do|does|can|could|you|my|for|with|and|of|to|please|thanks|hi|hello|any|about)(?![\p{L}])/giu

export const LIMITS = { totalMs: 30000, firstTokenMs: 8000, longReplyChars: 1800, suggestionChars: 90 }

const looksItalian = (t) => (t.match(IT_RE)?.length ?? 0) > (t.match(EN_RE)?.length ?? 0)
const wordCount = (t) => (t.match(/[\p{L}\p{N}]+/gu) || []).length

/** Read turns from .jsonl files / directories, grouped by session in file order. */
export function loadSessions(paths) {
  const files = []
  for (const p of paths) {
    const st = fs.statSync(p)
    if (st.isDirectory()) for (const f of fs.readdirSync(p).sort()) { if (f.endsWith('.jsonl')) files.push(path.join(p, f)) }
    else files.push(p)
  }
  const sessions = new Map()
  for (const f of files) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue
      let turn
      try { turn = JSON.parse(line) } catch { continue }
      const id = turn.sessionId || path.basename(f, '.jsonl')
      if (!sessions.has(id)) sessions.set(id, [])
      sessions.get(id).push(turn)
    }
  }
  return sessions
}

/** Checks that need nothing but the transcript. Returns [{level, code, detail}]. */
export function checkTurn(turn, index, { expectSuggestions = false } = {}) {
  const issues = []
  const add = (level, code, detail) => issues.push({ level, code, detail })
  const answer = turn.assistant || ''
  const user = turn.user || ''
  if (!answer.trim()) add('FAIL', 'empty-answer', 'the bot sent no text')
  if (turn.done === false) add('FAIL', 'no-done', 'stream ended without [DONE]')
  if (!turn.messageId) add('WARN', 'no-message-id', 'answer not confirmed as saved (no messageId)')
  if (TRACKING_RE.test(answer)) add('FAIL', 'tracking-param', 'a link still carries utm_source=openai')
  if (CUT_OFF_RE.test(answer)) add('WARN', 'cut-off', 'answer was cut short or failed')
  // A silent cut-off (no notice) usually leaves a markdown link open: "… e [Ermen"
  if ((answer.match(/\[/g) || []).length > (answer.match(/\]/g) || []).length) add('FAIL', 'ends-abruptly', `…${answer.slice(-40)}`)
  for (const m of answer.matchAll(MEMBER_LINK_RE)) {
    if (!CANONICAL_MEMBER_RE.test(m[1])) add('WARN', 'member-link-format', m[1])
  }
  if (index > 0 && GREETING_RE.test(answer)) add('WARN', 'regreeting', answer.slice(0, 40))
  if (JARGON_RE.test(answer)) add('WARN', 'jargon', (answer.match(JARGON_RE) || [''])[0])
  if (BARE_CITATION_RE.test(answer)) add('WARN', 'bare-citation', (answer.match(BARE_CITATION_RE) || [''])[0].slice(0, 80))
  if (typeof turn.totalMs === 'number' && turn.totalMs > LIMITS.totalMs) add('WARN', 'slow', `${turn.totalMs} ms total`)
  if (typeof turn.firstTokenMs === 'number' && turn.firstTokenMs > LIMITS.firstTokenMs) add('WARN', 'slow-first-token', `${turn.firstTokenMs} ms to first token`)
  if (answer.length > LIMITS.longReplyChars && !LIST_REQUEST_RE.test(user)) add('INFO', 'long-reply', `${answer.length} chars for a non-list question`)
  if (wordCount(user) >= 4 && wordCount(answer) >= 8 && looksItalian(user) !== looksItalian(answer)) {
    add('WARN', 'language-mismatch', `visitor ${looksItalian(user) ? 'IT' : 'EN'}, answer ${looksItalian(answer) ? 'IT' : 'EN'}`)
  }
  const suggestions = Array.isArray(turn.suggestions) ? turn.suggestions : []
  if (expectSuggestions && answer.trim() && suggestions.length === 0) add('WARN', 'no-suggestions', 'no follow-up questions offered')
  for (const s of suggestions) {
    if (typeof s !== 'string' || s.length > LIMITS.suggestionChars) add('WARN', 'suggestion-length', String(s).slice(0, 60))
  }
  return issues
}

export const htmlToText = (html) =>
  html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Page text with the profile id (as a whole number only) replaced by a placeholder. */
export function profileTemplate(text, id) {
  return text.replace(new RegExp(`(?<![0-9])${id}(?![0-9])`, 'g'), '{id}')
}

/**
 * A member page that shows no member is the empty template apart from the id in
 * the URL, so compare against a profile id that cannot exist. Any other
 * difference counts as a real page: this check can miss a dead link, but never
 * reports a working one as dead.
 */
export function isEmptyMemberPage(text, id, emptyTemplate) {
  return profileTemplate(text, id) === emptyTemplate
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': SITE_UA, Accept: 'text/html' } })
  return { status: res.status, text: htmlToText(await res.text()) }
}
const challenged = (text) => /One moment, please|being verified/i.test(text)

// A profile id no member can have, long enough not to occur anywhere else in the page.
export const EMPTY_PROFILE_ID = '987654321'

async function checkMemberLinks(urls) {
  const results = new Map()
  if (!urls.length) return results
  const EMPTY_ID = EMPTY_PROFILE_ID
  const empty = await fetchText(`https://italchamber.org.sg/membership-directory/corporate/${EMPTY_ID}`)
  const template = challenged(empty.text) ? null : profileTemplate(empty.text, EMPTY_ID)
  for (const url of urls) {
    const id = url.match(/corporate\/(\d+)/)[1]
    try {
      await new Promise((r) => setTimeout(r, 1200)) // be polite to the Chamber's site
      const page = await fetchText(url.replace(/#.*$/, ''))
      if (page.status >= 400) results.set(url, 'dead')
      else if (!template || challenged(page.text)) results.set(url, 'unverified')
      else results.set(url, isEmptyMemberPage(page.text, id, template) ? 'dead' : 'ok')
    } catch {
      results.set(url, 'unverified')
    }
  }
  return results
}

function parseArgs(argv) {
  const a = { paths: [], checkLinks: false, expectSuggestions: false, json: false }
  for (const x of argv) {
    if (x === '--check-links') a.checkLinks = true
    else if (x === '--expect-suggestions') a.expectSuggestions = true
    else if (x === '--json') a.json = true
    else a.paths.push(x)
  }
  return a
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.paths.length) {
    console.error('Usage: node scripts/iccs-sim-report.mjs <file.jsonl | dir> [...] [--check-links] [--expect-suggestions] [--json]')
    process.exit(2)
  }
  const sessions = loadSessions(args.paths)
  const report = []
  const memberUrls = new Set()
  for (const [sessionId, turns] of sessions) {
    report.push({
      sessionId,
      turns: turns.map((t, i) => {
        const memberLinks = [...new Set([...(t.assistant || '').matchAll(MEMBER_LINK_RE)].map((m) => m[1]))]
        for (const u of memberLinks) memberUrls.add(u)
        return { user: t.user, answerChars: (t.assistant || '').length, totalMs: t.totalMs, suggestions: t.suggestions || [], memberLinks, issues: checkTurn(t, i, args) }
      }),
    })
  }
  let linkResults = new Map()
  if (args.checkLinks) linkResults = await checkMemberLinks([...memberUrls])
  for (const s of report) for (const t of s.turns) {
    for (const url of t.memberLinks) {
      if (linkResults.get(url) === 'dead') t.issues.push({ level: 'FAIL', code: 'member-link-dead', detail: url })
    }
  }
  const all = report.flatMap((s) => s.turns.flatMap((t) => t.issues))
  const count = (lvl) => all.filter((i) => i.level === lvl).length
  const summary = {
    sessions: report.length,
    turns: report.reduce((n, s) => n + s.turns.length, 0),
    fails: count('FAIL'),
    warns: count('WARN'),
    memberLinks: { checked: linkResults.size, dead: [...linkResults.values()].filter((v) => v === 'dead').length, unverified: [...linkResults.values()].filter((v) => v === 'unverified').length },
  }
  if (args.json) {
    console.log(JSON.stringify({ summary, report }, null, 2))
  } else {
    console.log(`# Simulated visitor check — ${summary.sessions} conversations, ${summary.turns} turns`)
    console.log(`FAIL ${summary.fails} · WARN ${summary.warns}` + (args.checkLinks ? ` · member links: ${summary.memberLinks.checked} checked, ${summary.memberLinks.dead} dead, ${summary.memberLinks.unverified} unverified` : ''))
    for (const s of report) {
      console.log(`\n## ${s.sessionId}`)
      s.turns.forEach((t, i) => {
        const time = typeof t.totalMs === 'number' ? `${(t.totalMs / 1000).toFixed(1)}s` : '-'
        console.log(`${i + 1}. "${(t.user || '').slice(0, 90)}" → ${t.answerChars} chars, ${time}, ${t.suggestions.length} follow-ups`)
        for (const issue of t.issues) console.log(`   ${issue.level} ${issue.code}: ${issue.detail}`)
      })
    }
  }
  process.exit(summary.fails > 0 ? 1 : 0)
}

if (isEntryPoint(import.meta.url)) {
  main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
