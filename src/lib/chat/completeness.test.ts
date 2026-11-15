/**
 * Member-list completeness check: which answers get the members they left out,
 * and the roster rag.ts builds for it from the directory.
 */
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import type { CompletenessRoster } from './completeness'

process.env.OPENAI_API_KEY ||= 'test-key'

const M = (id: string) => `https://italchamber.org.sg/membership-directory/corporate/${id}#page-member-ajax`
const link = (name: string, id: string) => `[${name}](${M(id)})`

// Dynamic imports: the repo's TS runs as CommonJS (no top-level await).
let completenessAppendix: typeof import('./completeness').completenessAppendix
let missingMembers: typeof import('./completeness').missingMembers
let buildDirectoryRoster: typeof import('./rag').buildDirectoryRoster

before(async () => {
  ;({ completenessAppendix, missingMembers } = await import('./completeness'))
  ;({ buildDirectoryRoster } = await import('./rag'))
})

// The 16 members of the live tax/compliance answers (Nov 2026), with made-up ids.
const NAMES = [
  'Algebra Pte Ltd', 'Asian Tax Advisory Singapore Pte Ltd.', 'Belluzzo & Partners Pte Ltd',
  'Consea Singapore Management Consulting Pte Ltd', 'Crowe Singapore', 'Dentons Rodyk & Davidson LLP',
  'Dezan Shira and Associates Pte Ltd', 'Diacron Business Consulting (Singapore) Pte Ltd', 'dMTV Global Pte Ltd',
  'Fidinam Singapore Pte Ltd', 'GWA – Asia Greatway Pte Ltd', 'Hawksford Singapore Pte Ltd', 'HJM Asia Law & Co LLC',
  'Kelmer Singapore Pte Ltd', 'Monx Team Pte Ltd', 'RCLT Law Corporation',
]
const roster: CompletenessRoster = {
  sector: 'LEGAL AND ACCOUNTING FIRMS',
  members: NAMES.map((name, i) => ({ name, url: M(String(232400 + i)) })),
}
const listOf = (names: string[]) =>
  `These ICCS members offer tax and company-compliance services:\n\n${names
    .map((n) => `- ${link(n, String(232400 + NAMES.indexOf(n)))} — Provides services.`)
    .join('\n')}\n\nFor help choosing a firm, contact us at singapore@italchamber.org.sg.`

test('a list that skipped two firms gets them appended, with their directory links', () => {
  const answer = listOf(NAMES.filter((n) => !n.startsWith('Dentons') && !n.startsWith('dMTV')))
  const { text, added } = completenessAppendix(answer, roster, 'we need help with tax and company compliance, which of your members do that?')
  assert.deepEqual(added.map((m) => m.name), ['Dentons Rodyk & Davidson LLP', 'dMTV Global Pte Ltd'])
  assert.equal(
    text,
    `\n\nAlso in this category:\n\n- [Dentons Rodyk & Davidson LLP](${M('232405')})\n- [dMTV Global Pte Ltd](${M('232408')})`,
  )
})

test('Italian questions get an Italian label', () => {
  const answer = listOf(NAMES.slice(1))
  const { text } = completenessAppendix(answer, roster, 'quali soci si occupano di fiscalità e adempimenti societari?')
  assert.match(text, /^\n\nNella stessa categoria anche:\n\n- \[Algebra Pte Ltd\]/)
})

test('a member named without its link, or in other words, counts as present', () => {
  // "Also in this sector: **Dentons Rodyk & Davidson LLP**" (bold, no link) and a mistyped-case name.
  const linked = NAMES.filter((n) => !/Dentons|dMTV|RCLT/.test(n))
  const answer = `${listOf(linked)}\n\nAlso in this sector: **Dentons Rodyk & Davidson LLP**, and dmtv global.`
  assert.deepEqual(missingMembers(answer, roster).map((m) => m.name), ['RCLT Law Corporation'])
})

test('a member page id is matched whole: /corporate/23241 is not /corporate/232410', () => {
  const r: CompletenessRoster = { sector: 'X', members: [{ name: 'Zeta Pte Ltd', url: M('232410') }] }
  assert.equal(missingMembers(`See [another firm](${M('23241')}).`, r).length, 1)
  assert.equal(missingMembers(`See [the firm](${M('232410')}).`, r).length, 0)
})

