import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTagCorrections, ICCS_TAG_CORRECTIONS, type TagCorrection } from './directory-tags'

const M = (id: string) => `https://italchamber.org.sg/membership-directory/corporate/${id}#page-member-ajax`

const DIRECTORY = [
  '## Sector: BUSINESS SERVICES (2 partners)',
  `[Sector: BUSINESS SERVICES] [Also relevant to: LEGAL AND ACCOUNTING FIRMS] **[Consea Singapore Management Consulting Pte Ltd](${M('1712540')})** — Executive search.`,
  `[Sector: BUSINESS SERVICES] [Also relevant to: FURNITURE AND HOME APPLIANCES; MANUFACTURING] **[New Value Gate Pte Ltd](${M('1')})** — Lean programmes.`,
  '## Sector: LUXURY RETAIL (1 partner)',
  `[Sector: LUXURY RETAIL] **[Marcolin Singapore Pte Ltd](${M('1697590')})** — Eyewear.`,
  `[Sector: LEGAL AND ACCOUNTING FIRMS] [Also relevant to: BUSINESS SERVICES] **[Belluzzo & Partners Pte Ltd](${M('247536')})** — Tax.`,
].join('\n')

test('removes only the listed sectors, drops an empty tag, leaves every other line untouched', () => {
  const { text, changes, notFound } = applyTagCorrections(DIRECTORY, ICCS_TAG_CORRECTIONS)
  const lines = text.split('\n')
  assert.equal(lines[1], `[Sector: BUSINESS SERVICES] **[Consea Singapore Management Consulting Pte Ltd](${M('1712540')})** — Executive search.`)
  assert.equal(lines[2], `[Sector: BUSINESS SERVICES] [Also relevant to: MANUFACTURING] **[New Value Gate Pte Ltd](${M('1')})** — Lean programmes.`)
  // Marcolin carries no furniture tag here: nothing to do, line unchanged.
  assert.equal(lines[4], DIRECTORY.split('\n')[4])
  assert.equal(lines[5], DIRECTORY.split('\n')[5])
  assert.equal(lines[0], DIRECTORY.split('\n')[0])
  assert.deepEqual(
    changes.map((c) => [c.member, c.removed]),
    [
      ['Consea Singapore Management Consulting Pte Ltd', ['LEGAL AND ACCOUNTING FIRMS']],
      ['New Value Gate Pte Ltd', ['FURNITURE AND HOME APPLIANCES']],
      ['Marcolin Singapore Pte Ltd', []],
    ],
  )
  assert.deepEqual(notFound, [])
})

test('idempotent, and reports members that are not in the directory', () => {
  const once = applyTagCorrections(DIRECTORY, ICCS_TAG_CORRECTIONS).text
  const twice = applyTagCorrections(once, ICCS_TAG_CORRECTIONS)
  assert.equal(twice.text, once)
  assert.ok(twice.changes.every((c) => c.removed.length === 0))

  const missing: TagCorrection[] = [{ member: 'Gone Member Pte Ltd', remove: ['FINANCE'], reason: 'test' }]
  assert.deepEqual(applyTagCorrections(DIRECTORY, missing).notFound, ['Gone Member Pte Ltd'])
})

test('matching ignores case, punctuation and legal suffixes of the member name', () => {
  const line = `[Sector: BUSINESS SERVICES] [Also relevant to: legal and accounting firms] **[CONSEA Singapore Management Consulting Pte. Ltd.](${M('1712540')})** — x`
  const { text } = applyTagCorrections(line, ICCS_TAG_CORRECTIONS)
  assert.equal(text, `[Sector: BUSINESS SERVICES] **[CONSEA Singapore Management Consulting Pte. Ltd.](${M('1712540')})** — x`)
})
