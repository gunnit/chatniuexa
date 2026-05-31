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

// inc: all must appear | exc: none may appear | decline: any one must appear
const CASES = [
  { t: 'Cross-sector recall — accounting', q: 'accounting firms', inc: ['Hawksford', 'Crowe', 'Dezan Shira', 'Diacron', 'Fidinam', 'Belluzzo'] },
  { t: 'Cross-sector recall — service phrasing', q: 'which members handle tax and corporate compliance?', inc: ['Hawksford', 'Diacron', 'Dezan Shira'] },
  { t: 'Sector listing — consulting', q: 'consulting companies', inc: ['Accenture', 'Bios', 'Business Engineers', 'Consea'] },
  { t: 'Within-sector completeness — automotive', q: 'list all automotive members', inc: ['Ferrari', 'Fiamma', 'Pagani', 'Piaggio', 'Pirelli'] },
  { t: 'Sector listing — luxury', q: 'luxury fashion brands', inc: ['Armani', 'Zegna', 'Ferragamo', 'Bottega'] },
  { t: 'Sector listing — finance', q: 'banks and finance partners', inc: ['Julius Baer', 'BNP', 'Intesa'] },
  { t: 'Sector listing — shipping', q: 'shipping and logistics companies', inc: ["D'Amico", 'Cosulich'] },
  { t: 'PrimaPower duplicate removed', q: 'tell me about Prima Power', inc: ['Suzhou'], exc: ['Prima Industrie'] },
  { t: 'Partial-name lookup — Belluzzo', q: 'Belluzzo', inc: ['Belluzzo & Partners'] },
  { t: 'Partial-name lookup — Ferrari', q: 'Ferrari', inc: ['Ferrari Far East'] },
  { t: 'Member links canonical (ICCS, not external)', q: 'Pirelli', inc: ['italchamber.org.sg'], exc: ['pirelli.com'] },
  { t: 'No fabricated figure — chambers abroad', q: 'How many Italian Chambers of Commerce abroad are there in the world? Give the number.', exc: ['81', '86'], decline: ['knowledge base', 'non ho', "don't have", 'do not have', 'cannot', 'materiale'] },
  { t: 'Events present', q: 'what are the upcoming events?', inc1: ['Gala', 'Cross-Chamber', 'Summer Social', 'Business Awards', 'Ministerial'] },
  { t: 'Out-of-scope declined', q: "What's the weather in Singapore today?", decline: ['knowledge base', 'ICCS', 'can only', 'cannot', 'non posso', 'unable'] },
]

const has = (text, s) => text.toLowerCase().includes(s.toLowerCase())

function check(c, text) {
  const fails = []
  if (c.inc) for (const s of c.inc) if (!has(text, s)) fails.push(`missing "${s}"`)
  if (c.inc1 && !c.inc1.some((s) => has(text, s))) fails.push(`none of [${c.inc1.join(', ')}]`)
  if (c.exc) for (const s of c.exc) if (has(text, s)) fails.push(`should NOT contain "${s}"`)
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
      const proof = c.inc ? `present: ${c.inc.join(', ')}` : c.inc1 ? `found an event` : c.exc ? `excludes ${c.exc.join('/')}` : c.decline ? `declined/grounded correctly` : 'ok'
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
