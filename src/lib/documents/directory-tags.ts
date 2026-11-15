/**
 * Corrections to the cross-sector tags of a member directory document
 * (`[Sector: X] [Also relevant to: A; B] **[Name](url)** — description`).
 *
 * The `[Also relevant to: …]` tags were assigned by a model once and are kept by
 * the weekly refresh, so a wrong tag stays until it is removed here. A wrong tag
 * puts a member into every list for that sector: the completeness block makes
 * the bot list it, and the completeness check appends it when it is left out.
 *
 * Pure module: scripts/fix-directory-tags.ts applies it to the live document.
 */
import { normalizeMemberName } from '@/lib/chat/links'

export interface TagCorrection {
  /** Member name as written in the directory (case, punctuation and legal suffix are ignored). */
  member: string
  /** Sectors to remove from the member's "Also relevant to" tag. */
  remove: string[]
  /** Why: shown in the script output and kept with the list below. */
  reason: string
}

/** Wrong tags found in the live ICCS bot tests of 13-14 Nov 2026. */
export const ICCS_TAG_CORRECTIONS: TagCorrection[] = [
  {
    member: 'Consea Singapore Management Consulting Pte Ltd',
    remove: ['LEGAL AND ACCOUNTING FIRMS'],
    reason: 'executive search and HR consulting; was listed for tax and company compliance',
  },
  {
    member: 'Marcolin Singapore Pte Ltd',
    remove: ['FURNITURE AND HOME APPLIANCES'],
    reason: 'eyewear; was listed for Italian furniture importers',
  },
  {
    member: 'New Value Gate Pte Ltd',
    remove: ['FURNITURE AND HOME APPLIANCES'],
    reason: 'lean / performance consulting; was listed for Italian furniture importers',
  },
]

const MEMBER_LINE = /^(\[Sector:\s*[^\]]+?\]\s*)(?:\[Also relevant to:\s*([^\]]*?)\]\s*)?(\*\*\[([^\]]+?)\]\(.*)$/

export interface TagChange {
  member: string
  /** The correction's reason. */
  reason: string
  /** Sectors actually removed (empty when the member did not carry them: nothing to do). */
  removed: string[]
  /** "Also relevant to" sectors before and after. */
  before: string[]
  after: string[]
}

/**
 * Remove the listed sectors from the members' "Also relevant to" tags. A tag
 * left empty is dropped. Idempotent: a second run changes nothing. Members not
 * found in the text are returned in `notFound`.
 */
export function applyTagCorrections(
  text: string,
  corrections: TagCorrection[],
): { text: string; changes: TagChange[]; notFound: string[] } {
  const byName = new Map(corrections.map((c) => [normalizeMemberName(c.member), c]))
  const found = new Set<string>()
  const changes: TagChange[] = []
  const lines = text.split('\n').map((line) => {
    const m = line.match(MEMBER_LINE)
    if (!m) return line
    const [, sectorPart, alsoList = '', rest, name] = m
    const key = normalizeMemberName(name)
    const correction = byName.get(key)
    if (!correction) return line
    found.add(key)
    const before = alsoList.split(';').map((s) => s.trim()).filter(Boolean)
    const drop = new Set(correction.remove.map((s) => s.trim().toUpperCase()))
    const after = before.filter((s) => !drop.has(s.toUpperCase()))
    const removed = before.filter((s) => drop.has(s.toUpperCase()))
    changes.push({ member: name, reason: correction.reason, removed, before, after })
    if (removed.length === 0) return line
    const tag = after.length ? `[Also relevant to: ${after.join('; ')}] ` : ''
    return `${sectorPart.trimEnd()} ${tag}${rest}`
  })
  const notFound = corrections.filter((c) => !found.has(normalizeMemberName(c.member))).map((c) => c.member)
  return { text: lines.join('\n'), changes, notFound }
}
