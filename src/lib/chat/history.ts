/**
 * Conversation history loading, shared by every chat entry point (web stream,
 * web JSON, WhatsApp).
 *
 * The routes used to load `orderBy: createdAt asc, take: 20`, which returns the
 * FIRST 20 messages of a conversation: once a chat passed 10 exchanges the bot
 * kept seeing the opening turns and never the latest ones. That hit WhatsApp
 * hardest, where one phone number is one conversation forever. Loading newest
 * first and reversing gives the model the most recent turns.
 */

/** Messages loaded per request. The generators send the last 10 of them to the model. */
export const HISTORY_LOAD_LIMIT = 20

/** Prisma `include` for a conversation's most recent messages, NEWEST first. */
export const recentMessagesInclude = {
  messages: {
    // id breaks ties between messages saved in the same millisecond (cuids grow over time)
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: HISTORY_LOAD_LIMIT,
  },
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Turn messages loaded newest-first (see `recentMessagesInclude`) into the
 * oldest-first history the generators expect.
 */
export function chronologicalHistory(
  newestFirst: ReadonlyArray<{ role: string; content: string }>,
): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (let i = newestFirst.length - 1; i >= 0; i--) {
    const m = newestFirst[i]
    turns.push({ role: m.role.toLowerCase() === 'assistant' ? 'assistant' : 'user', content: m.content })
  }
  return turns
}
