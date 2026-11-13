/**
 * Drives the real answer generators and the follow-up suggestions call against a
 * fake OpenAI HTTP layer (the SDK's fetch), so link clean-up, cut-off notices and
 * request parameters are checked on the code path production uses.
 */
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import type { MemberLinkIndex } from './links'

process.env.OPENAI_API_KEY ||= 'test-key'

type Handler = (url: string, body: Record<string, unknown>) => Response
let handler: Handler = () => new Response('no handler', { status: 500 })
const requests: Array<{ url: string; body: Record<string, unknown> }> = []

// The OpenAI client captures `fetch` when it is first built, so install one
// stable fake before anything constructs it and swap the handler per test.
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  requests.push({ url, body })
  return handler(url, body)
}) as typeof fetch

const M = (id: string) => `https://italchamber.org.sg/membership-directory/corporate/${id}#page-member-ajax`

// Loaded after the fake fetch is in place (dynamic imports: the repo's TS runs as CommonJS).
let generateStreamingChatResponse: typeof import('./rag').generateStreamingChatResponse
let generateChatResponse: typeof import('./rag').generateChatResponse
let CHAT_MAX_COMPLETION_TOKENS: number
let generateStreamingChatResponseWithTools: typeof import('./responses').generateStreamingChatResponseWithTools
let generateChatResponseWithTools: typeof import('./responses').generateChatResponseWithTools
let generateFollowUpSuggestions: typeof import('./suggestions').generateFollowUpSuggestions
let SUGGESTIONS_MODEL: string
let createLinkRewrite: typeof import('./links').createLinkRewrite
let index: MemberLinkIndex | null

before(async () => {
  ;({ generateStreamingChatResponse, generateChatResponse, CHAT_MAX_COMPLETION_TOKENS } = await import('./rag'))
  ;({ generateStreamingChatResponseWithTools, generateChatResponseWithTools } = await import('./responses'))
  ;({ generateFollowUpSuggestions, SUGGESTIONS_MODEL } = await import('./suggestions'))
  const links = await import('./links')
  createLinkRewrite = links.createLinkRewrite
  index = links.buildMemberLinkIndex(`[Sector: X] **[Belluzzo & Partners Pte Ltd](${M('247536')})** — tax`)
})

const sse = (events: Array<{ event?: string; data: unknown }>) =>
  new Response(
    events.map((e) => `${e.event ? `event: ${e.event}\n` : ''}data: ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}\n\n`).join(''),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )

const chunk = (content: string | null, finish: string | null = null) => ({
  id: 'c1',
  object: 'chat.completion.chunk',
  created: 1,
  model: 'gpt-6-luna',
  choices: [{ index: 0, delta: content === null ? {} : { content }, finish_reason: finish }],
})

async function readSse(stream: ReadableStream<Uint8Array>) {
  const text = await new Response(stream).text()
  const events = text.split('\n\n').filter(Boolean).map((b) => b.replace(/^data: /, ''))
  const done = events.at(-1) === '[DONE]'
  const content = events.filter((e) => e !== '[DONE]').map((e) => JSON.parse(e).content as string).join('')
  return { content, done, events }
}


test('chat completions stream: links repaired across chunk boundaries, usage reported', async () => {
  handler = () =>
    sse([
      { data: chunk('See **[Belluzzo & Partners Pte Ltd](https://italchamber.org.sg/membership-dir') },
      { data: chunk('ectory/corporate/24753#page-member-ajax)** and [fees](https://www.italchamber.org.sg/become-member?utm_') },
      { data: chunk('source=openai).') },
      { data: chunk(null, 'stop') },
      { data: { id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'gpt-6-luna', choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } } },
      { data: '[DONE]' },
    ])
  let usage: unknown = null
  const stream = await generateStreamingChatResponse('ctx', 'contact for belluzzo?', [], {
    systemPrompt: 'You are a test bot. Use markdown.',
    model: 'gpt-6-luna',
    temperature: 0.4,
    onUsage: (u) => (usage = u),
    rewriteLink: createLinkRewrite(index),
  })
  const { content, done } = await readSse(stream)
  assert.equal(content, `See **[Belluzzo & Partners Pte Ltd](${M('247536')})** and [fees](https://www.italchamber.org.sg/become-member).`)
  assert.ok(done)
  assert.deepEqual(usage, { inputTokens: 100, outputTokens: 20 })
  const body = requests.at(-1)!.body
  assert.equal(body.max_completion_tokens, CHAT_MAX_COMPLETION_TOKENS)
  assert.equal(body.reasoning_effort, 'none')
  assert.equal(body.temperature, 0.4)
})

