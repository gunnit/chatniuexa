/**
 * Enrich the ICCS member directory with accurate cross-sector tags.
 *
 * For each member it asks the model which of the 24 official sectors the company
 * GENUINELY provides services in (its primary sector plus any it also serves),
 * then writes an enriched directory where multi-sector members carry an
 * `[Also relevant to: SECTOR_A; SECTOR_B]` tag. The runtime
 * (`buildDirectoryRosterDirective` in src/lib/chat/rag.ts) reads these tags to
 * build the mandatory member roster for category queries, so cross-sector members
 * (e.g. Hawksford under "accounting") are never dropped.
 *
 * The LLM is used (not keyword matching) because keywords can't tell "law firm"
 * from "law enforcement". Re-run this whenever the member list is refreshed, then
 * re-ingest with scripts/reingest-directory.ts.
 *
 * Inputs:
 *   - directory file: the plain directory with `[Sector: X] **[Name](url)** — desc`
 *     lines and the "## Sector synonyms" block (default: italchamber_directory_v2.txt)
 *   - members CSV: full descriptions, columns "Company Name","About" (default: sheet_temp.csv)
 * Output: enriched directory (default: italchamber_directory_v3.txt)
 *
 * Requires OPENAI_API_KEY. Usage:
 *   node --env-file=.env --import tsx scripts/build-directory-tags.ts [inDir] [csv] [outDir]
 */
import fs from 'node:fs'
import { getOpenAI } from '../src/lib/openai'

const SECTORS = [
  'AUTOMOTIVE', 'BUSINESS SERVICES', 'CHEMICALS', 'CONSTRUCTION AND INFRASTRUCTURE',
  'DEFENCE AND AEROSPACE', 'EDUCATION', 'ENERGY', 'EVENTS AND COMMUNICATION', 'FINANCE',
  'FOOD AND BEVERAGE', 'FURNITURE AND HOME APPLIANCES', 'HEALTHCARE', 'HOSPITALITY AND TOURISM',
  'INFORMATION TECHNOLOGY', 'LEGAL AND ACCOUNTING FIRMS', 'LUXURY RETAIL', 'MANUFACTURING',
  'MECHANICAL AND INDUSTRIAL/ENGINEERING', 'PUBLIC RELATIONS AND COMMUNICATIONS', 'RESTAURANTS',
  'SECURITY SYSTEMS', 'SHIPPING / FREIGHT FORWARDING', 'TRADING', 'TRANSLATION AND LANGUAGE SERVICES',
]
const SECTORSET = new Set(SECTORS)
const MODEL = process.env.TAG_MODEL || 'gpt-5.4-mini'
const MEMBER_RE = /^\[Sector:\s*(.+?)\]\s*\*\*\[(.+?)\]\((.+?)\)\*\*\s*(.*)$/

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false } else field += c } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* skip */ } else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}
function normName(n: string): string {
  return n.toLowerCase().replace(/[.,]/g, ' ')
    .replace(/\b(pte|ltd|llp|llc|inc|spa|s\.p\.a|srl|s\.r\.l|co|corporation|asia|pacific|apac|singapore|group|holdings)\b/g, ' ')
    .replace(/&/g, ' ').replace(/\s+/g, ' ').trim()
}

const SYSTEM = `You categorise companies into the Italian Chamber of Commerce Singapore's 24 official sectors.
Sectors (use these EXACT names): ${SECTORS.join(' | ')}.
For each company, return every sector it GENUINELY provides services in — its main sector plus any others it clearly also serves (e.g. a corporate-services firm that does tax/accounting/compliance also belongs to LEGAL AND ACCOUNTING FIRMS; a consultancy that builds software also belongs to INFORMATION TECHNOLOGY). Do NOT add a sector because a word appears incidentally ("law enforcement" does not make a defence firm a LEGAL AND ACCOUNTING firm). Be accurate, not generous. Most companies match 1-3 sectors.
Return ONLY compact JSON: {"Company Name": ["SECTOR", ...], ...} using the exact company names given.`

async function main() {
  const inDir = process.argv[2] || 'italchamber_directory_v2.txt'
  const csvPath = process.argv[3] || 'sheet_temp.csv'
  const outDir = process.argv[4] || 'italchamber_directory_v3.txt'

  const csv = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  const head = csv[0]
  const iName = head.indexOf('Company Name'), iAbout = head.indexOf('About')
  const aboutByNorm = new Map<string, string>()
  for (let r = 1; r < csv.length; r++) {
    const n = (csv[r][iName] || '').trim()
    if (n) aboutByNorm.set(normName(n), (csv[r][iAbout] || '').trim())
  }

  const dir = fs.readFileSync(inDir, 'utf8')
  const members: Array<{ primary: string; name: string }> = []
  for (const line of dir.split('\n')) {
    const m = line.match(MEMBER_RE)
    if (m) members.push({ primary: m[1].trim(), name: m[2] })
  }

  const openai = getOpenAI()
  const byName = new Map(members.map((m) => [m.name, m]))
  const tags = new Map<string, string[]>()
  const B = 12
  for (let i = 0; i < members.length; i += B) {
    const batch = members.slice(i, i + B)
    const list = batch.map((m) => `- ${m.name}: ${(aboutByNorm.get(normName(m.name)) || '').slice(0, 700)}`).join('\n')
    try {
      const r = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: list }],
        max_completion_tokens: 4000,
      })
      const txt = r.choices[0]?.message?.content || ''
      const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)) as Record<string, string[]>
      for (const [name, secs] of Object.entries(json)) {
        const m = byName.get(name) || byName.get(name.trim())
        if (!m) continue
        tags.set(m.name, (secs || []).filter((s) => SECTORSET.has(s)))
      }
      process.stdout.write(`batch ${Math.floor(i / B) + 1}/${Math.ceil(members.length / B)} ok\r`)
    } catch (e) {
      console.error(`\nbatch at ${i} failed:`, e instanceof Error ? e.message : e)
    }
  }

  let tagged = 0
  const out = dir.split('\n').map((line) => {
    const m = line.match(MEMBER_RE)
    if (!m) return line
    const name = m[2], primary = m[1].trim()
    const also = (tags.get(name) || []).filter((s) => s !== primary)
    if (!also.length) return line
    tagged++
    return `[Sector: ${m[1]}] [Also relevant to: ${also.join('; ')}] **[${name}](${m[3]})** ${m[4]}`.trimEnd()
  })
  fs.writeFileSync(outDir, out.join('\n'))
  console.log(`\nWrote ${outDir} — ${members.length} members, ${tagged} cross-tagged.`)
}

main().catch((e) => { console.error('Fatal:', e instanceof Error ? e.message : e); process.exit(1) })
