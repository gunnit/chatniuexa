import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isEntryPoint, newSessionId, parseSse, PERSONAS, personasForDay, SESSION_PREFIX } from './iccs-sim-chat.mjs'
import { checkTurn, isEmptyMemberPage, loadSessions, profileTemplate } from './iccs-sim-report.mjs'

test('session ids are tagged sim- (excluded from visitor stats) and readable', () => {
  const id = newSessionId('Hotel F&B buyer', new Date('2026-11-13T03:00:00Z'))
  assert.match(id, /^sim-20261113-hotel-f-b-buyer-[a-z0-9]{1,6}$/)
  assert.ok(id.startsWith(SESSION_PREFIX))
  assert.match(newSessionId(''), /^sim-\d{8}-visitor-/)
})

test('the persona rotation covers every persona once a week, two a day, distinct', () => {
  const seen = []
  for (let d = 0; d < 7; d++) {
    const pair = personasForDay(new Date(Date.UTC(2026, 10, 13 + d, 3)))
    assert.notEqual(pair[0], pair[1])
    seen.push(...pair)
  }
  assert.deepEqual([...seen].sort(), [...PERSONAS].sort())
  // same day in any hour → same pair
  assert.deepEqual(personasForDay(new Date('2026-11-13T00:01:00Z')), personasForDay(new Date('2026-11-13T23:59:00Z')))
})

test('parseSse reads the stream the chat endpoint sends, including late events', () => {
  const body = [
    'data: {"type":"metadata","sources":[{"documentTitle":"Directory"}],"confidence":"high"}',
    'data: {"content":"Hello "}',
    'data: {"content":"there"}',
    'data: [DONE]',
    'data: {"messageId":"m1"}',
    'data: {"type":"suggestions","suggestions":["How do I join?"]}',
    'data: not-json',
    '',
  ].join('\n\n')
  const out = parseSse(body)
  assert.equal(out.content, 'Hello there')
  assert.equal(out.done, true)
  assert.equal(out.messageId, 'm1')
  assert.deepEqual(out.suggestions, ['How do I join?'])
  assert.equal(out.metadata.confidence, 'high')
})

const turn = (over = {}) => ({ user: 'what events are coming up?', assistant: 'The Gala is on 27 November.', messageId: 'm', done: true, totalMs: 3000, firstTokenMs: 900, suggestions: ['How do I book?'], ...over })
const codes = (issues) => issues.map((i) => `${i.level}:${i.code}`)

test('a clean turn has no issues', () => {
  assert.deepEqual(checkTurn(turn(), 0, { expectSuggestions: true }), [])
})

test('the audit findings are caught', () => {
  assert.deepEqual(codes(checkTurn(turn({ assistant: 'Fees ([italchamber.org.sg](https://www.italchamber.org.sg/become-member?utm_source=openai)).' }), 0)), [
    'FAIL:tracking-param',
    'WARN:bare-citation',
  ])
  assert.deepEqual(codes(checkTurn(turn({ assistant: 'Buongiorno! Le quote annuali sono SGD 880.', user: 'e quanto costa diventare socio della camera?' }), 1)), ['WARN:regreeting'])
  assert.deepEqual(codes(checkTurn(turn({ assistant: 'Hello! The Gala is on 27 November.' }), 0)), [], 'a greeting in the first reply is fine')
  assert.deepEqual(codes(checkTurn(turn({ assistant: 'Ci sono Gucci e [Ermen', user: 'meglio uno stage alla camera?' }), 0)), ['FAIL:ends-abruptly'])
  assert.deepEqual(codes(checkTurn(turn({ assistant: 'That is not in my knowledge base.' }), 0)), ['WARN:jargon'])
  assert.deepEqual(codes(checkTurn(turn({ totalMs: 52473, firstTokenMs: 9000 }), 0)), ['WARN:slow', 'WARN:slow-first-token'])
  assert.deepEqual(codes(checkTurn(turn({ assistant: '', messageId: null, done: false }), 0)), ['FAIL:empty-answer', 'FAIL:no-done', 'WARN:no-message-id'])
  assert.deepEqual(
    codes(checkTurn(turn({ assistant: 'See [Alfa](https://www.italchamber.org.sg/membership-directory/corporate/232403?x=1).' }), 0)),
    ['WARN:member-link-format'],
  )
  assert.deepEqual(codes(checkTurn(turn({ suggestions: [] }), 0, { expectSuggestions: true })), ['WARN:no-suggestions'])
  assert.deepEqual(codes(checkTurn(turn({ user: 'quali eventi ci sono a dicembre per i soci?', assistant: 'The next events for members are the Gala and a webinar.' }), 0)), ['WARN:language-mismatch'])
})

test('loadSessions groups turns per session from files and directories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-'))
  fs.writeFileSync(path.join(dir, 'sim-a.jsonl'), JSON.stringify(turn({ sessionId: 'sim-a' })) + '\n' + JSON.stringify(turn({ sessionId: 'sim-a', user: 'q2' })) + '\n\nbroken line\n')
  fs.writeFileSync(path.join(dir, 'sim-b.jsonl'), JSON.stringify(turn({ sessionId: 'sim-b' })) + '\n')
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored')
  const sessions = loadSessions([dir])
  assert.deepEqual([...sessions.keys()], ['sim-a', 'sim-b'])
  assert.equal(sessions.get('sim-a').length, 2)
  assert.equal(sessions.get('sim-a')[1].user, 'q2')
})

test('an empty member profile is told apart by comparing with the empty template', () => {
  // The footer phone number contains "0270": a short id must still be matched only as a whole number
  const page = (id, body) => `Membership Directory ${id} Corporate ${body} footer +65 6223 0270 © 2026`
  const template = profileTemplate(page('987654321', ''), '987654321')
  assert.equal(isEmptyMemberPage(page('270', ''), '270', template), true)
  assert.equal(isEmptyMemberPage(page('2026', ''), '2026', template), false, 'an id equal to another number on the page is never reported dead')
  assert.equal(isEmptyMemberPage(page('2473514', 'SILAT SRL – Il Giardino di Legno'), '2473514', template), false)
})

test('the scripts recognise being run directly, also from a path with a space', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim dir '))
  const file = path.join(dir, 'x.mjs')
  fs.writeFileSync(file, '')
  assert.equal(isEntryPoint(pathToFileURL(file).href, file), true)
  assert.equal(isEntryPoint(pathToFileURL(file).href, path.join(dir, 'other.mjs')), false)
  assert.equal(isEntryPoint(pathToFileURL(file).href, undefined), false)
})
