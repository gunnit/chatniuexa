import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chronologicalHistory, HISTORY_LOAD_LIMIT, recentMessagesInclude } from './history'
import { failureNotice, looksItalian, truncationNotice } from './notices'
import { cleanSuggestionList } from './suggestion-list'

test('history loads the NEWEST messages and hands them over oldest first', () => {
  assert.deepEqual(recentMessagesInclude.messages.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }])
  assert.equal(recentMessagesInclude.messages.take, HISTORY_LOAD_LIMIT)
  const newestFirst = [
    { role: 'ASSISTANT', content: 'a3' },
    { role: 'USER', content: 'q3' },
    { role: 'ASSISTANT', content: 'a2' },
    { role: 'USER', content: 'q2' },
  ]
  assert.deepEqual(chronologicalHistory(newestFirst), [
    { role: 'user', content: 'q2' },
    { role: 'assistant', content: 'a2' },
    { role: 'user', content: 'q3' },
    { role: 'assistant', content: 'a3' },
  ])
  assert.deepEqual(chronologicalHistory([]), [])
})

test('looksItalian tells the simulated visitors apart', () => {
  const italian = [
    "buongiorno, ho un'azienda di arredamento in Brianza e stiamo valutando di aprire a Singapore. da dove parto?",
    'ok grazie. e quanto costa diventare socio della camera?',
    'ciao! sono uno studente di economia in bocconi, la camera prende stagisti? come mi candido',
    'quali sono i soci del settore auto?',
  ]
  const english = [
    'hi im looking for italian food suppliers in sg, mainly cheese and cured meats for a hotel restaurant. any members who do that?',
    'the gala sounds nice. can non members go? how much are tickets',
    'Good afternoon. Who is the current President of the Chamber?',
    'need an italian speaking lawyer in singapore for a contract dispute',
  ]
  for (const t of italian) assert.equal(looksItalian(t), true, t)
  for (const t of english) assert.equal(looksItalian(t), false, t)
})

test('notices follow the visitor language', () => {
  assert.match(truncationNotice('quali eventi ci sono?'), /continua/)
  assert.match(truncationNotice('what events are on?'), /continue/)
  assert.match(failureNotice('come mi iscrivo alla camera?'), /^Mi dispiace/)
  assert.match(failureNotice('how do I join?'), /^Sorry/)
})

test('cleanSuggestionList keeps up to three distinct, sane strings', () => {
  assert.deepEqual(cleanSuggestionList(['a?', ' a? ', 'b?', 7, '', 'c?', 'd?']), ['a?', 'b?', 'c?'])
  assert.deepEqual(cleanSuggestionList(['x'.repeat(121), 'ok?']), ['ok?'])
  assert.deepEqual(cleanSuggestionList('nope'), [])
  assert.deepEqual(cleanSuggestionList(undefined), [])
})
