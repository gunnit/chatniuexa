/**
 * Ingest a list of URLs as data sources for a chatbot's tenant.
 *
 * Usage:
 *   npx tsx scripts/ingest-urls-for-chatbot.ts <shareToken> <urlsJsonPath>
 *
 * The JSON file must contain { "urls": ["https://...", ...] }.
 * Idempotent: URLs already present (by sourceUrl) for the tenant are skipped.
 *
 * Env required: DATABASE_URL, FIRECRAWL_API_KEY, OPENAI_API_KEY
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/lib/db'
import { crawlUrl } from '../src/lib/documents/crawler'
import { processUrl } from '../src/lib/documents/processor'

async function main() {
  const shareToken = process.argv[2]
  const jsonPath = process.argv[3]

  if (!shareToken || !jsonPath) {
    console.error('Usage: npx tsx scripts/ingest-urls-for-chatbot.ts <shareToken> <urlsJsonPath>')
    process.exit(1)
  }

  const absPath = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath)
  const raw = fs.readFileSync(absPath, 'utf8')
  const config = JSON.parse(raw) as { urls: string[] }

  if (!Array.isArray(config.urls) || config.urls.length === 0) {
    console.error('JSON must contain a non-empty "urls" array')
    process.exit(1)
  }

  const chatbot = await prisma.chatbot.findUnique({
    where: { shareToken },
    select: { id: true, name: true, tenantId: true },
  })

  if (!chatbot) {
    console.error(`No chatbot found with shareToken="${shareToken}"`)
    process.exit(1)
  }

  console.log(`Chatbot: ${chatbot.name} (id=${chatbot.id}, tenantId=${chatbot.tenantId})`)
  console.log(`URLs to ingest: ${config.urls.length}`)

  const existing = await prisma.dataSource.findMany({
    where: { tenantId: chatbot.tenantId, type: 'URL', sourceUrl: { in: config.urls } },
    select: { sourceUrl: true, status: true },
  })
  const existingMap = new Map(existing.map((ds) => [ds.sourceUrl as string, ds.status]))

  const summary = { skipped: 0, created: 0, succeeded: 0, failed: 0 }

  for (const url of config.urls) {
    const prior = existingMap.get(url)
    if (prior) {
      console.log(`SKIP  ${url} (already exists, status=${prior})`)
      summary.skipped++
      continue
    }

    let dsId: string | null = null
    try {
      const ds = await prisma.dataSource.create({
        data: {
          tenantId: chatbot.tenantId,
          type: 'URL',
          name: new URL(url).pathname || url,
          sourceUrl: url,
          status: 'PENDING',
        },
      })
      dsId = ds.id
      summary.created++
      console.log(`NEW   ${url} (dataSourceId=${ds.id})`)

      console.log(`      crawling…`)
      const crawled = await crawlUrl(url)

      if (crawled.title && crawled.title !== url) {
        await prisma.dataSource.update({ where: { id: ds.id }, data: { name: crawled.title } })
      }

      console.log(`      processing (${crawled.content.length} chars)…`)
      await processUrl({
        dataSourceId: ds.id,
        url,
        content: crawled.content,
        title: crawled.title,
      })

      summary.succeeded++
      console.log(`OK    ${url}`)
    } catch (err) {
      summary.failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`FAIL  ${url} — ${msg}`)
      if (dsId) {
        await prisma.dataSource
          .update({ where: { id: dsId }, data: { status: 'FAILED', error: msg } })
          .catch(() => {})
      }
    }
  }

  console.log('\nSummary:', summary)
}

main()
  .catch((e) => {
    console.error('Fatal:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