test('chat completions stream: a cut-off answer ends with a notice in the visitor language', async () => {
  handler = () => sse([{ data: chunk('Ecco i soci del settore:\n- [Fer') }, { data: chunk(null, 'length') }, { data: '[DONE]' }])
  const it = await readSse(await generateStreamingChatResponse('ctx', 'quali sono i soci del settore auto?', [], { model: 'gpt-6-luna' }))
  assert.equal(it.content, 'Ecco i soci del settore:\n- [Fer\n\n_(Risposta interrotta: scrivi «continua» per il resto.)_')

  handler = () => sse([{ data: chunk('Here are the members:') }, { data: chunk(null, 'length') }, { data: '[DONE]' }])
  const en = await readSse(await generateStreamingChatResponse('ctx', 'which automotive members are there?', [], { model: 'gpt-6-luna' }))
  assert.equal(en.content, 'Here are the members:\n\n_(Answer cut short: type “continue” for the rest.)_')
})

test('chat completions stream: no text at all becomes an apology, not an empty bubble', async () => {
  handler = () => sse([{ data: chunk(null, 'stop') }, { data: '[DONE]' }])
  const { content, done } = await readSse(await generateStreamingChatResponse('ctx', 'hello?', [], { model: 'gpt-6-luna' }))
  assert.equal(content, "Sorry, I couldn't complete that answer. Please try again in a moment.")
  assert.ok(done)
})

test('responses stream (web search bots): incomplete answer gets a notice, tracking params stripped', async () => {
  const delta = (d: string) => ({ event: 'response.output_text.delta', data: { type: 'response.output_text.delta', delta: d, item_id: 'm', output_index: 0, content_index: 0, sequence_number: 1 } })
  handler = () =>
    sse([
      delta('Tra le aziende socie: [Gucci](https://www.italchamber.org.sg/x?utm_source=openai) e [Ermen'),
      { event: 'response.incomplete', data: { type: 'response.incomplete', sequence_number: 9, response: { id: 'r', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 50, output_tokens: 4096, total_tokens: 4146 } } } },
    ])
  let usage: unknown = null
  const stream = await generateStreamingChatResponseWithTools('ctx', 'ma secondo te è meglio fare uno stage alla camera?', [], {
    model: 'gpt-6-luna',
    tools: [{ type: 'web_search' }],
    onUsage: (u) => (usage = u),
  })
  const { content, done } = await readSse(stream)
  assert.equal(
    content,
    'Tra le aziende socie: [Gucci](https://www.italchamber.org.sg/x) e [Ermen\n\n_(Risposta interrotta: scrivi «continua» per il resto.)_',
  )
  assert.ok(done)
  assert.deepEqual(usage, { inputTokens: 50, outputTokens: 4096 })
  assert.equal(requests.at(-1)!.body.max_output_tokens, CHAT_MAX_COMPLETION_TOKENS)
})

