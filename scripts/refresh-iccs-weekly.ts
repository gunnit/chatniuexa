/**
 * Weekly refresh of the ICCS chatbot's live data: member directory + events.
 *
 * Strategy ("refresh text, keep sectors"):
 *   1. Crawl the corporate membership directory listing to get the current set of
 *      member companies (name + stable /corporate/<ID> detail URL).
 *   2. Crawl each member's detail page and extract the public "About" block, which
 *      now includes the address / phone / website the chamber maintains in GlueUp.
 *      (The structured Email/Phone/Sector fields are member-gated and unreadable
 *      anonymously, so we deliberately rely on the free-text About section.)
 *   3. Rebuild the directory document IN PLACE: each existing member line keeps its
 *      curated `[Sector: ...]`/`[Also relevant to: ...]` tags and only its trailing
 *      description is replaced with the fresh About text. Sector tags are NEVER
 *      re-derived from the (gated) site — they are preserved from the existing
 *      directory. Genuinely new members are LLM-classified once and inserted into
 *      their sector block; departed members are dropped.
 *   4. Re-chunk + re-embed the directory document, and resync the events page.
 *
 * In live mode the base directory text is read from the live DB document (source of
 * truth) and the result is written back to both the DB and the local v3 file. In
 * --dry-run mode nothing touches the DB or external state: it crawls, builds the new
 * directory text from the local v3 file, writes it to <out> and prints a diff
 * summary — this is the safe way to verify the job end to end.
 *
 * Env required: FIRECRAWL_API_KEY, OPENAI_API_KEY (only if new members appear),
 *               DATABASE_URL (live mode only).
 *
 * Crawl scope:
 *   - DEFAULT (incremental): the listing crawl (1 request) reveals the current
 *     member set; we then crawl ONLY members whose ID isn't already in the
 *     directory, and drop members that left the listing. Typically 0–3 crawls/week.
 *   - --full: crawl every member detail page. Use for the initial backfill and as
 *     a periodic (e.g. monthly) refresh that also re-captures edits made to
 *     EXISTING members' About text — which incremental can't detect (the site
 *     exposes no per-page lastmod / change signal).
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/refresh-iccs-weekly.ts [--dry-run]
 *        [--full] [--members-only] [--events-only] [--share=lOLj8UA]
 *
 * Defaults: shareToken=lOLj8UA, directory file=italchamber_directory_v3.txt
 */
import fs from 'node:fs'
import { prisma } from '../src/lib/db'
import { crawlUrl } from '../src/lib/documents/crawler'
import { processUrl, reprocessDocumentContent } from '../src/lib/documents/processor'
import { getOpenAI } from '../src/lib/openai'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const LISTING_URL = 'https://italchamber.org.sg/membership-directory/corporate'
const EVENTS_URL = 'https://italchamber.org.sg/events'
const MEMBER_BASE = 'https://italchamber.org.sg/membership-directory/corporate'
const DIR_FILE = 'italchamber_directory_v3.txt'
const CRAWL_CONCURRENCY = 3 // stay polite vs Firecrawl's ~100 req/min cap; retry-after handles the rest
const DESC_MAX = 1500 // cap per-member description so contacts survive without bloat

// `[Sector: X] [Also relevant to: A; B] **[Name](url)** — description`
const MEMBER_RE = /^\[Sector:\s*(.+?)\]\s*(\[Also relevant to:.*?\]\s*)?\*\*\[(.+?)\]\((.+?)\)\*\*\s*(?:—\s*)?(.*)$/
const SECTOR_HEADER_RE = /^##\s*Sector:\s*(.+?)\s*\(\d+\s*partners?\)/i
const ID_RE = /\/corporate\/(\d+)/

const SECTORS = [
  'AUTOMOTIVE', 'BUSINESS SERVICES', 'CHEMICALS', 'CONSTRUCTION AND INFRASTRUCTURE',
  'DEFENCE AND AEROSPACE', 'EDUCATION', 'ENERGY', 'EVENTS AND COMMUNICATION', 'FINANCE',
  'FOOD AND BEVERAGE', 'FURNITURE AND HOME APPLIANCES', 'HEALTHCARE', 'HOSPITALITY AND TOURISM',
  'INFORMATION TECHNOLOGY', 'LEGAL AND ACCOUNTING FIRMS', 'LUXURY RETAIL', 'MANUFACTURING',
  'MECHANICAL AND INDUSTRIAL/ENGINEERING', 'PUBLIC RELATIONS AND COMMUNICATIONS', 'RESTAURANTS',
  'SECURITY SYSTEMS', 'SHIPPING / FREIGHT FORWARDING', 'TRADING', 'TRANSLATION AND LANGUAGE SERVICES',
]
const SECTORSET = new Set(SECTORS)

