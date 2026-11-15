/**
 * Member-list completeness check, applied after the model's answer.
 *
 * For a question that maps to exactly one sector of a member directory (e.g.
 * "which members handle tax?" → LEGAL AND ACCOUNTING FIRMS), the context already
 * carries a MANDATORY DIRECTORY COMPLETENESS block naming every member tagged for
 * that sector. Models still skip an entry now and then in a long list (live ICCS
 * retest, Nov 2026: 3 of 7 answers dropped 1-2 of 16 law and accounting firms).
 * When an answer already lists most of the sector, the members it left out are
 * appended with their directory links, so the list the visitor sees is complete.
 *
 * Pure module: the roster comes from rag.ts, which reads it from the directory.
 */
import { logger } from '@/lib/logger'
import { normalizeMemberName } from '@/lib/chat/links'
import { looksItalian } from '@/lib/chat/notices'

export interface RosterMember {
  name: string
  /** The member's directory page; absent when the directory line has no link. */
  url?: string
}

/** Every member tagged (primary or "Also relevant to") for the one sector a query maps to. */
export interface CompletenessRoster {
  sector: string
  members: RosterMember[]
}

/** Share of the roster an answer must already name before missing members are added. */
export const COMPLETENESS_MIN_SHARE = 0.75
/** ...and never fewer than this many: a short answer about one or two firms is left alone. */
export const COMPLETENESS_MIN_PRESENT = 3

const normalizeText = (s: string) =>
  ` ${s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9&]+/g, ' ').trim()} `

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Path of a member page (`/membership-directory/corporate/232415`), or null. */
function memberPath(url: string | undefined): string | null {
  if (!url) return null
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return path.length > 1 ? path : null
  } catch {
    return null
  }
}

/** Whether the answer names the member: its page link, or its name (legal suffixes ignored). */
function mentions(answer: string, normalizedAnswer: string, member: RosterMember): boolean {
  const path = memberPath(member.url)
  if (path && new RegExp(`${escapeRegExp(path)}(?![\\w-])`, 'i').test(answer)) return true
  const name = normalizeMemberName(member.name)
  return name.length > 0 && normalizedAnswer.includes(` ${name} `)
}

/** Roster members the answer does not name. Exported for tests. */
export function missingMembers(answer: string, roster: CompletenessRoster): RosterMember[] {
  const normalizedAnswer = normalizeText(answer)
  return roster.members.filter((m) => !mentions(answer, normalizedAnswer, m))
}

/**
 * Text to append to a finished answer so a sector list names every member of
 * the sector: '' when the answer is not such a list (it names less than
 * COMPLETENESS_MIN_SHARE of the roster) or already names everyone.
 */
export function completenessAppendix(
  answer: string,
  roster: CompletenessRoster | null | undefined,
  userMessage: string,
): { text: string; added: RosterMember[] } {
  const none = { text: '', added: [] }
  if (!roster || roster.members.length === 0 || !answer.trim()) return none
  const missing = missingMembers(answer, roster)
  const present = roster.members.length - missing.length
  if (missing.length === 0) return none
  if (present < COMPLETENESS_MIN_PRESENT || present < roster.members.length * COMPLETENESS_MIN_SHARE) return none

  const label = looksItalian(userMessage) ? 'Nella stessa categoria anche:' : 'Also in this category:'
  const lines = missing.map((m) => (m.url ? `- [${m.name}](${m.url})` : `- **${m.name}**`))
  const separator = answer.endsWith('\n\n') ? '' : answer.endsWith('\n') ? '\n' : '\n\n'
  // The widget renders a list only as its own block, after a blank line.
  return { text: `${separator}${label}\n\n${lines.join('\n')}`, added: missing }
}

/**
 * What the generators append to a finished (not cut-off) answer: the members a
 * sector list left out, or ''. Logs each completion so it can be monitored.
 */
export function memberListAppendix(
  answer: string,
  roster: CompletenessRoster | null | undefined,
  userMessage: string,
): string {
  const { text, added } = completenessAppendix(answer, roster, userMessage)
  if (text) {
    logger.info('Completed a member list the answer left short', {
      sector: roster?.sector,
      added: added.map((m) => m.name),
      rosterSize: roster?.members.length,
    })
  }
  return text
}