test('responses stream: an upstream error event is surfaced as a cut-off notice', async () => {
  handler = () =>
    sse([
      { event: 'response.output_text.delta', data: { type: 'response.output_text.delta', delta: 'Partial answer', item_id: 'm', output_index: 0, content_index: 0, sequence_number: 1 } },
      { event: 'error', data: { type: 'error', code: 'server_error', message: 'boom', param: null, sequence_number: 2 } },
    ])
  const { content } = await readSse(await generateStreamingChatResponseWithTools('ctx', 'what events are coming up?', [], { model: 'gpt-6-luna', tools: [{ type: 'web_search' }] }))
  assert.equal(content, 'Partial answer\n\n_(Answer cut short: type “continue” for the rest.)_')
})

test('non-streaming tool answer (WhatsApp, /api/chat): same link clean-up and cut-off notice', async () => {
  handler = () =>
    new Response(
      JSON.stringify({
        id: 'r',
        object: 'response',
        created_at: 1,
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        model: 'gpt-6-luna',
        output: [
          {
            type: 'message',
            id: 'm',
            role: 'assistant',
            status: 'incomplete',
            content: [{ type: 'output_text', annotations: [], text: 'Contact [Belluzzo](https://italchamber.org.sg/membership-directory/corporate/1#page-member-ajax) or [ICCS](https://www.italchamber.org.sg/contact?utm_source=openai)' }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 4096, total_tokens: 4106 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  const result = await generateChatResponseWithTools('ctx', 'belluzzo contact?', [], {
    model: 'gpt-6-luna',
    tools: [{ type: 'web_search' }],
    rewriteLink: createLinkRewrite(index),
  })
  // "Belluzzo" alone is not a member's full name and id 1 is unknown → un-linked
  assert.equal(result.content, 'Contact Belluzzo or [ICCS](https://www.italchamber.org.sg/contact)\n\n_(Answer cut short: type “continue” for the rest.)_')
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 4096 })
  assert.equal(typeof generateChatResponse, 'function')
})

test('follow-up suggestions: request shape and parsing', async () => {
  handler = () =>
    new Response(
      JSON.stringify({
        id: 'x',
        object: 'chat.completion',
        created: 1,
        model: SUGGESTIONS_MODEL,
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"suggestions":["How can I contact Alifood?","1. Which members sell wine?","How can I contact Alifood?","What events are coming up?"]}' } }],
        usage: { prompt_tokens: 300, completion_tokens: 30, total_tokens: 330 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  const result = await generateFollowUpSuggestions({
    botName: 'Ask ICCS',
    botDescription: 'Italian Chamber of Commerce Singapore assistant',
    userMessage: 'italian food suppliers?',
    answer: 'Alifood and MAIOLIKA SG are members that supply Italian food.',
    sourceTitles: ['Directory', 'Directory'],
  })
  assert.deepEqual(result, {
    suggestions: ['How can I contact Alifood?', 'Which members sell wine?', 'What events are coming up?'],
    usage: { inputTokens: 300, outputTokens: 30 },
    model: SUGGESTIONS_MODEL,
  })
  const body = requests.at(-1)!.body as { model: string; response_format: { type: string; json_schema: { strict: boolean } }; max_completion_tokens: number; reasoning_effort?: string; messages: Array<{ content: string }> }
  assert.equal(body.model, SUGGESTIONS_MODEL)
  assert.equal(body.response_format.type, 'json_schema')
  assert.equal(body.response_format.json_schema.strict, true)
  assert.equal(body.max_completion_tokens, 400)
  assert.equal(body.reasoning_effort, 'none')
  assert.match(body.messages[1].content, /Knowledge it used for this answer: Directory\n/)
})

test('follow-up suggestions: an API failure or empty answer yields null, never a throw', async () => {
  handler = () => new Response(JSON.stringify({ error: { message: 'bad', type: 'invalid_request_error' } }), { status: 400, headers: { 'content-type': 'application/json' } })
  assert.equal(await generateFollowUpSuggestions({ botName: 'B', userMessage: 'q', answer: 'a' }), null)
  const before = requests.length
  assert.equal(await generateFollowUpSuggestions({ botName: 'B', userMessage: 'q', answer: '   ' }), null)
  assert.equal(requests.length, before, 'no request for an empty answer')
})