test('answers that are not a sector list are left alone', () => {
  const ask = 'which members handle tax?'
  // About half the sector: the model chose a subset on purpose ("Would you like the full list?").
  assert.equal(completenessAppendix(listOf(NAMES.slice(0, 8)), roster, ask).text, '')
  // One firm in a small sector: fewer than 3 named.
  const small: CompletenessRoster = { sector: 'S', members: roster.members.slice(0, 3) }
  assert.equal(completenessAppendix(listOf(NAMES.slice(0, 2)), small, ask).text, '')
  // Complete list, no roster, empty answer.
  assert.equal(completenessAppendix(listOf(NAMES), roster, ask).text, '')
  assert.equal(completenessAppendix(listOf(NAMES.slice(1)), null, ask).text, '')
  assert.equal(completenessAppendix('', roster, ask).text, '')
})

test('a member without a directory link is appended in bold', () => {
  const r: CompletenessRoster = {
    sector: 'S',
    members: [...roster.members.slice(0, 4), { name: 'Unlinked Member Pte Ltd' }],
  }
  const { text } = completenessAppendix(listOf(NAMES.slice(0, 4)), r, 'list all members in this sector')
  assert.equal(text, '\n\nAlso in this category:\n\n- **Unlinked Member Pte Ltd**')
})

// A small directory in the live format: synonym lines, then tagged member lines.
const DIRECTORY = [
  'Public directory of 5 corporate member companies.',
  '- tax, accounting, commercialisti → **LEGAL AND ACCOUNTING FIRMS**',
  '- hotels, hospitality → **HOSPITALITY AND TOURISM**',
  `[Sector: LEGAL AND ACCOUNTING FIRMS] **${link('Belluzzo & Partners Pte Ltd', '247536')}** — Tax and legal services.`,
  `[Sector: LEGAL AND ACCOUNTING FIRMS] **${link('Dentons Rodyk & Davidson LLP', '232415')}** — Legal services.`,
  `[Sector: BUSINESS SERVICES] [Also relevant to: LEGAL AND ACCOUNTING FIRMS] **${link('Hawksford Singapore Pte Ltd', '222313')}** — Corporate services and tax compliance.`,
  `[Sector: BUSINESS SERVICES] **${link('Consea Singapore Management Consulting Pte Ltd', '1712540')}** — Executive search.`,
  `[Sector: HOSPITALITY AND TOURISM] **${link('Hotel Example Pte Ltd', '100001')}** — A hotel.`,
].join('\n')

test('roster: a one-sector question gets the directive and the completeness roster with links', () => {
  const { directive, completeness } = buildDirectoryRoster([{ content: DIRECTORY }], 'which members handle tax?')
  assert.match(directive ?? '', /MANDATORY DIRECTORY COMPLETENESS[\s\S]*LEGAL AND ACCOUNTING FIRMS" \(3 members/)
  assert.deepEqual(completeness, {
    sector: 'LEGAL AND ACCOUNTING FIRMS',
    members: [
      { name: 'Belluzzo & Partners Pte Ltd', url: M('247536') },
      { name: 'Dentons Rodyk & Davidson LLP', url: M('232415') },
      { name: 'Hawksford Singapore Pte Ltd', url: M('222313') },
    ],
  })
})

test('roster: two sectors, a member name or a non-directory question get no completeness roster', () => {
  const two = buildDirectoryRoster([{ content: DIRECTORY }], 'which members do accounting for hotels?')
  assert.match(two.directive ?? '', /HOSPITALITY AND TOURISM/)
  assert.equal(two.completeness, null)
  const name = buildDirectoryRoster([{ content: DIRECTORY }], 'Belluzzo')
  assert.match(name.directive ?? '', /The query names a member/)
  assert.equal(name.completeness, null)
  assert.deepEqual(buildDirectoryRoster([{ content: DIRECTORY }], 'what time is the gala dinner?'), { directive: null, completeness: null })
})
