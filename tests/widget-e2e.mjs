#!/usr/bin/env node
/**
 * Browser test for public/widget.js against a local fake API (no database, no
 * OpenAI, no real website): follow-up chips, the composer being released on
 * [DONE], late message ids, reactions, the session surviving a page reload,
 * "New conversation" (also mid-answer) and the non-streaming fallback.
 *
 *   npm run test:widget            (needs a Chromium for Playwright)
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const widgetJs = fs.readFileSync(path.join(root, 'public/widget.js'))
const BOT = 'bot-e2e'

const requests = [] // { path, body }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = http.createServer(async (req, res) => {
  let raw = ''
  for await (const c of req) raw += c
  const body = raw ? JSON.parse(raw) : null
  requests.push({ path: req.url, body })
  const url = new URL(req.url, 'http://x')

  if (url.pathname === '/host.html') {
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end(`<!doctype html><html><body><h1>Host site</h1><script src="/widget.js" data-chatbot-id="${BOT}"></script></body></html>`)
  }
  if (url.pathname === '/widget.js') {
    res.writeHead(200, { 'content-type': 'application/javascript' })
    return res.end(widgetJs)
  }
  if (url.pathname === `/api/widget/${BOT}`) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ chatbot: { id: BOT, name: 'Ask Test', suggestedPrompts: ['Starter question?'], showSources: false, voiceEnabled: false, primaryColor: '#ed1c24' } }))
  }
  if (url.pathname === '/api/chat/reaction') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end('{"ok":true}')
  }
  if (url.pathname === '/api/chat') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ message: { id: 'm-fallback', content: 'Fallback **answer**.', sources: [], confidence: 'high', suggestions: ['Fallback chip one?', 'Fallback chip two?'] } }))
  }
  if (url.pathname === '/api/chat/stream') {
    const msg = body.message
    if (msg.includes('FALLBACK')) {
      res.writeHead(500, { 'content-type': 'application/json' })
      return res.end('{"error":"boom"}')
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const send = (o) => res.write(`data: ${typeof o === 'string' ? o : JSON.stringify(o)}\n\n`)
    const n = requests.filter((r) => r.path === '/api/chat/stream').length
    send({ type: 'metadata', sources: [], confidence: 'high' })
    if (msg.includes('SLOW')) {
      send({ content: 'This answer is ' })
      await sleep(1500)
      send({ content: 'very slow.' })
      send('[DONE]')
      send({ messageId: `m-slow` })
      send({ type: 'suggestions', suggestions: ['Should never show?'] })
      return res.end()
    }
    for (const part of ['Answer ', `number ${n}: `, '**bold** and a [link](https://example.org/x)', '.']) {
      send({ content: part })
      await sleep(40)
    }
    send('[DONE]')
    await sleep(300)
    send({ messageId: `m-${n}` })
    await sleep(900) // suggestions are generated after the answer
    send({ type: 'suggestions', suggestions: [`First chip ${n}?`, `Second chip ${n}?`, `Third chip ${n}?`] })
    return res.end()
  }
  res.writeHead(404)
  res.end()
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const executablePath = process.env.WIDGET_E2E_CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage()
page.on('dialog', (d) => d.accept()) // "Start a new conversation?"
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

const streamBodies = () => requests.filter((r) => r.path === '/api/chat/stream').map((r) => r.body)
const input = page.locator('#input')
const chips = page.locator('.followup')

async function ask(text) {
  await input.fill(text)
  await input.press('Enter')
}

let failed = false
async function step(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (e) {
    failed = true
    console.log(`not ok - ${name}\n  ${String(e.message).split('\n').join('\n  ')}`)
  }
}

try {
  await page.goto(`${base}/host.html`)
  await page.locator('.launcher.ready').click()

  await step('starter prompt shows in the empty state', async () => {
    await page.locator('.prompt-card').filter({ hasText: 'Starter question?' }).waitFor()
  })

  await step('answer renders and the composer is released on [DONE], before the chips arrive', async () => {
    await ask('hello there')
    await page.locator('.bot-bubble strong', { hasText: 'bold' }).waitFor()
    assert.equal(await page.locator('.bot-bubble a[href="https://example.org/x"]').count(), 1)
    assert.equal(await input.isDisabled(), false, 'composer still disabled after [DONE]')
    assert.equal(await chips.count(), 0, 'chips should not be there yet')
  })

  await step('message id attaches the reactions row, then 3 chips appear', async () => {
    await page.locator('.actions').first().waitFor()
    await chips.nth(2).waitFor()
    assert.deepEqual(await chips.allInnerTexts(), ['First chip 1?', 'Second chip 1?', 'Third chip 1?'])
  })

  const firstSession = streamBodies()[0].sessionId
  await step('session id is a widget- id and is saved with the conversation', async () => {
    assert.match(firstSession, /^widget-\d+-[a-z0-9]+$/)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('chataziendale-chat-bot-e2e')))
    assert.equal(stored.sessionId, firstSession)
    assert.deepEqual(stored.messages.at(-1).suggestions, ['First chip 1?', 'Second chip 1?', 'Third chip 1?'])
  })

  await step('thumbs-up sends the saved message id', async () => {
    await page.locator('.action-btn[data-r="up"]').first().click()
    await page.waitForTimeout(200)
    const r = requests.filter((x) => x.path === '/api/chat/reaction').at(-1)
    assert.deepEqual(r.body, { messageId: 'm-1', reaction: 'up', sessionId: firstSession })
  })

  await step('clicking a chip asks it, in the same session, and old chips disappear', async () => {
    await chips.nth(1).click()
    assert.equal(await chips.count(), 0, 'old chips removed when the new turn starts')
    await page.locator('.followup', { hasText: 'First chip 2?' }).waitFor()
    const last = streamBodies().at(-1)
    assert.equal(last.message, 'Second chip 1?')
    assert.equal(last.sessionId, firstSession)
    assert.equal(await chips.count(), 3, 'only the latest answer has chips')
  })

  await step('after a reload (another page of the site) the chat and its session continue', async () => {
    await page.reload()
    await page.locator('.launcher.ready').click()
    await page.locator('.msg.user', { hasText: 'hello there' }).waitFor()
    await page.locator('.followup', { hasText: 'First chip 2?' }).waitFor()
    await ask('one more question')
    await page.locator('.followup', { hasText: 'First chip 3?' }).waitFor()
    assert.equal(streamBodies().at(-1).sessionId, firstSession)
  })

  await step('"New conversation" starts a new session', async () => {
    await page.locator('#btn-new').click()
    await page.locator('.prompt-card').first().waitFor()
    await ask('fresh start')
    await page.locator('.followup', { hasText: 'First chip 4?' }).waitFor()
    const s = streamBodies().at(-1).sessionId
    assert.notEqual(s, firstSession)
    assert.match(s, /^widget-/)
  })

  await step('"New conversation" mid-answer frees the composer and drops the old answer', async () => {
    await ask('SLOW please')
    await page.locator('.bot-bubble', { hasText: 'This answer is' }).waitFor()
    await page.locator('#btn-new').click()
    await page.locator('.prompt-card').first().waitFor()
    assert.equal(await input.isDisabled(), false)
    await page.waitForTimeout(2000) // the old stream finishes in the background
    assert.equal(await page.locator('.msg').count(), 0, 'nothing from the old answer was drawn')
    assert.equal(await chips.count(), 0)
  })

  await step('non-streaming fallback still shows its chips', async () => {
    await ask('FALLBACK please')
    await page.locator('.followup', { hasText: 'Fallback chip two?' }).waitFor()
    assert.equal(await page.locator('.bot-bubble strong', { hasText: 'answer' }).count(), 1)
  })

  await step('no page errors', async () => {
    assert.deepEqual(pageErrors, [])
  })
} finally {
  await browser.close()
  server.close()
}
process.exit(failed ? 1 : 0)
