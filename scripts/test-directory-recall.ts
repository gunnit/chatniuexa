/**
 * Directory recall regression test for the ICCS member-directory bot.
 *
 * Runs a battery of category / sector / service queries end-to-end through the
 * real RAG pipeline (retrieval + LLM) and asserts that every member that should
 * appear actually appears in the answer — including CROSS-SECTOR members whose
 * `[Sector:]` label differs from the queried category (the Hawksford-under-
 * "accounting" class of bug).
 *
 * It reads the live system prompt + model from the chatbot row, so run it AFTER
 * deploying the updated prompt (`npx tsx scripts/update-iccs-prompt.ts`).
 *
 * Requires DATABASE_URL and OPENAI_API_KEY in the environment (same as the app).
 *
 * Usage:
 *   npx tsx scripts/test-directory-recall.ts [shareToken]
 *   # default shareToken = lOLj8UA
 */
import { prisma } from '../src/lib/db'
import { generateChatResponse } from '../src/lib/chat/rag'

interface Case {
  query: string
  /** Distinctive tokens that MUST appear in the answer (case-insensitive). */
  mustInclude: string[]
  note?: string
}

// Distinctive name tokens are used (not full legal names) so trivial wording
// differences don't cause false failures.
const CASES: Case[] = [
  {
    query: 'accounting firms',
    note: 'cross-sector: BUSINESS SERVICES firms that do accounting must appear',
    mustInclude: ['Hawksford', 'Crowe', 'Dezan Shira', 'Diacron', 'Fidinam', 'Belluzzo'],
  },
  {
    query: 'who does tax and corporate compliance?',
    note: 'service phrasing without the word "accounting"',
    mustInclude: ['Hawksford', 'Diacron', 'Dezan Shira'],
  },
  {
    query: 'consulting and advisory companies',
    note: 'within BUSINESS SERVICES — full list, no truncation',
    mustInclude: ['Accenture', 'Bios Management', 'Business Engineers', 'Consea'],
  },
  {
    query: 'list all automotive members',
    note: 'within-sector completeness (all 5)',
    mustInclude: ['Ferrari', 'Fiamma', 'Pagani', 'Piaggio', 'Pirelli'],
  },
  {
    query: 'companies that organise events or exhibitions',
    note: 'cross-sector: IEG Asia (BUSINESS SERVICES) + events sector',
    mustInclude: ['IEG Asia'],
  },
  {
    query: 'shipping and logistics partners',
    mustInclude: ['shipping'],
    // sector exists; at minimum the answer should be about shipping/freight
  },
]

async function main() {
  const shareToken = process.argv[2] || 'lOLj8UA'

  const chatbot = await prisma.chatbot.findUnique({
    where: { shareToken },
    select: { id: true, name: true, tenantId: true, systemPrompt: true, model: true },
  })
  if (!chatbot) {
    console.error(`No chatbot found with shareToken="${shareToken}"`)
    process.exit(1)
  }

  console.log(`Bot: ${chatbot.name} (tenant=${chatbot.tenantId}, model=${chatbot.model})`)
  console.log(`Prompt length: ${chatbot.systemPrompt?.length ?? 0} chars\n`)

  let failures = 0

  for (const c of CASES) {
    const res = await generateChatResponse(chatbot.tenantId, c.query, [], {
      systemPrompt: chatbot.systemPrompt || undefined,
      model: chatbot.model,
    })
    const content = res.content.toLowerCase()
    const missing = c.mustInclude.filter((m) => !content.includes(m.toLowerCase()))

    if (missing.length === 0) {
      console.log(`✅ "${c.query}"  (${c.mustInclude.length}/${c.mustInclude.length})`)
    } else {
      failures++
      console.log(`❌ "${c.query}"  MISSING: ${missing.join(', ')}`)
      if (c.note) console.log(`   note: ${c.note}`)
      console.log(`   sources: ${res.sources.length}, confidence: ${res.confidence}`)
    }
  }

  console.log('')
  if (failures > 0) {
    console.error(`FAILED: ${failures}/${CASES.length} cases missing expected members.`)
    process.exit(1)
  }
  console.log(`PASSED: all ${CASES.length} recall cases include the expected members.`)
}

main()
  .catch((e) => {
    console.error('Fatal:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
