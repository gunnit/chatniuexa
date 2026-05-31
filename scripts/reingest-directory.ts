/**
 * Re-ingest the enriched member directory into the chatbot's knowledge base.
 *
 * Finds the tenant's directory document (the one whose content carries the
 * per-member `[Sector: ...]` marker) and re-chunks + re-embeds it with the new
 * tagged content from disk. Run this after scripts/build-directory-tags.ts so the
 * `[Also relevant to: ...]` tags reach the live retrieval index.
 *
 * Requires DATABASE_URL and OPENAI_API_KEY. Usage:
 *   node --env-file=.env --import tsx scripts/reingest-directory.ts [shareToken] [dirFile]
 *   # defaults: shareToken=lOLj8UA, dirFile=italchamber_directory_v3.txt
 */
import fs from 'node:fs'
import { prisma } from '../src/lib/db'
import { reprocessDocumentContent } from '../src/lib/documents/processor'

async function main() {
  const shareToken = process.argv[2] || 'lOLj8UA'
  const dirFile = process.argv[3] || 'italchamber_directory_v3.txt'

  const newContent = fs.readFileSync(dirFile, 'utf8')
  if (!newContent.includes('[Sector:')) {
    console.error(`${dirFile} does not look like a directory file (no "[Sector:" markers).`)
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

  // The directory document = a document for this tenant whose content carries the
  // per-member `[Sector:` marker.
  const candidates = await prisma.document.findMany({
    where: {
      content: { contains: '[Sector:' },
      dataSource: { tenantId: chatbot.tenantId },
    },
    select: { id: true, title: true, content: true },
  })

  if (candidates.length === 0) {
    console.error('No existing directory document found for this tenant. Upload the directory once via the dashboard first, then re-run.')
    process.exit(1)
  }
  if (candidates.length > 1) {
    console.warn(`Found ${candidates.length} directory-like documents; updating the largest one.`)
  }
  const target = candidates.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))[0]

  console.log(`Bot: ${chatbot.name}`)
  console.log(`Directory document: ${target.title || target.id} (${target.content?.length || 0} → ${newContent.length} chars)`)

  const { chunkCount } = await reprocessDocumentContent(target.id, newContent)
  console.log(`OK — re-chunked and re-embedded into ${chunkCount} chunks.`)
}

main()
  .catch((e) => { console.error('Fatal:', e instanceof Error ? e.message : e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
