/**
 * Remove wrong cross-sector tags from the ICCS member directory document
 * (list and reasons: ICCS_TAG_CORRECTIONS in src/lib/documents/directory-tags.ts),
 * then re-chunk and re-embed it so the bot reads the corrected tags.
 *
 * The weekly refresh (refresh-iccs-weekly.ts) reads the live document and keeps
 * its tags, so a correction made here stays.
 *
 * Usage (on Render, where DATABASE_URL and OPENAI_API_KEY are set):
 *   npx tsx scripts/fix-directory-tags.ts --dry-run   # show what would change, write nothing
 *   npx tsx scripts/fix-directory-tags.ts             # apply (about a minute to re-embed)
 * Options: --share=<token> (default lOLj8UA, the ICCS bot)
 *
 * Idempotent: once applied, a second run finds nothing to change and writes nothing.
 */
import { prisma } from '../src/lib/db'
import { reprocessDocumentContent } from '../src/lib/documents/processor'
import { applyTagCorrections, ICCS_TAG_CORRECTIONS } from '../src/lib/documents/directory-tags'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const share = args.find((a) => a.startsWith('--share='))?.slice('--share='.length) || 'lOLj8UA'

  const chatbot = await prisma.chatbot.findUnique({ where: { shareToken: share }, select: { tenantId: true, name: true } })
  if (!chatbot) throw new Error(`No chatbot with shareToken="${share}"`)
  // Same document the weekly refresh edits: the tenant's longest document in the directory format.
  const candidates = await prisma.document.findMany({
    where: { content: { contains: '[Sector:' }, dataSource: { tenantId: chatbot.tenantId } },
    select: { id: true, content: true },
  })
  if (candidates.length === 0) throw new Error('No directory document found for this bot.')
  const doc = candidates.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))[0]
  const before = doc.content || ''
  console.log(`Bot "${chatbot.name}", directory document ${doc.id} (${before.length} chars)`)

  const { text, changes, notFound } = applyTagCorrections(before, ICCS_TAG_CORRECTIONS)
  for (const c of changes) {
    console.log(`- ${c.member} (${c.reason})`)
    console.log(`    also relevant to, before: ${c.before.join('; ') || '(none)'}`)
    console.log(`    after:                    ${c.after.join('; ') || '(none)'}`)
    console.log(c.removed.length ? `    removed: ${c.removed.join('; ')}` : '    nothing to change')
  }
  for (const name of notFound) console.log(`- ${name}: not in the directory, skipped`)

  const changed = changes.filter((c) => c.removed.length > 0).length
  if (changed === 0) {
    console.log('OK — nothing to change.')
    return
  }
  if (dryRun) {
    console.log(`[dry-run] ${changed} member(s) would change; nothing written.`)
    return
  }
  console.log('Re-chunking and re-embedding the directory…')
  const { chunkCount } = await reprocessDocumentContent(doc.id, text)
  console.log(`OK — ${changed} member(s) corrected; ${chunkCount} chunks re-embedded.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
