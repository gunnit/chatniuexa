import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSuggestionsMessages, MAX_SUGGESTION_CHARS, parseSuggestions, sanitizeSuggestion } from './suggestions'

test('parseSuggestions accepts the schema object, a bare array or a fenced block', () => {
  assert.deepEqual(parseSuggestions('{"suggestions":["A one?","B two?"]}'), ['A one?', 'B two?'])
  assert.deepEqual(parseSuggestions('["A one?","B two?"]'), ['A one?', 'B two?'])
  assert.deepEqual(parseSuggestions('```json\n{"suggestions":["A one?"]}\n```'), ['A one?'])
  assert.deepEqual(parseSuggestions('Sure! {"suggestions":["A one?"]} hope it helps'), ['A one?'])
})

test('parseSuggestions returns [] for anything unusable', () => {
  for (const raw of [null, undefined, '', 'not json', '{"suggestions":"x"}', '{"other":[1]}', '42', '[1,2,3]']) {
    assert.deepEqual(parseSuggestions(raw as string), [], String(raw))
  }
})

test('parseSuggestions keeps at most 3 distinct questions and drops a repeat of the visitor question', () => {
  const raw = JSON.stringify({
    suggestions: ['How do I join?', 'how do i join', 'Which events are next?', 'What does membership cost?', 'Who are the F&B members?'],
  })
  assert.deepEqual(parseSuggestions(raw), ['How do I join?', 'Which events are next?', 'What does membership cost?'])
  assert.deepEqual(parseSuggestions(raw, 'How do I JOIN?!'), ['Which events are next?', 'What does membership cost?', 'Who are the F&B members?'])
})

test('sanitizeSuggestion cleans list markers, quotes and markdown; rejects bad lengths', () => {
  assert.equal(sanitizeSuggestion('1. **How do I join?**'), 'How do I join?')
  assert.equal(sanitizeSuggestion('- “Quali eventi ci sono?”'), 'Quali eventi ci sono?')
  assert.equal(sanitizeSuggestion('  Come   mi iscrivo?  '), 'Come mi iscrivo?')
  assert.equal(sanitizeSuggestion('Hi?'), null)
  assert.equal(sanitizeSuggestion('?!?!'), null)
  assert.equal(sanitizeSuggestion('x'.repeat(MAX_SUGGESTION_CHARS + 1)), null)
  assert.equal(sanitizeSuggestion(42), null)
})

test('buildSuggestionsMessages carries scope, sources, recent turns and a clipped answer', () => {
  const messages = buildSuggestionsMessages({
    botName: 'Ask ICCS',
    botDescription: 'Italian Chamber of Commerce Singapore assistant',
    history: [
      { role: 'user', content: 'turn 1' },
      { role: 'assistant', content: 'turn 2' },
      { role: 'user', content: 'turn 3' },
      { role: 'assistant', content: 'turn 4' },
      { role: 'user', content: 'turn 5' },
      { role: 'assistant', content: 'turn 6' },
    ],
    userMessage: 'ok and the gala?',
    answer: 'A'.repeat(5000),
    sourceTitles: ['Events', 'Events', ' Directory ', ''],
  })
  assert.equal(messages.length, 2)
  assert.equal(messages[0].role, 'system')
  const user = String(messages[1].content)
  assert.match(user, /^Assistant: Ask ICCS\nWhat it covers: Italian Chamber/)
  assert.match(user, /Knowledge it used for this answer: Events; Directory\n/)
  assert.ok(!user.includes('turn 2'), 'only the last 4 earlier turns')
  assert.match(user, /Visitor: turn 3\nAssistant: turn 4\nVisitor: turn 5\nAssistant: turn 6\nVisitor: ok and the gala\?/)
  assert.ok(user.endsWith('A'.repeat(3000) + '…'), 'answer clipped to 3000 chars')
})
