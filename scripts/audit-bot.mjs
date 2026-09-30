// Live audit of the ICCS bot — fires real queries at the production /api/chat
// endpoint and checks the answers against every issue Silvia reported.
// Run: node scripts/audit-bot.mjs
const BASE = process.env.BOT_BASE || 'https://chatniuexa.onrender.com'
const CHATBOT_ID = process.env.BOT_ID || 'cmn93l00d00d713vkdcnkymzn'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ask(message, attempt = 1) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ chatbotId: CHATBOT_ID, sessionId: `audit-${Date.now()}-${Math.round(Math.random() * 1e6)}`, message }),
  })
  if (res.status === 429 && attempt <= 3) { await sleep(6000); return ask(message, attempt + 1) }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  return j?.message?.content || ''
}

// Phrases that show the bot declined or said the knowledge base lacks the answer (matched after
// curly apostrophes are normalized, since newer models write "don’t" / "isn’t").
const DECLINES = ['knowledge base', 'non ho', 'non dispongo', "don't have", 'do not have', "isn't", 'not stated', 'not included',
  'only have information', 'information available to me', 'cannot', 'unable', 'can only', 'non posso', 'posso aiutarti solo', 'materiale']

// inc: all must appear | inc1: at least one must appear | exc: none may appear
// excRe: must not match | decline: any one must appear
// Membership changes over time: Pagani and BNP left the directory (checked 2026-09-29).
const CASES = [
  { t: 'Cross-sector recall — accounting', q: 'accounting firms', inc: ['Hawksford', 'Crowe', 'Dezan Shira', 'Diacron', 'Fidinam', 'Belluzzo'] },
  { t: 'Cross-sector recall — service phrasing', q: 'which members handle tax and corporate compliance?', inc: ['Hawksford', 'Diacron', 'Dezan Shira'] },
  { t: 'Sector listing — consulting', q: 'consulting companies', inc: ['Accenture', 'Bios', 'Business Engineers', 'Consea'] },
  { t: 'Within-sector completeness — automotive', q: 'list all automotive members', inc: ['Ferrari', 'Fiamma', 'Piaggio', 'Pirelli'] },
  { t: 'Sector listing — luxury', q: 'luxury fashion brands', inc: ['Armani', 'Zegna', 'Ferragamo', 'Bottega'] },
  { t: 'Sector listing — finance', q: 'banks and finance partners', inc: ['Julius Baer', 'Intesa'] },
  { t: 'Sector listing — shipping', q: 'shipping and logistics companies', inc: ["D'Amico", 'Cosulich'] },
  { t: 'PrimaPower duplicate removed', q: 'tell me about Prima Power', inc: ['Suzhou'], exc: ['Prima Industrie'] },
  { t: 'Partial-name lookup — Belluzzo', q: 'Belluzzo', inc: ['Belluzzo & Partners'] },
  { t: 'Partial-name lookup — Ferrari', q: 'Ferrari', inc: ['Ferrari Far East'] },
  { t: 'Member links canonical (ICCS, not external)', q: 'Pirelli', inc: ['italchamber.org.sg'], exc: ['pirelli.com'] },
  // The Embassy guide (Italian, added June 2026) states "86 Camere di Commercio Italiane all'Estero".
  { t: 'Grounded figure — from the Italian Embassy guide', q: 'How many Italian Chambers of Commerce abroad are there in the world? Give the number.', inc: ['86'] },
  { t: 'No fabricated figure — not in the knowledge base', q: 'How many members does the Italian Chamber of Commerce in Hong Kong have?', excRe: /\b\d{2,4}\s*(?:members|soci|companies|aziende|imprese)\b/i, decline: DECLINES },
  // Event names change every month; a current answer must list at least one event dated today or later.
  { t: 'Events are current', q: 'what are the upcoming events?', future: true },
  { t: 'Out-of-scope declined', q: "What's the weather in Singapore today?", decline: ['knowledge base', 'ICCS', 'can only', 'cannot', 'non posso', 'unable'] },
]

const norm = (s) => s.replace(/[‘’]/g, "'").toLowerCase()
const has = (text, s) => norm(text).includes(norm(s))

// "8 October 2026", "October 8, 2026", "Oct. 26–30" … dated today or later (UTC; no year = this year; a range
// counts until its last day). Only whole month names or abbreviations match, so "30 decision-makers" is not a date.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MON = String.raw`(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b\.?`
const DATE_RE = new RegExp(String.raw`\b(\d{1,2})\s+${MON}(?:,?\s+(20\d\d))?\b|\b${MON}\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?(?:,?\s+(20\d\d))?\b`, 'gi')
function hasFutureDate(text, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (const m of text.matchAll(DATE_RE)) {
    const [day, mon, year] = m[1] ? [m[1], m[2], m[3]] : [m[6] || m[5], m[4], m[7]]
    const date = new Date(Date.UTC(+(year || now.getUTCFullYear()), MONTHS.indexOf(mon.slice(0, 3).toLowerCase()), +day))
    if (date.getUTCDate() === +day && date.getTime() >= today) return true // the day check rejects "50 December"
  }
  return false
}

function check(c, text) {
  const fails = []
  if (c.inc) for (const s of c.inc) if (!has(text, s)) fails.push(`missing "${s}"`)
  if (c.inc1 && !c.inc1.some((s) => has(text, s))) fails.push(`none of [${c.inc1.join(', ')}]`)
  if (c.exc) for (const s of c.exc) if (has(text, s)) fails.push(`should NOT contain "${s}"`)
  if (c.excRe && c.excRe.test(text)) fails.push(`should NOT match ${c.excRe}`)
  if (c.future && !hasFutureDate(text)) fails.push('no event dated today or later')
  if (c.decline && !c.decline.some((s) => has(text, s))) fails.push(`expected a decline/grounding phrase`)
  return fails
}

async function main() {
  console.log(`\nICCS BOT LIVE AUDIT  —  ${BASE}  (bot ${CHATBOT_ID})`)
  console.log('='.repeat(78))
  let pass = 0
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i]
    let text = '', err = null
    try { text = await ask(c.q) } catch (e) { err = e.message }
    const fails = err ? [`request error: ${err}`] : check(c, text)
    const ok = fails.length === 0
    if (ok) pass++
    const tag = ok ? 'PASS' : 'FAIL'
    console.log(`\n[${String(i + 1).padStart(2)}] ${tag}  ${c.t}`)
    console.log(`      Q: "${c.q}"`)
    if (ok) {
      const proof = c.inc ? `present: ${c.inc.join(', ')}` : c.inc1 ? `found one of ${c.inc1.join('/')}` : c.future ? 'lists an event dated today or later' : c.exc ? `excludes ${c.exc.join('/')}` : c.decline ? `declined/grounded correctly` : 'ok'
      console.log(`      ✓ ${proof}${c.exc && c.inc ? `  |  excludes ${c.exc.join('/')}` : ''}`)
    } else {
      console.log(`      ✗ ${fails.join(' ; ')}`)
      console.log(`      … "${(text || '').replace(/\s+/g, ' ').slice(0, 160)}"`)
    }
    await sleep(1200)
  }
  console.log('\n' + '='.repeat(78))
  console.log(`SUMMARY: ${pass}/${CASES.length} passed`)
  process.exit(pass === CASES.length ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
