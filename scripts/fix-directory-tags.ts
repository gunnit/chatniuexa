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
 * Options:
 *   --share=<token>     the bot (default lOLj8UA, the ICCS bot)
 *   --document=<id>     which document, when the bot has more than one in the directory format
 *   --force             re-embed even when no tag changes
 *
 * While re-embedding (about a minute) the directory is not served, as during the
 * weekly refresh. Idempotent: once applied, a second run changes nothing; if a
 * previous run failed half-way (directory not COMPLETE or without chunks), a
 * second run re-embeds it.
 */
import { prisma } from '../src/lib/db'
import { reprocessDocumentContent } from '../src/lib/documents/processor'
import { applyTagCorrections, ICCS_TAG_CORRECTIONS } from '../src/lib/documents/directory-tags'

const KNOWN = /^--(dry-run|force|share=.+|document=.+)$/

async function main() {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => !KNOWN.test(a))
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(' ')} (use --dry-run, --force, --share=, --document=)`)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const option = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const share = option('share') || 'lOLj8UA'
  const documentId = option('document')

  const chatbot = await prisma.chatbot.findUnique({ where: { shareToken: share }, select: { tenantId: true, name: true } })
  if (!chatbot) throw new Error(`No chatbot with shareToken="${share}"`)
  const candidates = await prisma.document.findMany({
    where: { content: { contains: '[Sector:' }, dataSource: { tenantId: chatbot.tenantId } },
    select: { id: true, content: true, dataSource: { select: { name: true, status: true } }, _count: { select: { chunks: true } } },
  })
  if (candidates.length === 0) throw new Error('No directory document found for this bot.')
  // Every directory-format document is injected into answers, so fixing one copy while
  // another keeps the wrong tags would not help: make the operator pick explicitly.
  if (candidates.length > 1 && !documentId) {
    for (const c of candidates) {
      console.log(`  ${c.id}  ${(c.content || '').length} chars  ${c._count.chunks} chunks  ${c.dataSource.status}  "${c.dataSource.name}"`)
    }
    throw new Error(`${candidates.length} directory documents found: run again with --document=<id> for each one to fix.`)
  }
  const doc = documentId ? candidates.find((c) => c.id === documentId) : candidates[0]
  if (!doc) throw new Error(`Document ${documentId} is not a directory document of this bot.`)
  const before = doc.content || ''
  console.log(
    `Bot "${chatbot.name}", directory document ${doc.id} (${before.length} chars, ${doc._count.chunks} chunks, ${doc.dataSource.status})`,
  )

  const { text, changes, notFound } = applyTagCorrections(before, ICCS_TAG_CORRECTIONS)
  for (const c of changes) {
    console.log(`- ${c.member} (${c.reason})`)
    console.log(`    also relevant to, before: ${c.before.join('; ') || '(none)'}`)
    console.log(`    after:                    ${c.after.join('; ') || '(none)'}`)
    console.log(c.removed.length ? `    removed: ${c.removed.join('; ')}` : '    nothing to change')
  }
  for (const name of notFound) console.log(`- ${name}: not in the directory, skipped`)

  const changed = changes.filter((c) => c.removed.length > 0).length
  const notServed = doc.dataSource.status !== 'COMPLETE' || doc._count.chunks === 0
  if (changed === 0 && !notServed && !force) {
    console.log('OK — nothing to change.')
    return
  }
  const why = changed
    ? `${changed} member(s) corrected`
    : notServed
      ? `directory not served (${doc.dataSource.status}, ${doc._count.chunks} chunks): re-embedding it`
      : 'forced re-embedding'
  if (dryRun) {
    console.log(`[dry-run] would write: ${why}. Nothing written.`)
    return
  }
  console.log(`Re-chunking and re-embedding the directory (${why})…`)
  const { chunkCount } = await reprocessDocumentContent(doc.id, text)
  console.log(`OK — ${why}; ${chunkCount} chunks re-embedded.`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