interface Flags { dryRun: boolean; full: boolean; membersOnly: boolean; eventsOnly: boolean; share: string }
interface CrawledMember { id: string; name: string; about: string }

function parseFlags(argv: string[]): Flags {
  const f: Flags = { dryRun: false, full: false, membersOnly: false, eventsOnly: false, share: 'lOLj8UA' }
  for (const a of argv) {
    if (a === '--dry-run') f.dryRun = true
    else if (a === '--full') f.full = true
    else if (a === '--members-only') f.membersOnly = true
    else if (a === '--events-only') f.eventsOnly = true
    else if (a.startsWith('--share=')) f.share = a.slice('--share='.length)
  }
  return f
}

// Run async tasks with a fixed concurrency cap.
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Crawl with Firecrawl rate-limit handling: on a 429 the API tells us how long to
// wait ("retry after Ns") — honour it (with jitter to desync concurrent workers)
// and retry. Non-rate-limit errors fail fast. This is what makes a --full run of
// ~173 pages survive the ~100 req/min cap.
async function crawlWithRetry(url: string, attempts = 6): Promise<{ content: string; title: string; url: string }> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await crawlUrl(url)
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!/rate limit/i.test(msg)) throw e
      const m = msg.match(/retry after (\d+)\s*s/i)
      const waitMs = ((m ? parseInt(m[1], 10) : 30) + 1) * 1000 + Math.floor(Math.random() * 4000)
      await sleep(waitMs)
    }
  }
  throw lastErr
}

