/**
 * Update the ICCS bot's system prompt from prompts/iccs-bot-instructions.md.
 *
 * Extracts the fenced code block from the markdown file and writes it into the
 * `systemPrompt` field of the chatbot identified by the given shareToken.
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

  await prisma.chatbot.update({
    where: { id: chatbot.id },
    data: { systemPrompt: prompt },
  })

  console.log('OK — system prompt updated.')
}

main()
  .catch((e) => {
    console.error('Fatal:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
