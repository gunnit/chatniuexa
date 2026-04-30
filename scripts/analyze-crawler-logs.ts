/* eslint-disable no-console */
/**
 * AI crawler log analyzer.
 *
 * Pulls Render logs for the configured service and tallies hits from known AI
 * bots. Writes a markdown report to docs/aeo-baselines/YYYY-MM-DD.md.
 *
 * Env vars required:
 *   - RENDER_API_KEY      Render personal API key
 *   - RENDER_SERVICE_ID   srv-xxx for chataziendale (default: srv-d5t62ishg0os73a32fm0)
 *
 * Usage:
 *   npx tsx scripts/analyze-crawler-logs.ts            # last 7 days
 *   npx tsx scripts/analyze-crawler-logs.ts --days 30  # last 30 days
 */

import fs from 'node:fs'
import path from 'node:path'

const RENDER_API_BASE = 'https://api.render.com/v1'
const DEFAULT_SERVICE_ID = 'srv-d5t62ishg0os73a32fm0'
const DEFAULT_DAYS = 7

const CRAWLERS: Record<string, { category: 'training' | 'search' | 'user' | 'classic'; vendor: string }> = {
  GPTBot: { category: 'training', vendor: 'OpenAI' },
  'OAI-SearchBot': { category: 'search', vendor: 'OpenAI' },
  'ChatGPT-User': { category: 'user', vendor: 'OpenAI' },
  ClaudeBot: { category: 'training', vendor: 'Anthropic' },
  'Claude-SearchBot': { category: 'search', vendor: 'Anthropic' },
  'Claude-User': { category: 'user', vendor: 'Anthropic' },
  'anthropic-ai': { category: 'training', vendor: 'Anthropic' },
  PerplexityBot: { category: 'search', vendor: 'Perplexity' },
  'Perplexity-User': { category: 'user', vendor: 'Perplexity' },
  'Google-Extended': { category: 'training', vendor: 'Google' },
  Googlebot: { category: 'classic', vendor: 'Google' },
  Bingbot: { category: 'classic', vendor: 'Microsoft' },
  Applebot: { category: 'classic', vendor: 'Apple' },
  'Applebot-Extended': { category: 'training', vendor: 'Apple' },
  Bytespider: { category: 'training', vendor: 'ByteDance' },
  CCBot: { category: 'training', vendor: 'CommonCrawl' },
  Amazonbot: { category: 'classic', vendor: 'Amazon' },
  'Meta-ExternalAgent': { category: 'training', vendor: 'Meta' },
  'cohere-ai': { category: 'training', vendor: 'Cohere' },
  Diffbot: { category: 'training', vendor: 'Diffbot' },
}

type Hit = {
  bot: string
  url: string
  ts: string
}

type RenderLog = {
  id?: string
  timestamp?: string
  message?: string
  labels?: Array<{ name: string; value: string }>
}

function parseArgs(): { days: number } {
  const idx = process.argv.indexOf('--days')
  if (idx === -1) return { days: DEFAULT_DAYS }
  const n = Number(process.argv[idx + 1])
  return { days: Number.isFinite(n) && n > 0 ? n : DEFAULT_DAYS }
}

function detectBot(userAgent: string): string | null {
  for (const name of Object.keys(CRAWLERS)) {
    if (userAgent.includes(name)) return name
  }
  return null
}

async function fetchLogs(
  apiKey: string,
  serviceId: string,
  startTime: Date,
  endTime: Date,
): Promise<RenderLog[]> {
  const all: RenderLog[] = []
  const url = new URL(`${RENDER_API_BASE}/logs`)
  url.searchParams.set('ownerId', '')
  url.searchParams.set('resource', serviceId)
  url.searchParams.set('startTime', startTime.toISOString())
  url.searchParams.set('endTime', endTime.toISOString())
  url.searchParams.set('limit', '1000')

  let nextStartTime: string | null = null
  while (true) {
    if (nextStartTime) url.searchParams.set('startTime', nextStartTime)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Render API ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { logs?: RenderLog[]; hasMore?: boolean; nextStartTime?: string }
    const page = data.logs ?? []
    all.push(...page)
    if (!data.hasMore || !data.nextStartTime) break
    if (data.nextStartTime === nextStartTime) break
    nextStartTime = data.nextStartTime
    if (all.length > 100_000) {
      console.warn('[crawler-logs] capping at 100k log lines')
      break
    }
  }
  return all
}

function extractUserAgent(message: string): string | null {
  // Render web service log format is host-dependent. We try a couple of patterns.
  // 1. Common combined log:  "GET /path HTTP/1.1" 200 - "ref" "ua"
  const combined = message.match(/"[^"]*"\s+\d+\s+\S+\s+"[^"]*"\s+"([^"]+)"/)
  if (combined) return combined[1]
  // 2. JSON-ish message with user-agent or ua field
  const ua = message.match(/"user-agent"\s*:\s*"([^"]+)"|"ua"\s*:\s*"([^"]+)"/i)
  if (ua) return ua[1] ?? ua[2]
  return null
}