// Pull the public About block (description + address/phone/website) from a member
// detail page's markdown, stopping before the member-gated structured fields.
function extractAbout(markdown: string): string {
  let text = markdown
  const aboutIdx = text.search(/###\s*About/i)
  if (aboutIdx !== -1) text = text.slice(aboutIdx).replace(/###\s*About/i, '')
  // Cut at the gated fields / members roster — everything after is login-only noise.
  const stops = [/Email:\s*Available to Members/i, /Company Website Address:/i, /###\s*Members/i, /Sector:\s*Available to Members/i]
  let cut = text.length
  for (const re of stops) { const m = text.search(re); if (m !== -1) cut = Math.min(cut, m) }
  text = text.slice(0, cut)
  // Strip markdown images/links to plain text, collapse whitespace.
  text = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')         // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // links -> label
    .replace(/[#*_`>]/g, ' ')                        // md punctuation
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' · ')                          // keep block separation readable
    .replace(/\s*·\s*(·\s*)+/g, ' · ')
    .replace(/[ \t]+/g, ' ')
    .replace(/^[\s·]+|[\s·]+$/g, '')
    .trim()
  if (text.length > DESC_MAX) text = text.slice(0, DESC_MAX).replace(/\s+\S*$/, '') + '…'
  return text
}

function normName(n: string): string {
  return n.toLowerCase().replace(/[.,]/g, ' ')
    .replace(/\b(pte|ltd|llp|llc|inc|spa|s\.p\.a|srl|s\.r\.l|co|corporation|asia|pacific|apac|singapore|group|holdings)\b/g, ' ')
    .replace(/&/g, ' ').replace(/\s+/g, ' ').trim()
}

// LLM-classify brand-new members into the 24 official sectors (primary first).
async function classifyNewMembers(members: CrawledMember[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (members.length === 0) return out
  const openai = getOpenAI()
  const SYSTEM = `You categorise companies into the Italian Chamber of Commerce Singapore's 24 official sectors.
Sectors (use these EXACT names): ${SECTORS.join(' | ')}.
For each company return every sector it GENUINELY provides services in — its main sector FIRST, then any others it clearly also serves. Be accurate, not generous. Most match 1-3 sectors.
Return ONLY compact JSON: {"Company Name": ["PRIMARY","OTHER",...], ...} using the exact company names given.`
  const B = 12
  for (let i = 0; i < members.length; i += B) {
    const batch = members.slice(i, i + B)
    const list = batch.map((m) => `- ${m.name}: ${m.about.slice(0, 700)}`).join('\n')
    try {
      const r = await openai.chat.completions.create({
        model: process.env.TAG_MODEL || 'gpt-5.4-mini',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: list }],
        max_completion_tokens: 4000,
      })
      const txt = r.choices[0]?.message?.content || ''
      const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)) as Record<string, string[]>
      for (const [name, secs] of Object.entries(json)) {
        const valid = (secs || []).filter((s) => SECTORSET.has(s))
        if (valid.length) out.set(name, valid)
      }
    } catch (e) {
      console.error(`  new-member classify batch @${i} failed:`, e instanceof Error ? e.message : e)
    }
  }
  return out
}

// Rebuild a member directory line, preserving tags and swapping the description.
function buildMemberLine(primary: string, alsoTag: string, name: string, url: string, desc: string): string {
  const also = alsoTag ? `${alsoTag.trim()} ` : ''
  return `[Sector: ${primary}] ${also}**[${name}](${url})** — ${desc}`.replace(/\s+$/, '')
}

async function refreshMembers(flags: Flags): Promise<string> {
  // 1. Crawl the listing — this 1 request tells us the full current member set
  //    (names + stable /corporate/<ID> URLs) without touching any detail page.
  console.log('→ Crawling membership directory listing…')
  const listing = await crawlWithRetry(LISTING_URL)
  const pairs = [...listing.content.matchAll(/##\s*\[([^\]]+)\]\((https:\/\/italchamber\.org\.sg\/membership-directory\/corporate\/(\d+)[^)]*)\)/g)]
  const seen = new Set<string>()
  const members = pairs
    .map((m) => ({ name: m[1].trim(), url: m[2], id: m[3] }))
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
  console.log(`  found ${members.length} corporate members`)
  if (members.length < 50) throw new Error(`Listing returned only ${members.length} members — aborting (page format likely changed).`)
  const listingIds = new Set(members.map((m) => m.id))

  // 2. Load the base directory text (live DB doc / local file in dry-run) FIRST,
  //    so we know which member IDs we already have before deciding what to crawl.
  let baseText: string
  let docId: string | null = null
  if (flags.dryRun) {
    baseText = fs.readFileSync(DIR_FILE, 'utf8')
  } else {
    const chatbot = await prisma.chatbot.findUnique({ where: { shareToken: flags.share }, select: { tenantId: true, name: true } })
    if (!chatbot) throw new Error(`No chatbot with shareToken="${flags.share}"`)
    const candidates = await prisma.document.findMany({
      where: { content: { contains: '[Sector:' }, dataSource: { tenantId: chatbot.tenantId } },
      select: { id: true, content: true },
    })
    if (candidates.length === 0) throw new Error('No directory document found for tenant; ingest it once first.')
    const target = candidates.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))[0]
    docId = target.id
    baseText = target.content || ''
    console.log(`  bot "${chatbot.name}" directory document ${docId} (${baseText.length} chars)`)
  }
  const lines = baseText.split('\n')
  const existingIds = new Set<string>()
  for (const l of lines) {
    const m = l.match(MEMBER_RE)
    const idm = m && m[4].match(ID_RE)
    if (idm) existingIds.add(idm[1])
  }

  // 3. Decide which detail pages to crawl:
  //    - incremental (default): only members whose ID we don't already have.
  //    - --full: every member (one-time backfill, or periodic drift refresh that
  //      also re-captures edits to EXISTING members' About text).
  const targets = flags.full ? members : members.filter((m) => !existingIds.has(m.id))
  const departed = [...existingIds].filter((id) => !listingIds.has(id))
  console.log(`  mode: ${flags.full ? 'FULL (all members)' : 'INCREMENTAL (new members only)'} — crawling ${targets.length} detail page(s); ${departed.length} departed`)

  const aboutById = new Map<string, CrawledMember>()
  if (targets.length) {
    console.log(`→ Crawling ${targets.length} member detail page(s) (concurrency ${CRAWL_CONCURRENCY})…`)
    let done = 0, withContact = 0
    const crawled = await pool(targets, CRAWL_CONCURRENCY, async (m): Promise<CrawledMember | null> => {
      try {
        const page = await crawlWithRetry(`${MEMBER_BASE}/${m.id}`)
        const about = extractAbout(page.content)
        done++
        if (/\+?\d[\d ()-]{6,}|@|http/i.test(about)) withContact++
        if (done % 25 === 0) process.stdout.write(`  ${done}/${targets.length}\r`)
        return { id: m.id, name: m.name, about }
      } catch (e) {
        console.error(`\n  detail crawl failed for ${m.name} (${m.id}):`, e instanceof Error ? e.message : e)
        return null
      }
    })
    for (const c of crawled) if (c && c.about) aboutById.set(c.id, c)
    console.log(`\n  extracted About for ${aboutById.size}/${targets.length} crawled (${withContact} contain contact data)`)
  }

  // 4. Update descriptions of EXISTING lines we re-crawled (only happens in --full,
  //    since incremental never crawls existing IDs). Tags are always preserved.
  let updated = 0, removed = 0
  const kept: string[] = []
  for (const line of lines) {
    const m = line.match(MEMBER_RE)
    if (!m) { kept.push(line); continue }
    const [, primary, alsoTag = '', name, url] = m
    const id = url.match(ID_RE)?.[1]
    if (id && !listingIds.has(id)) { removed++; continue } // drop departed members
    const fresh = id ? aboutById.get(id) : undefined
    if (fresh?.about) { kept.push(buildMemberLine(primary.trim(), alsoTag, name, url, fresh.about)); updated++ }
    else kept.push(line)
  }
  let work = kept

  // 5. Insert genuinely new members (LLM-classify their sector once).
  const newMembers = targets.filter((m) => !existingIds.has(m.id) && aboutById.get(m.id)?.about)
    .map((m) => aboutById.get(m.id)!)
  let inserted = 0
  if (newMembers.length) {
    console.log(`→ ${newMembers.length} new member(s) — classifying sectors via LLM…`)
    const tags = await classifyNewMembers(newMembers)
    for (const nm of newMembers) {
      const secs = tags.get(nm.name) || []
      const primary = secs[0] || 'BUSINESS SERVICES'
      const also = secs.slice(1)
      const url = `${MEMBER_BASE}/${nm.id}#page-member-ajax`
      const alsoTag = also.length ? `[Also relevant to: ${also.join('; ')}]` : ''
      const line = buildMemberLine(primary, alsoTag, nm.name, url, nm.about)
      const hdr = work.findIndex((l) => SECTOR_HEADER_RE.test(l) && (l.match(SECTOR_HEADER_RE)![1].toUpperCase() === primary))
      if (hdr !== -1) work.splice(hdr + 1, 0, line)
      else work.push('', line)
      inserted++
    }
  }

  const newText = work.join('\n')
  console.log(`\n  Directory summary:`)
  console.log(`    descriptions refreshed : ${updated}`)
  console.log(`    new members inserted   : ${inserted}`)
  console.log(`    departed members removed: ${removed}`)
  console.log(`    base ${baseText.length} chars → new ${newText.length} chars`)

  if (flags.dryRun) {
    const outFile = DIR_FILE.replace(/\.txt$/, '') + '.refreshed.txt'
    fs.writeFileSync(outFile, newText)
    console.log(`  [dry-run] wrote ${outFile} — no DB writes, no chunks re-embedded.`)
    return newText
  }

  console.log('→ Re-chunking + re-embedding directory document…')
  const { chunkCount } = await reprocessDocumentContent(docId!, newText)
  fs.writeFileSync(DIR_FILE, newText) // keep file source-of-truth in sync
  console.log(`  OK — ${chunkCount} chunks re-embedded; ${DIR_FILE} updated.`)
  return newText
}

async function refreshEvents(flags: Flags): Promise<void> {
  console.log('→ Refreshing events page…')
  const crawled = await crawlWithRetry(EVENTS_URL)
  console.log(`  crawled events (${crawled.content.length} chars, title="${crawled.title}")`)
  if (flags.dryRun) { console.log('  [dry-run] events not written to DB.'); return }

  const chatbot = await prisma.chatbot.findUnique({ where: { shareToken: flags.share }, select: { tenantId: true } })
  if (!chatbot) throw new Error(`No chatbot with shareToken="${flags.share}"`)
  // Reuse an existing events data source if present (www or non-www), else create one.
  const existing = await prisma.dataSource.findFirst({
    where: { tenantId: chatbot.tenantId, type: 'URL', sourceUrl: { contains: '/events' } },
    select: { id: true, sourceUrl: true },
  })
  const ds = existing ?? await prisma.dataSource.create({
    data: { tenantId: chatbot.tenantId, type: 'URL', name: 'Upcoming Events', sourceUrl: EVENTS_URL, status: 'PENDING' },
  })
  await processUrl({ dataSourceId: ds.id, url: ds.sourceUrl || EVENTS_URL, content: crawled.content, title: crawled.title })
  console.log(`  OK — events ingested into data source ${ds.id}.`)
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  console.log(`ICCS weekly refresh — ${flags.dryRun ? 'DRY RUN' : 'LIVE'} (share=${flags.share})\n`)
  if (!flags.eventsOnly) await refreshMembers(flags)
  if (!flags.membersOnly) await refreshEvents(flags)
  console.log('\nDone.')
}

main()
  .catch((e) => { console.error('Fatal:', e instanceof Error ? e.stack || e.message : e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect().catch(() => {}) })
