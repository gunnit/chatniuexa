/**
 * ICCS chatbot — read-only usage & answer-quality stats for client reporting.
 *
 * Safety: every query runs inside a READ ONLY transaction (it cannot modify data)
 * with a 60s statement timeout. Output is aggregate numbers; question text is only
 * shown when it was asked 2+ times (or with --samples), always with emails and
 * phone numbers redacted.
 *
 * Internal traffic never inflates the numbers — conversations are split by the
 * sessionId prefix each client generates:
 *   widget-*          chat widget embedded on the Chamber's website   → visitor
 *   pub-*             public share link /c/<token>                    → visitor (may include staff demos)
 *   channel=whatsapp  WhatsApp Cloud API                              → visitor
 *   test-*            dashboard "test chat" page                      → internal, excluded
 *   audit-*           scripts/audit-bot.mjs QA runs                   → internal, excluded
 *   anything else     reported separately as "other", not in the headline numbers
 *
 * Usage (local, same .env as the other ICCS scripts):
 *   node --env-file=.env scripts/iccs-stats.mjs [--share=lOLj8UA] [--bot=<chatbotId>]
 *        [--since=YYYY-MM-DD] [--samples] [--json]
 * On Render (Shell tab of the web service, once this file is deployed) DATABASE_URL is already set:
 *   node scripts/iccs-stats.mjs
 *
 *   --since    only count conversations started on/after this date (Singapore time)
 *   --samples  also list up to 25 redacted questions the bot could not answer (for internal prep)
 *   --json     machine-readable output
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SHARE_TOKEN = 'lOLj8UA'
const KNOWN_ICCS_BOT_ID = 'cmn93l00d00d713vkdcnkymzn' // scripts/audit-bot.mjs
const TZ = 'Asia/Singapore' // UTC+8 all year, no DST
const TZ_OFFSET_MS = 8 * 3600 * 1000

export const VISITOR_SEGMENTS = ['widget', 'public_link', 'whatsapp']
const INTERNAL_SEGMENTS = ['internal_test', 'internal_audit']

// ---------------------------------------------------------------------------
// SQL — timestamps are TIMESTAMP(3) holding UTC; convert to Singapore wall-clock
// text so the Prisma and psql paths return identical strings.
// ---------------------------------------------------------------------------
const SEG = `CASE
    WHEN c.channel = 'whatsapp' THEN 'whatsapp'
    WHEN c."sessionId" LIKE 'widget-%' THEN 'widget'
    WHEN c."sessionId" LIKE 'pub-%' THEN 'public_link'
    WHEN c."sessionId" LIKE 'test-%' THEN 'internal_test'
    WHEN c."sessionId" LIKE 'audit-%' THEN 'internal_audit'
    ELSE 'other'
  END`
const sgt = (col) => `to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI:SS')`
const SINCE = `($2::timestamptz AT TIME ZONE 'UTC')`

// Each query lists the params it binds, in order — Postgres rejects a bind with
// more params than the statement uses.
export const QUERIES = {
  findBot: {
    params: ['botRef'],
    sql: `
SELECT b.id, b.name, b."shareToken", b.model, ${sgt('b."createdAt"')} AS "createdAt",
       b."voiceEnabled", b."webSearchEnabled", b."showSources",
       b."allowedDomains", b."suggestedPrompts",
       t.id AS "tenantId", t.name AS "tenantName", t.plan,
       EXISTS (SELECT 1 FROM whatsapp_configs w WHERE w."chatbotId" = b.id AND w."isActive") AS "whatsappActive"
FROM chatbots b
JOIN tenants t ON t.id = b."tenantId"
WHERE b.id = $1 OR b."shareToken" = $1`,
  },
  tenantBots: {
    params: ['tenantId'],
    sql: `
SELECT b.id, b.name, b."shareToken", COUNT(c.id)::int AS conversations,
       ${sgt('MAX(c."createdAt")')} AS "lastConversationAt"
FROM chatbots b
LEFT JOIN conversations c ON c."chatbotId" = b.id
WHERE b."tenantId" = $1
GROUP BY b.id, b.name, b."shareToken"
ORDER BY conversations DESC, b.name`,
  },
  conversations: {
    params: ['botId', 'since'],
    sql: `
SELECT c.id, ${SEG} AS seg, ${sgt('c."createdAt"')} AS "createdAt",
       COUNT(m.id) FILTER (WHERE m.role = 'USER')::int AS "userMsgs",
       COUNT(m.id) FILTER (WHERE m.role = 'ASSISTANT')::int AS "assistantMsgs"
FROM conversations c
LEFT JOIN messages m ON m."conversationId" = c.id
WHERE c."chatbotId" = $1 AND c."createdAt" >= ${SINCE}
GROUP BY c.id`,
  },
  otherPrefixes: {
    params: ['botId', 'since'],
    sql: `
SELECT COALESCE(substring(c."sessionId" from '^[A-Za-z_]+'), '(no letter prefix)') AS prefix, COUNT(*)::int AS n
FROM conversations c
WHERE c."chatbotId" = $1 AND c."createdAt" >= ${SINCE} AND (${SEG}) = 'other'
GROUP BY 1
ORDER BY n DESC
LIMIT 10`,
  },
  messages: {
    params: ['botId', 'since'],
    sql: `
SELECT m."conversationId" AS "conversationId", ${SEG} AS seg, m.role::text AS role,
       ${sgt('m."createdAt"')} AS "createdAt", m.content, m.reaction,
       CASE WHEN jsonb_typeof(m.sources) = 'array' THEN jsonb_array_length(m.sources) ELSE 0 END AS "sourceCount"
FROM messages m
JOIN conversations c ON c.id = m."conversationId"
WHERE c."chatbotId" = $1 AND c."createdAt" >= ${SINCE}
  AND (${SEG}) NOT IN ('internal_test', 'internal_audit')
ORDER BY m."conversationId", m."createdAt", (m.role = 'ASSISTANT'), m.id`,
  },
  voice: {
    params: ['botId', 'since'],
    sql: `
SELECT COUNT(*)::int AS sessions, COALESCE(SUM("secondsUsed"), 0)::int AS seconds,
       COUNT(*) FILTER (WHERE "secondsUsed" >= 15)::int AS "sessionsOver15s"
FROM voice_sessions
WHERE "chatbotId" = $1 AND "createdAt" >= ${SINCE}`,
  },
  leads: {
    params: ['botId', 'since'],
    sql: `
SELECT source, COUNT(*)::int AS leads
FROM leads
WHERE "chatbotId" = $1 AND "createdAt" >= ${SINCE}
GROUP BY source
ORDER BY leads DESC`,
  },
  usageLimits: {
    params: ['tenantId'],
    sql: `
SELECT "monthlyTokenLimit", "dailyMessageLimit", "monthlyCostLimit"::float8 AS "monthlyCostLimit",
       "currentMonthTokens", "currentMonthCost"::float8 AS "currentMonthCost", "currentDayMessages",
       to_char("lastDayReset", 'YYYY-MM-DD') AS "lastDayReset"
FROM usage_limits
WHERE "tenantId" = $1`,
  },
  // Limits reset on the server's calendar day/month (UTC on Render), so bucket in UTC.
  usagePeakDays: {
    params: ['tenantId', 'since'],
    sql: `
SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS requests
FROM usage_logs
WHERE "tenantId" = $1 AND type = 'chat' AND "createdAt" >= ${SINCE}
GROUP BY 1
ORDER BY requests DESC, day DESC
LIMIT 5`,
  },
  usageMonthly: {
    params: ['tenantId', 'since', 'botId'],
    sql: `
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
       COUNT(*) FILTER (WHERE type = 'chat')::int AS "tenantChatRequests",
       COUNT(*) FILTER (WHERE type = 'chat' AND "chatbotId" = $3)::int AS "botChatRequests",
       COALESCE(SUM(tokens), 0)::float8 AS "tenantTokens"
FROM usage_logs
WHERE "tenantId" = $1 AND "createdAt" >= ${SINCE}
GROUP BY 1
ORDER BY 1`,
  },
  kbSummary: {
    params: ['tenantId'],
    sql: `
SELECT ds.type::text AS type, ds.status::text AS status, COUNT(*)::int AS n
FROM data_sources ds
WHERE ds."tenantId" = $1
GROUP BY 1, 2
ORDER BY 1, 2`,
  },
  kbCounts: {
    params: ['tenantId'],
    sql: `
SELECT
  (SELECT COUNT(*)::int FROM documents d JOIN data_sources ds ON ds.id = d."dataSourceId"
    WHERE ds."tenantId" = $1) AS documents,
  (SELECT COUNT(*)::int FROM chunks ch JOIN documents d ON d.id = ch."documentId"
    JOIN data_sources ds ON ds.id = d."dataSourceId" WHERE ds."tenantId" = $1) AS chunks,
  (SELECT to_char(MAX(COALESCE(ds."lastSyncAt", ds."updatedAt")), 'YYYY-MM-DD') FROM data_sources ds
    WHERE ds."tenantId" = $1) AS "lastUpdated"`,
  },
  kbSources: {
    params: ['tenantId'],
    sql: `
SELECT ds.name, ds.type::text AS type, ds.status::text AS status, ds."sourceUrl",
       to_char(COALESCE(ds."lastSyncAt", ds."updatedAt"), 'YYYY-MM-DD') AS updated,
       (SELECT COUNT(*)::int FROM documents d WHERE d."dataSourceId" = ds.id) AS documents
FROM data_sources ds
WHERE ds."tenantId" = $1
ORDER BY COALESCE(ds."lastSyncAt", ds."updatedAt") DESC
LIMIT 40`,
  },
  // Member-profile IDs currently in the knowledge base = the denominator for
  // "N of M member companies were recommended at least once".
  kbMemberIds: {
    params: ['tenantId'],
    sql: `
SELECT DISTINCT m[1] AS id
FROM documents d
JOIN data_sources ds ON ds.id = d."dataSourceId"
CROSS JOIN LATERAL regexp_matches(d.content, 'membership-directory/corporate/([0-9]+)', 'g') AS m
WHERE ds."tenantId" = $1`,
  },
}

// ---------------------------------------------------------------------------
// Text heuristics (approximate by design — reported as such)
// ---------------------------------------------------------------------------
const DECLINE_RE = new RegExp(
  [
    // English
    "\\b(?:don't|do not|doesn't|does not) (?:have|contain|include|mention)\\b",
    '\\bno (?:specific |detailed |further )?information\\b',
    "\\b(?:unable|not able) to (?:find|provide|answer|help)\\b",
    "\\b(?:can't|cannot|can not|couldn't|could not) (?:find|provide|answer|help)\\b",
    '\\bnot (?:available|included|present|covered) in (?:my|the)\\b',
    '\\boutside (?:of )?(?:my|the) (?:scope|knowledge)\\b',
    '\\bi can only (?:help|answer|assist)\\b',
    // Italian
    '\\bnon (?:ho|dispongo|trovo|sono in grado|posso (?:rispondere|aiutarti|fornire))\\b',
    "\\bnon (?:è|e') (?:presente|disponibile|indicat[oa]|riportat[oa])\\b",
    '\\bnessuna informazione\\b',
    '\\binformazioni non (?:disponibili|presenti)\\b',
    "\\bal di fuori (?:del(?:l'| )?|dei )",
  ].join('|'),
  'i',
)

const IT_WORDS = new Set(('il lo la gli le di del della dei delle degli che per con sono come cosa quali quale quando dove chi ' +
  'perché perche vorrei posso puoi ci una uno ciao buongiorno buonasera grazie italiana italiano italiane italiani camera ' +
  'commercio soci socio aziende azienda eventi evento elenco settore settori informazioni contatti iscrizione iscriversi ' +
  'aprire società societa fare affari avvocati commercialisti ristoranti spedizioni lusso moda cibo prossimi quota ufficio ' +
  'sede mi mio mia nel nella sul sulla anche essere hanno ho').split(' '))
const EN_WORDS = new Set(('the an of and to is are what which who how when where can could do does you your my me please ' +
  'list companies company members member events event about with for any there hi hello thanks thank firms show tell ' +
  'find looking need want doing business setup join membership fee fees contact office upcoming next all sector sectors ' +
  'partners law lawyers accounting restaurants food shipping luxury fashion from have has this that our we give').split(' '))

export function detectLanguage(text) {
  const words = text.toLowerCase().match(/[a-zàèéìòù']+/g) || []
  let it = 0
  let en = 0
  for (const w of words) {
    if (IT_WORDS.has(w)) it++
    if (EN_WORDS.has(w)) en++
  }
  if (it === en) return 'unclear'
  return it > en ? 'it' : 'en'
}

const MEMBER_ID_RE = /italchamber\.org\.sg\/membership-directory\/corporate\/(\d+)/gi
const MEMBER_ID_RE_SINGLE = /italchamber\.org\.sg\/membership-directory\/corporate\/\d+/i
const MEMBER_LINK_RE = /\[([^\]\n]{2,120})\]\((?:https?:\/\/)?(?:www\.)?italchamber\.org\.sg\/membership-directory\/corporate\/(\d+)[^)]*\)/gi

// Single label per question, first match wins.
export const TOPICS = [
  { key: 'greeting', label: 'Greetings / small talk', re: /^(?:hi|hello|hey|ciao|salve|buongiorno|buonasera|good (?:morning|afternoon|evening)|thanks|thank you|grazie|ok|okay|test|prova)\b/ },
  { key: 'events', label: 'Events & initiatives', re: /\b(?:events?|eventi|evento|gala|go ?asia|webinars?|seminars?|seminari\w*|conferences?|conferenz\w*|networking|awards?|summer social|cross[- ]chamber|workshops?|forum|missions?|mission[ei]|fiera|fairs?|aperitiv\w*|dinner|cena|tickets?|bigliett\w*)\b/ },
  { key: 'membership', label: 'Membership (joining, benefits, fees)', re: /\b(?:membership|become a member|join|joining|member benefits|vantaggi per i soci|iscri\w*|associar\w*|diventare soci\w*|quota associativa|renew\w*|rinnov\w*|tessera)\b/ },
  { key: 'governance', label: 'Committees, board & Chamber team', re: /\b(?:committees?|comitat\w*|board|council|consiglio|president\w*|directors?|direttor\w*|chair\w*|isbc|ifbs|secretary|segretari\w*|staff|lansset|fmcg)\b/ },
  { key: 'business', label: 'Doing business in Singapore', re: /\b(?:business in singapore|doing business|fare affari|set ?up|incorporat\w*|open(?:ing)? a (?:company|business|branch|office)|register(?:ing)? a (?:company|business)|aprire|costituire|visas?|visto|work pass|employment pass|permess\w*|gst|export\w*|esport\w*|import\w*|market entry|invest\w*|embassy|ambasciata|sistema italia|regulations?|normativ\w*)\b/ },
  { key: 'directory', label: 'Member directory & sector searches', re: /\b(?:members?|membri|soci|socio|partners?|compan(?:y|ies)|aziend\w*|imprese|firms?|studi[oi]?|sectors?|settor\w*|categor\w*|directory|elenco|list|lista|accounting|accountants?|commercialist\w*|lawyers?|avvocat\w*|legal[ei]?|automotive|luxury|lusso|fashion|moda|food|f&b|beverages?|ristorant\w*|restaurants?|shipping|logistic\w*|spedizion\w*|freight|banks?|banc[ah]e?|banking|consult\w*|consulenz\w*|software|informatic\w*|engineering|ingegneria|construction|costruzion\w*|energy|energia|healthcare|pharma\w*|farmac\w*|hospitality|hotels?|turismo|tourism|education|formazione|istruzione|trading|furniture|arredamento|mobili|design|security|sicurezza|translation|traduzion\w*|chemicals?|chimic\w*|defen[cs]e|difesa|aerospace|aerospazi\w*|manufactur\w*)\b/ },
  { key: 'contacts', label: 'Contacts & office info', re: /\b(?:contacts?|contatt\w*|e-?mail|phone|telefono|address|indirizzo|office|ufficio|opening hours|orari\w*|location|sede|where (?:is|are) (?:you|the chamber|your office))\b/ },
]
export const OTHER_TOPIC = { key: 'other', label: 'Other / company-name lookups' }

export function classifyTopic(question, answer) {
  const q = question.toLowerCase().trim()
  const words = q.split(/\s+/).filter(Boolean)
  for (const t of TOPICS) {
    if (t.key === 'greeting' && words.length > 4) continue
    if (t.re.test(q)) return t.key
  }
  // Short query answered with member profiles = a company-name lookup ("Pirelli", "Belluzzo").
  if (answer && words.length <= 4 && MEMBER_ID_RE_SINGLE.test(answer)) return 'directory'
  return OTHER_TOPIC.key
}

export function redact(text) {
  const flat = text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > 140 ? `${flat.slice(0, 137)}…` : flat
}

const normalize = (text) => text.toLowerCase().replace(/[?!.,;:"“”'’()]/g, ' ').replace(/\s+/g, ' ').trim()

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const wallMs = (sgtText) => Date.parse(`${sgtText}Z`) // SGT wall-clock as a comparable number
const weekday = (sgtText) => new Date(`${sgtText.slice(0, 10)}T00:00:00Z`).getUTCDay()
const median = (xs) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const share = (n, d) => (d ? n / d : null)

export function buildReport(raw, { now = new Date(), since = null, withSamples = false } = {}) {
  const nowWall = now.getTime() + TZ_OFFSET_MS
  const day = 24 * 3600 * 1000
  const { bot } = raw

  // Traffic by source
  const bySegment = {}
  for (const c of raw.conversations) {
    const s = (bySegment[c.seg] ||= { conversations: 0, engaged: 0, empty: 0, questions: 0, answers: 0 })
    s.conversations++
    if (c.userMsgs > 0) s.engaged++
    else s.empty++
    s.questions += c.userMsgs
    s.answers += c.assistantMsgs
  }

  const visitorConvs = raw.conversations.filter((c) => VISITOR_SEGMENTS.includes(c.seg))
  const visitorMsgs = raw.messages.filter((m) => VISITOR_SEGMENTS.includes(m.seg))

  // Pair each question with the answer that followed it (rows are ordered per conversation).
  const pairs = []
  for (let i = 0; i < visitorMsgs.length; i++) {
    const m = visitorMsgs[i]
    if (m.role !== 'USER') continue
    const next = visitorMsgs[i + 1]
    const answer = next && next.role === 'ASSISTANT' && next.conversationId === m.conversationId ? next : null
    pairs.push({ q: m, a: answer })
  }
  const questions = pairs.map((p) => p.q)
  const answers = visitorMsgs.filter((m) => m.role === 'ASSISTANT')

  // Monthly trend (SGT)
  const months = {}
  for (const c of visitorConvs) (months[c.createdAt.slice(0, 7)] ||= { conversations: 0, questions: 0 }).conversations++
  for (const q of questions) (months[q.createdAt.slice(0, 7)] ||= { conversations: 0, questions: 0 }).questions++
  const monthly = Object.keys(months).sort().map((month) => ({ month, ...months[month] }))

  const inWindow = (t, fromDaysAgo, toDaysAgo) => {
    const ms = wallMs(t)
    return ms >= nowWall - fromDaysAgo * day && ms < nowWall - toDaysAgo * day
  }
  const countWindow = (from, to) => ({
    conversations: visitorConvs.filter((c) => inWindow(c.createdAt, from, to)).length,
    questions: questions.filter((q) => inWindow(q.createdAt, from, to)).length,
  })

  // Engagement depth
  const engaged = visitorConvs.filter((c) => c.userMsgs > 0)
  const depthCounts = engaged.map((c) => c.userMsgs)

  // Timing (SGT). Office hours = Mon–Fri 09:00–17:59; public holidays not excluded.
  const byHour = Array(24).fill(0)
  const byWeekday = Array(7).fill(0)
  const byDate = {}
  let outsideOffice = 0
  let weekend = 0
  for (const q of questions) {
    const h = Number(q.createdAt.slice(11, 13))
    const wd = weekday(q.createdAt)
    byHour[h]++
    byWeekday[wd]++
    byDate[q.createdAt.slice(0, 10)] = (byDate[q.createdAt.slice(0, 10)] || 0) + 1
    const isWeekend = wd === 0 || wd === 6
    if (isWeekend) weekend++
    if (isWeekend || h < 9 || h >= 18) outsideOffice++
  }
  const busiest = Object.entries(byDate).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]

  // Language & topics
  const languages = { en: 0, it: 0, unclear: 0 }
  const topicCounts = {}
  for (const p of pairs) {
    languages[detectLanguage(p.q.content)]++
    const t = classifyTopic(p.q.content, p.a?.content)
    topicCounts[t] = (topicCounts[t] || 0) + 1
  }
  const topics = [...TOPICS, OTHER_TOPIC]
    .map((t) => ({ key: t.key, label: t.label, count: topicCounts[t.key] || 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((t) => ({ ...t, share: share(t.count, pairs.length) }))

  // Most repeated questions (2+), flagged when they match a suggested-prompt button
  const suggested = new Set((bot.suggestedPrompts || []).map(normalize))
  const groups = new Map()
  for (const q of questions) {
    const key = normalize(q.content)
    if (!key) continue
    const g = groups.get(key) || { count: 0, sample: q.content }
    g.count++
    groups.set(key, g)
  }
  const topQuestions = [...groups.entries()]
    .filter(([, g]) => g.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([key, g]) => ({ text: redact(g.sample), count: g.count, suggestedButton: suggested.has(key) }))

  // Answer quality & member exposure
  let grounded = 0
  let declined = 0
  let chamberLink = 0
  let eventsLink = 0
  let embassyGuide = 0
  let withMembers = 0
  let memberImpressions = 0
  const memberAnswers = new Map() // id -> answers mentioning it
  const memberNames = new Map() // id -> Map(name -> count)
  for (const a of answers) {
    if (a.sourceCount > 0) grounded++
    if (DECLINE_RE.test(a.content)) declined++
    if (/https?:\/\/(?:www\.)?italchamber\.org\.sg/i.test(a.content)) chamberLink++
    if (/italchamber\.org\.sg\/events/i.test(a.content)) eventsLink++
    if (/fare-affari-singapore/i.test(a.content)) embassyGuide++
    const ids = new Set([...a.content.matchAll(MEMBER_ID_RE)].map((m) => m[1]))
    if (ids.size) withMembers++
    memberImpressions += ids.size
    for (const id of ids) memberAnswers.set(id, (memberAnswers.get(id) || 0) + 1)
    for (const m of a.content.matchAll(MEMBER_LINK_RE)) {
      const names = memberNames.get(m[2]) || new Map()
      const name = m[1].replace(/\*/g, '').trim()
      names.set(name, (names.get(name) || 0) + 1)
      memberNames.set(m[2], names)
    }
  }
  const kbMemberIds = new Set(raw.kbMemberIds.map((r) => r.id))
  const surfacedCurrent = [...memberAnswers.keys()].filter((id) => kbMemberIds.has(id)).length
  const nameFor = (id) => {
    const names = memberNames.get(id)
    return names ? [...names.entries()].sort((a, b) => b[1] - a[1])[0][0] : `member #${id}`
  }
  const topMembers = [...memberAnswers.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, n]) => ({ id, name: nameFor(id), answers: n }))

  const up = answers.filter((a) => a.reaction === 'up').length
  const down = answers.filter((a) => a.reaction === 'down').length

  let unansweredSamples
  if (withSamples) {
    const miss = new Map()
    for (const p of pairs) {
      if (!p.a || !(DECLINE_RE.test(p.a.content) || p.a.sourceCount === 0)) continue
      const key = normalize(p.q.content)
      const g = miss.get(key) || { count: 0, text: redact(p.q.content), last: p.q.createdAt }
      g.count++
      if (p.q.createdAt > g.last) g.last = p.q.createdAt
      miss.set(key, g)
    }
    unansweredSamples = [...miss.values()]
      .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
      .slice(0, 25)
  }

  const first = visitorConvs.map((c) => c.createdAt).sort()[0] || null
  const last = questions.map((q) => q.createdAt).sort().at(-1) || null
  const internal = {}
  for (const s of INTERNAL_SEGMENTS) if (bySegment[s]) internal[s] = bySegment[s]

  return {
    generatedAt: new Date(nowWall).toISOString().slice(0, 16).replace('T', ' ') + ' SGT',
    period: since ? `conversations since ${since}` : 'all time',
    bot: {
      id: bot.id,
      name: bot.name,
      shareToken: bot.shareToken,
      model: bot.model,
      createdAt: bot.createdAt,
      voiceEnabled: bot.voiceEnabled,
      webSearchEnabled: bot.webSearchEnabled,
      whatsappActive: bot.whatsappActive,
      allowedDomains: bot.allowedDomains,
      suggestedPrompts: bot.suggestedPrompts,
      idMatchesAuditScript: bot.id === KNOWN_ICCS_BOT_ID,
    },
    tenant: { id: bot.tenantId, name: bot.tenantName, plan: bot.plan, bots: raw.tenantBots },
    traffic: { bySegment, otherPrefixes: raw.otherPrefixes, excludedInternal: internal },
    visitors: {
      conversations: visitorConvs.length,
      engagedConversations: engaged.length,
      emptyConversations: visitorConvs.length - engaged.length,
      questions: questions.length,
      answers: answers.length,
      firstConversation: first,
      lastQuestion: last,
      daysSinceFirst: first ? Math.floor((nowWall - wallMs(first)) / day) + 1 : 0,
      activeDays: Object.keys(byDate).length,
      busiestDay: busiest ? { date: busiest[0], questions: busiest[1] } : null,
      monthly,
      last30Days: countWindow(30, 0),
      previous30Days: countWindow(60, 30),
      depth: {
        avgQuestionsPerConversation: round(share(questions.length, engaged.length) ?? 0),
        medianQuestionsPerConversation: median(depthCounts),
        multiTurnShare: share(depthCounts.filter((n) => n >= 2).length, engaged.length),
        threePlusShare: share(depthCounts.filter((n) => n >= 3).length, engaged.length),
      },
      timing: {
        outsideOfficeHoursShare: share(outsideOffice, questions.length),
        weekendShare: share(weekend, questions.length),
        byHour,
        byWeekday: WEEKDAYS.map((d, i) => ({ day: d, questions: byWeekday[i] })),
      },
      languages,
      topics,
      topQuestions,
      answerQuality: {
        groundedShare: share(grounded, answers.length),
        declinedShare: share(declined, answers.length),
        declined,
        chamberLinkShare: share(chamberLink, answers.length),
        answersWithMemberProfiles: withMembers,
        memberProfileImpressions: memberImpressions,
        distinctMembersSurfaced: memberAnswers.size,
        membersInKnowledgeBase: kbMemberIds.size,
        membersInKnowledgeBaseSurfaced: surfacedCurrent,
        topMembers,
        eventsPageLinks: eventsLink,
        embassyGuideLinks: embassyGuide,
      },
      feedback: { up, down, ratedShare: share(up + down, answers.length), satisfaction: share(up, up + down) },
      ...(withSamples ? { unansweredSamples } : {}),
    },
    voice: raw.voice[0],
    leads: raw.leads,
    usage: { limits: raw.usageLimits[0] || null, peakDays: raw.usagePeakDays, monthly: raw.usageMonthly },
    knowledgeBase: { summary: raw.kbSummary, ...raw.kbCounts[0], sources: raw.kbSources },
  }
}

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------
const fmt = (n) => (n == null ? 'n/a' : Number(n).toLocaleString('en-US'))
const pct = (x) => (x == null ? 'n/a' : `${round(x * 100, x < 0.1 ? 1 : 0)}%`)
const change = (cur, prev) => (prev ? `${cur >= prev ? '+' : ''}${round(((cur - prev) / prev) * 100, 0)}%` : 'n/a')
const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`

export function renderText(r) {
  const v = r.visitors
  const q = v.answerQuality
  const out = []
  const line = (s = '') => out.push(s)
  const section = (title) => { line(); line(title); line('-'.repeat(title.length)) }

  line(`ICCS CHATBOT — USAGE REPORT (read-only)`)
  line(`Generated ${r.generatedAt} · period: ${r.period} · all times Singapore time`)

  section('BOT')
  line(`  ${r.bot.name}  (id ${r.bot.id}, share token ${r.bot.shareToken}, model ${r.bot.model})`)
  if (!r.bot.idMatchesAuditScript) line(`  NOTE: id differs from scripts/audit-bot.mjs (${KNOWN_ICCS_BOT_ID}) — check this is the right bot`)
  line(`  Tenant: ${r.tenant.name} · plan: ${r.tenant.plan} · bot created ${r.bot.createdAt.slice(0, 10)}`)
  line(`  Channels: WhatsApp ${r.bot.whatsappActive ? 'active' : 'not connected'} · voice ${r.bot.voiceEnabled ? 'on' : 'off'} · web search ${r.bot.webSearchEnabled ? 'on' : 'off'}`)
  line(`  Allowed embed domains: ${r.bot.allowedDomains?.length ? r.bot.allowedDomains.join(', ') : '(unrestricted)'}`)
  if (r.bot.suggestedPrompts?.length) line(`  Suggested-prompt buttons: ${r.bot.suggestedPrompts.map((s) => `"${s}"`).join(' · ')}`)
  if (r.tenant.bots.length > 1) {
    line(`  Other bots in this tenant (they share the same knowledge base):`)
    for (const b of r.tenant.bots) if (b.id !== r.bot.id) line(`    - ${b.name} (${b.id}) — ${plural(b.conversations, 'conversation')}, last ${b.lastConversationAt?.slice(0, 10) ?? 'never'}`)
  }

  section('HEADLINES — visitor traffic only (widget + public link + WhatsApp; internal tests excluded)')
  line(`  Conversations ............... ${fmt(v.conversations)}  (${fmt(v.engagedConversations)} with at least one question)`)
  line(`  Questions answered .......... ${fmt(v.questions)}`)
  line(`  First visitor conversation .. ${v.firstConversation?.slice(0, 10) ?? 'n/a'}  (${fmt(v.daysSinceFirst)} days ago · active on ${fmt(v.activeDays)} days)`)
  line(`  Last 30 days ................ ${fmt(v.last30Days.conversations)} conversations / ${fmt(v.last30Days.questions)} questions`)
  line(`  Previous 30 days ............ ${fmt(v.previous30Days.conversations)} conversations / ${fmt(v.previous30Days.questions)} questions  (change: ${change(v.last30Days.conversations, v.previous30Days.conversations)} / ${change(v.last30Days.questions, v.previous30Days.questions)})`)
  line(`  Asked outside office hours .. ${pct(v.timing.outsideOfficeHoursShare)}  (weekends ${pct(v.timing.weekendShare)}; office = Mon–Fri 09:00–18:00 SGT)`)
  line(`  Answers drawn from the Chamber knowledge base ... ${pct(q.groundedShare)}  (retrieved sources; not necessarily shown to visitors)`)
  line(`  Members recommended ......... ${fmt(q.membersInKnowledgeBaseSurfaced)} of ${fmt(q.membersInKnowledgeBase)} member companies in the directory appeared in at least one answer`)
  line(`  Feedback .................... 👍 ${fmt(v.feedback.up)} · 👎 ${fmt(v.feedback.down)}  (${fmt(v.feedback.up + v.feedback.down)} ratings on ${fmt(v.answers)} answers)`)

  section('TRAFFIC BY SOURCE')
  line(`  ${pad('source', 24)}${lpad('conversations', 14)}${lpad('engaged', 9)}${lpad('empty', 7)}${lpad('questions', 11)}${lpad('answers', 9)}`)
  const order = [...VISITOR_SEGMENTS, 'other', ...INTERNAL_SEGMENTS]
  for (const s of order) {
    const t = r.traffic.bySegment[s]
    if (!t) continue
    const label = VISITOR_SEGMENTS.includes(s) ? s : `${s} (excl.)`
    line(`  ${pad(label, 24)}${lpad(fmt(t.conversations), 14)}${lpad(fmt(t.engaged), 9)}${lpad(fmt(t.empty), 7)}${lpad(fmt(t.questions), 11)}${lpad(fmt(t.answers), 9)}`)
  }
  if (r.traffic.otherPrefixes.length) line(`  "other" session prefixes: ${r.traffic.otherPrefixes.map((p) => `${p.prefix} ×${p.n}`).join(', ')}`)
  line(`  "empty" = conversation created but no message saved (e.g. request rejected by a usage limit or an error).`)

  section('MONTHLY TREND (visitor)')
  line(`  ${pad('month', 10)}${lpad('conversations', 14)}${lpad('questions', 11)}`)
  for (const m of v.monthly) line(`  ${pad(m.month, 10)}${lpad(fmt(m.conversations), 14)}${lpad(fmt(m.questions), 11)}`)

  section('ENGAGEMENT')
  line(`  Questions per conversation: avg ${v.depth.avgQuestionsPerConversation} · median ${v.depth.medianQuestionsPerConversation}`)
  line(`  Follow-up questions (2+): ${pct(v.depth.multiTurnShare)} of conversations · 3+: ${pct(v.depth.threePlusShare)}`)
  if (v.busiestDay) line(`  Busiest day: ${v.busiestDay.date} (${fmt(v.busiestDay.questions)} questions)`)

  section('WHEN VISITORS ASK (SGT)')
  line(`  ${v.timing.byWeekday.map((d) => `${d.day} ${fmt(d.questions)}`).join(' · ')}`)
  const maxH = Math.max(1, ...v.timing.byHour)
  for (let h = 0; h < 24; h++) line(`  ${String(h).padStart(2, '0')}:00 ${lpad(fmt(v.timing.byHour[h]), 6)} ${'█'.repeat(Math.round((v.timing.byHour[h] / maxH) * 40))}`)

  section('LANGUAGE (approx., keyword-based)')
  const lt = v.questions || 1
  line(`  English ${pct(v.languages.en / lt)} · Italian ${pct(v.languages.it / lt)} · unclear/short ${pct(v.languages.unclear / lt)}`)

  section('TOPICS (approx., keyword-based, one topic per question)')
  for (const t of v.topics) line(`  ${pad(t.label, 40)}${lpad(pct(t.share), 6)}  (${fmt(t.count)})`)

  section('MOST REPEATED QUESTIONS (asked 2+ times, redacted)')
  if (!v.topQuestions.length) line('  none repeated yet')
  for (const t of v.topQuestions) line(`  ${lpad(`${t.count}×`, 5)}  ${t.text}${t.suggestedButton ? '   [suggested-prompt button]' : ''}`)

  section('ANSWER QUALITY')
  line(`  Answers with knowledge-base sources ........ ${pct(q.groundedShare)}`)
  line(`  Declined / could not answer (approx.) ...... ${pct(q.declinedShare)}  (${fmt(q.declined)} answers)`)
  line(`  Answers linking to italchamber.org.sg ...... ${pct(q.chamberLinkShare)}`)
  line(`  Answers recommending member companies ...... ${fmt(q.answersWithMemberProfiles)}  (member-profile links shown ${fmt(q.memberProfileImpressions)} times — "list all" answers count every member)`)
  line(`  Distinct member profiles recommended ....... ${fmt(q.distinctMembersSurfaced)}  (${fmt(q.membersInKnowledgeBaseSurfaced)} of ${fmt(q.membersInKnowledgeBase)} currently in the directory)`)
  line(`  Answers linking the Events page ............ ${fmt(q.eventsPageLinks)} · Embassy "Fare Affari a Singapore" guide: ${fmt(q.embassyGuideLinks)}`)
  if (q.topMembers.length) {
    line(`  Most-recommended members:`)
    for (const m of q.topMembers) line(`    ${lpad(fmt(m.answers), 5)}  ${m.name}`)
  }

  section('FEEDBACK (thumbs on answers)')
  const ratings = v.feedback.up + v.feedback.down
  line(`  👍 ${fmt(v.feedback.up)} · 👎 ${fmt(v.feedback.down)} · ${pct(v.feedback.ratedShare)} of answers rated · positive share ${pct(v.feedback.satisfaction)}${ratings < 20 ? '  (fewer than 20 ratings — too few to quote as a satisfaction score)' : ''}`)

  if (v.unansweredSamples) {
    section('UNANSWERED OR UNSOURCED QUESTIONS (internal prep only, redacted)')
    if (!v.unansweredSamples.length) line('  none')
    for (const s of v.unansweredSamples) line(`  ${lpad(`${s.count}×`, 5)}  ${s.text}   (last ${s.last.slice(0, 10)})`)
  }

  if (r.voice?.sessions || r.leads.length) {
    section('VOICE & LEADS')
    line(`  Voice sessions: ${fmt(r.voice.sessions)} (${fmt(r.voice.sessionsOver15s)} over 15s) · ${fmt(round(r.voice.seconds / 60))} minutes`)
    for (const l of r.leads) line(`  Leads captured via ${l.source}: ${fmt(l.leads)}`)
  }

  section('CAPACITY (tenant-wide; limits reset on UTC days/months)')
  const lim = r.usage.limits
  if (lim) line(`  Limits: ${fmt(lim.dailyMessageLimit)} messages/day · ${fmt(lim.monthlyTokenLimit)} tokens/month (≈${fmt(Math.floor(lim.monthlyTokenLimit / 500))} chat messages at the 500-token estimate) · $${fmt(lim.monthlyCostLimit)}/month`)
  if (lim) line(`  This month so far: ${fmt(lim.currentMonthTokens)} tokens (${pct(share(lim.currentMonthTokens, lim.monthlyTokenLimit))} of limit)`)
  // Only ALLOWED requests are logged, so a peak at the limit means later visitors that day were refused.
  // Compared against TODAY's limits — if the plan changed since, re-check against the plan at that time.
  for (const d of r.usage.peakDays) line(`  Peak day ${d.day}: ${plural(d.requests, 'chat request')}${lim && d.requests >= lim.dailyMessageLimit ? '  ← reached the current daily limit: visitors may have been refused' : ''}`)
  for (const m of r.usage.monthly) line(`  ${m.month}: ${plural(m.botChatRequests, 'chat request')} for this bot (${fmt(m.tenantChatRequests)} tenant-wide) · ${fmt(m.tenantTokens)} tokens${lim && m.tenantTokens >= lim.monthlyTokenLimit * 0.95 ? '  ← at/near the current monthly token limit' : ''}`)

  section('KNOWLEDGE BASE (tenant-wide — shared by every bot in this tenant)')
  line(`  ${r.knowledgeBase.summary.map((s) => `${s.type} ${s.status}: ${fmt(s.n)}`).join(' · ')}`)
  line(`  ${fmt(r.knowledgeBase.documents)} documents · ${fmt(r.knowledgeBase.chunks)} chunks · last updated ${r.knowledgeBase.lastUpdated ?? 'n/a'}`)
  for (const s of r.knowledgeBase.sources) line(`    ${s.updated}  ${pad(s.status, 10)} ${s.type === 'URL' ? s.sourceUrl || s.name : s.name}`)

  section('NOTES')
  line(`  - "Conversations" are chat sessions, not unique people: the widget starts a new session on every page load;`)
  line(`    the public link keeps one session per browser for 24h.`)
  line(`  - The public link (pub-*) can include demos by Chamber or NIUEXA staff; it cannot be told apart from visitors.`)
  line(`  - Language, topic and "declined" figures are keyword heuristics — use them as indications, not exact counts.`)
  line(`  - Office hours exclude weekends only; Singapore public holidays are not taken into account.`)
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { share: DEFAULT_SHARE_TOKEN, bot: null, since: null, samples: false, json: false }
  for (const a of argv) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'share' && v) opts.share = v
    else if (k === 'bot' && v) opts.bot = v
    else if (k === 'since' && v) opts.since = v
    else if (k === 'samples') opts.samples = true
    else if (k === 'json') opts.json = true
    else throw new Error(`Unknown argument: ${a}`)
  }
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) throw new Error('--since must be YYYY-MM-DD')
  return opts
}

export async function fetchRaw(run, { botRef, sinceIso }) {
  const bots = await run('findBot', { botRef })
  if (!bots.length) throw new Error(`No chatbot found with id or share token "${botRef}"`)
  const bot = bots.find((b) => b.id === botRef) || bots[0]
  const ctx = { botRef, botId: bot.id, tenantId: bot.tenantId, since: sinceIso }
  const raw = { bot }
  for (const name of Object.keys(QUERIES)) {
    if (name === 'findBot') continue
    raw[name] = await run(name, ctx)
  }
  return raw
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run with: node --env-file=.env scripts/iccs-stats.mjs')
    process.exit(1)
  }
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  // Midnight Singapore time on the --since date, as an absolute instant.
  const sinceIso = opts.since ? new Date(`${opts.since}T00:00:00+08:00`).toISOString() : '1970-01-01T00:00:00Z'
  try {
    const raw = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '60s'")
        const run = (name, ctx) => tx.$queryRawUnsafe(QUERIES[name].sql, ...QUERIES[name].params.map((p) => ctx[p]))
        return fetchRaw(run, { botRef: opts.bot || opts.share, sinceIso })
      },
      { maxWait: 15_000, timeout: 180_000 },
    )
    const report = buildReport(raw, { since: opts.since, withSamples: opts.samples })
    console.log(opts.json ? JSON.stringify(report, null, 2) : renderText(report))
  } finally {
    await prisma.$disconnect()
  }
}

// Lower-cased so Windows drive-letter casing (c: vs C:) can't break the check.
const invokedDirectly =
  !!process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
if (invokedDirectly) {
  main().catch((e) => {
    console.error('FATAL', e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