function extractPath(message: string): string | null {
  const m = message.match(/"(?:GET|POST|HEAD)\s+([^\s"]+)/)
  return m ? m[1] : null
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function tally(logs: RenderLog[]): {
  hits: Hit[]
  byBot: Map<string, number>
  topUrls: Map<string, Map<string, number>>
  byDay: Map<string, Map<string, number>>
} {
  const hits: Hit[] = []
  const byBot = new Map<string, number>()
  const topUrls = new Map<string, Map<string, number>>()
  const byDay = new Map<string, Map<string, number>>()

  for (const log of logs) {
    const message = log.message ?? ''
    const ua = extractUserAgent(message)
    if (!ua) continue
    const bot = detectBot(ua)
    if (!bot) continue
    const url = extractPath(message) ?? '?'
    const ts = log.timestamp ?? new Date().toISOString()
    hits.push({ bot, url, ts })
    byBot.set(bot, (byBot.get(bot) ?? 0) + 1)

    const urls = topUrls.get(bot) ?? new Map<string, number>()
    urls.set(url, (urls.get(url) ?? 0) + 1)
    topUrls.set(bot, urls)

    const day = dayKey(ts)
    const days = byDay.get(bot) ?? new Map<string, number>()
    days.set(day, (days.get(day) ?? 0) + 1)
    byDay.set(bot, days)
  }
  return { hits, byBot, topUrls, byDay }
}

function renderReport(
  total: number,
  windowDays: number,
  startTime: Date,
  endTime: Date,
  { hits, byBot, topUrls, byDay }: ReturnType<typeof tally>,
): string {
  const sortedBots = Array.from(byBot.entries()).sort((a, b) => b[1] - a[1])

  let out = ''
  out += `# AEO crawler baseline — ${new Date().toISOString().slice(0, 10)}\n\n`
  out += `Window: last ${windowDays} day(s) (${startTime.toISOString()} → ${endTime.toISOString()})\n\n`
  out += `Total log lines scanned: ${total}\n`
  out += `AI / search bot hits detected: **${hits.length}**\n\n`

  if (hits.length === 0) {
    out += '_No AI bot traffic detected in the window. Check that Render log retention covers the full window, or that the User-Agent header is making it into the logs (Render terminates TLS upstream — UA should be present)._\n'
    return out
  }

  out += '## Hits per bot\n\n'
  out += '| Bot | Vendor | Category | Hits |\n'
  out += '|---|---|---|---:|\n'
  for (const [bot, n] of sortedBots) {
    const meta = CRAWLERS[bot]
    out += `| \`${bot}\` | ${meta.vendor} | ${meta.category} | ${n} |\n`
  }
  out += '\n'

  out += '## Top URLs per bot (max 5)\n\n'
  for (const [bot] of sortedBots) {
    const urls = topUrls.get(bot)
    if (!urls) continue
    const top = Array.from(urls.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    out += `### \`${bot}\`\n\n`
    out += '| URL | Hits |\n|---|---:|\n'
    for (const [url, n] of top) out += `| \`${url}\` | ${n} |\n`
    out += '\n'
  }

  out += '## Day-over-day\n\n'
  const allDays = Array.from(
    new Set(
      Array.from(byDay.values()).flatMap((m) => Array.from(m.keys())),
    ),
  ).sort()
  out += `| Bot | ${allDays.join(' | ')} |\n`
  out += `|---|${allDays.map(() => '---:').join('|')}|\n`
  for (const [bot] of sortedBots) {
    const days = byDay.get(bot) ?? new Map()
    out += `| \`${bot}\` | ${allDays.map((d) => days.get(d) ?? 0).join(' | ')} |\n`
  }

  return out
}

async function main() {
  const apiKey = process.env.RENDER_API_KEY
  if (!apiKey) {
    console.error('Set RENDER_API_KEY (https://dashboard.render.com/u/settings#api-keys).')
    process.exit(1)
  }
  const serviceId = process.env.RENDER_SERVICE_ID ?? DEFAULT_SERVICE_ID

  const { days } = parseArgs()
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000)

  console.log(`[crawler-logs] window: ${days} day(s); service: ${serviceId}`)

  const logs = await fetchLogs(apiKey, serviceId, startTime, endTime)
  console.log(`[crawler-logs] fetched ${logs.length} log lines`)

  const summary = tally(logs)
  const report = renderReport(logs.length, days, startTime, endTime, summary)

  const outDir = path.join(process.cwd(), 'docs', 'aeo-baselines')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${new Date().toISOString().slice(0, 10)}.md`)
  fs.writeFileSync(outPath, report, 'utf-8')
  console.log(`[crawler-logs] wrote ${path.relative(process.cwd(), outPath)}`)
}

main().catch((err) => {
  console.error('[crawler-logs] fatal:', err)
  process.exit(1)
})
