/**
 * Update the ICCS bot's system prompt from prompts/iccs-bot-instructions.md, and
 * switch on its clickable follow-up questions (`followUpSuggestions`).
 *
 * Extracts the fenced code block from the markdown file and writes it into the
 * `systemPrompt` field of the chatbot identified by the given shareToken.
 *
 * Run it AFTER the deploy that adds the followUpSuggestions column has finished
 * (the prompt is saved either way; the switch needs the new column).
 *
 * Usage:
 *   npx tsx scripts/update-iccs-prompt.ts [shareToken] [promptMdPath]
 *
 * Defaults: shareToken=lOLj8UA, promptMdPath=prompts/iccs-bot-instructions.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/lib/db'

async function main() {
  const shareToken = process.argv[2] || 'lOLj8UA'
  const mdPath = process.argv[3] || 'prompts/iccs-bot-instructions.md'

  const absPath = path.isAbsolute(mdPath) ? mdPath : path.join(process.cwd(), mdPath)
  const raw = fs.readFileSync(absPath, 'utf8')

  const fenceMatch = raw.match(/```[\w-]*\n([\s\S]*?)```/)
  if (!fenceMatch) {
    console.error(`No fenced code block found in ${mdPath}`)
    process.exit(1)
  }
  const prompt = fenceMatch[1].trim()

  const chatbot = await prisma.chatbot.findUnique({
    where: { shareToken },
    select: { id: true, name: true, systemPrompt: true },
  })

  if (!chatbot) {
    console.error(`No chatbot found with shareToken="${shareToken}"`)
    process.exit(1)
  }

  console.log(`Chatbot: ${chatbot.name} (id=${chatbot.id})`)
  console.log(`Previous prompt length: ${chatbot.systemPrompt?.length ?? 0} chars`)
  console.log(`New prompt length:      ${prompt.length} chars`)

  // `select` keeps Prisma from reading back every column: on a database without
  // the followUpSuggestions column yet, returning it would fail the whole update.
  await prisma.chatbot.update({
    where: { id: chatbot.id },
    data: { systemPrompt: prompt },
    select: { id: true },
  })

  console.log('OK — system prompt updated.')

  // Separate write so an old database (column not deployed yet) still gets the prompt.
  try {
    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: { followUpSuggestions: true },
      select: { id: true },
    })
    console.log('OK — follow-up suggestions switched on.')
  } catch (e) {
    console.error(
      'Could not switch on follow-up suggestions — has the deploy with migration ' +
        '20261113000000_add_follow_up_suggestions finished? Re-run this script after it has.',
    )
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error('Fatal:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
