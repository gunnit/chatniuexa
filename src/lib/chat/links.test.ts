import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMemberLinkIndex,
  checkMemberLink,
  createLinkRewrite,
  createMarkdownLinkStream,
  normalizeMemberName,
  rewriteMarkdownLinks,
  stripModelTrackingParams,
  urlKey,
  type LinkRewrite,
} from './links'

const M = (id: string) => `https://italchamber.org.sg/membership-directory/corporate/${id}#page-member-ajax`

// Excerpt in the live directory format (ids and names from italchamber_directory.md).
const DIRECTORY = `# ItalChamber Singapore — Corporate Members Directory
## Sector: FURNITURE AND HOME APPLIANCES (3 partners)
[Sector: FURNITURE AND HOME APPLIANCES] **[M LUXURY Asia Pte Ltd](${M('1432775')})** — M LUXURY ASIA (MLA) is the operator of the first Barovier&Toso monobrand showroom.
[Sector: FURNITURE AND HOME APPLIANCES] **[SILAT SRL – Il Giardino di Legno](${M('2473514')})** — teak garden furniture.
[Sector: FURNITURE AND HOME APPLIANCES] [Also relevant to: LUXURY RETAIL] **[GIORGETTI Asia Pte Ltd](${M('232421')})** — Made in Italy design.
## Sector: LEGAL AND ACCOUNTING FIRMS (1 partners)
[Sector: LEGAL AND ACCOUNTING FIRMS] **[Belluzzo & Partners Pte Ltd](${M('247536')})** — tax and legal services.
## Sector: FOOD AND BEVERAGE (2 partners)
[Sector: FOOD AND BEVERAGE] **[Alifood s.r.l.](${M('990482')})** — traditional Italian food products.
[Sector: FOOD AND BEVERAGE] **[MAIOLIKA SG Pte.Ltd.](${M('2489687')})** — artisanal Italian specialties.
See also [the events page](https://www.italchamber.org.sg/events).`

const index = buildMemberLinkIndex(DIRECTORY)!

test('stripModelTrackingParams removes only the web-search tracking parameter', () => {
  const cases: Array<[string, string]> = [
    ['https://www.italchamber.org.sg/become-member?utm_source=openai', 'https://www.italchamber.org.sg/become-member'],
    ['https://a.sg/p?utm_source=openai#top', 'https://a.sg/p#top'],
    ['https://a.sg/p?utm_source=openai&page=2', 'https://a.sg/p?page=2'],
    ['https://www.italchamber.org.sg/recruitment?page=1&utm_source=openai', 'https://www.italchamber.org.sg/recruitment?page=1'],
    ['https://a.sg/p?a=1&utm_source=openai&b=2', 'https://a.sg/p?a=1&b=2'],
    ['https://a.sg/p?utm_source=chatgpt.com', 'https://a.sg/p'],
    ['https://a.sg/p?utm_source=newsletter', 'https://a.sg/p?utm_source=newsletter'],
    ['https://a.sg/p?utm_source=openai.example', 'https://a.sg/p?utm_source=openai.example'],
    ['https://a.sg/plain', 'https://a.sg/plain'],
  ]
  for (const [input, expected] of cases) assert.equal(stripModelTrackingParams(input), expected, input)
})

test('default rewrite cleans tracking params inside links and leaves everything else alone', () => {
  const rw = createLinkRewrite(null)
  const text =
    'Fees: SGD 880 ([italchamber.org.sg](https://www.italchamber.org.sg/become-member?utm_source=openai)). ' +
    'Prices [approx] vary; see [the guide](https://x.sg/a_(b)) or [title](https://x.sg "t"). Bare https://x.sg/?utm_source=openai stays.'
  assert.equal(
    rewriteMarkdownLinks(text, rw),
    'Fees: SGD 880 ([italchamber.org.sg](https://www.italchamber.org.sg/become-member)). ' +
      'Prices [approx] vary; see [the guide](https://x.sg/a_(b)) or [title](https://x.sg "t"). Bare https://x.sg/?utm_source=openai stays.',
  )
})

test('nested brackets, images and unfinished links survive', () => {
  const rw = createLinkRewrite(null)
  assert.equal(rewriteMarkdownLinks('[[1]](https://a.sg/?utm_source=openai)', rw), '[[1]](https://a.sg/)')
  assert.equal(rewriteMarkdownLinks('![logo](https://a.sg/l.png?utm_source=openai)', rw), '![logo](https://a.sg/l.png)')
  assert.equal(rewriteMarkdownLinks('ends with [half](https://a.sg/x', rw), 'ends with [half](https://a.sg/x')
  assert.equal(rewriteMarkdownLinks('ends with [', rw), 'ends with [')
  assert.equal(rewriteMarkdownLinks('a [b\nc](https://a.sg)', rw), 'a [b\nc](https://a.sg)')
  assert.equal(rewriteMarkdownLinks('[]() and [x]()', rw), '[]() and [x]()')
})

test('streaming gives the same output as rewriting the whole text, for every split', () => {
  const calls: string[] = []
  const rw: LinkRewrite = (t, u) => {
    calls.push(t)
    return `<${t}|${stripModelTrackingParams(u)}>`
  }
  const text =
    'Hi [A](https://a.sg/1?utm_source=openai) and **[B & C](https://b.sg/(x))** — [not a link] [D](https://d.sg) end [E'
  const whole = rewriteMarkdownLinks(text, rw)
  assert.equal(whole, 'Hi <A|https://a.sg/1> and **<B & C|https://b.sg/(x)>** — [not a link] <D|https://d.sg> end [E')
  for (let size = 1; size <= text.length; size++) {
    const s = createMarkdownLinkStream(rw)
    let out = ''
    for (let i = 0; i < text.length; i += size) out += s.push(text.slice(i, i + size))
    out += s.flush()
    assert.equal(out, whole, `chunk size ${size}`)
  }
})

test('streaming holds back only while a link may still be open', () => {
  const s = createMarkdownLinkStream(createLinkRewrite(null))
  assert.equal(s.push('Plain text, '), 'Plain text, ')
  assert.equal(s.push('see [the ev'), 'see ')
  assert.equal(s.push('ents page](https://www.italchamber.org.sg/events?utm_source=open'), '')
  assert.equal(s.push('ai) now'), '[the events page](https://www.italchamber.org.sg/events) now')
  assert.equal(s.flush(), '')
})

test('a "[" with no link after it is released once it cannot be one', () => {
  const s = createMarkdownLinkStream(createLinkRewrite(null))
  assert.equal(s.push('Sector [AUTOMOTIVE] has'), 'Sector [AUTOMOTIVE] has')
  const long = '[' + 'x'.repeat(400)
  assert.equal(s.push(long), long)
})

test('member index reads only directory member entries', () => {
  assert.equal(index.urls.size, 6)
  assert.deepEqual(index.prefixes, ['italchamber.org.sg/membership-directory/corporate/'])
  assert.equal(buildMemberLinkIndex('no directory here [x](https://a.sg)'), null)
  assert.equal(urlKey('https://www.ItalChamber.org.sg/membership-directory/corporate/247536/#x'), 'italchamber.org.sg/membership-directory/corporate/247536')
  assert.equal(urlKey('mailto:singapore@italchamber.org.sg'), null)
})

test('normalizeMemberName ignores case, punctuation and legal suffixes', () => {
  assert.equal(normalizeMemberName('Belluzzo & Partners Pte Ltd'), 'belluzzo & partners')
  assert.equal(normalizeMemberName('SILAT SRL - IL GIARDINO DI LEGNO'), normalizeMemberName('SILAT SRL – Il Giardino di Legno'))
  assert.equal(normalizeMemberName('MAIOLIKA SG Pte.Ltd.'), 'maiolika sg')
  assert.equal(normalizeMemberName('Alifood s.r.l.'), 'alifood')
})

test('checkMemberLink classifies member links', () => {
  assert.deepEqual(checkMemberLink(index, 'Belluzzo & Partners Pte Ltd', M('247536')), { kind: 'valid', url: M('247536') })
  // www, no hash, tracking param: still the same member page → canonical url
  assert.deepEqual(checkMemberLink(index, 'ICCS member profile', 'https://www.italchamber.org.sg/membership-directory/corporate/247536'), { kind: 'valid', url: M('247536') })
  // Unknown id, known name → repaired
  assert.deepEqual(checkMemberLink(index, 'M LUXURY Asia Pte Ltd', M('270')), { kind: 'repaired', url: M('1432775') })
  // Valid id of ANOTHER member under a member's exact name → repaired to the named member
  assert.deepEqual(checkMemberLink(index, 'Alifood s.r.l.', M('2489687')), { kind: 'repaired', url: M('990482') })
  // Unknown id, unknown name → invalid
  assert.deepEqual(checkMemberLink(index, 'Some Company', M('999')), { kind: 'invalid' })
  // Other pages of the site are not member links
  assert.deepEqual(checkMemberLink(index, 'events', 'https://www.italchamber.org.sg/events'), { kind: 'not-member' })
  assert.deepEqual(checkMemberLink(index, 'directory', 'https://italchamber.org.sg/membership-directory/corporate'), { kind: 'not-member' })
  assert.deepEqual(checkMemberLink(index, 'x', 'https://othersite.sg/membership-directory/corporate/1'), { kind: 'not-member' })
})

test('ambiguous member names are never used for repairs', () => {
  const dup = buildMemberLinkIndex(
    `[Sector: A] **[Twin Co Pte Ltd](${M('1')})** — a\n[Sector: B] **[Twin Co](${M('2')})** — b\n[Sector: C] **[Other Srl](${M('4')})** — c`,
  )!
  assert.equal(dup.names.get(normalizeMemberName('Twin Co')), null)
  assert.deepEqual(checkMemberLink(dup, 'Twin Co', M('3')), { kind: 'invalid' })
  assert.deepEqual(checkMemberLink(dup, 'Twin Co', M('2')), { kind: 'valid', url: M('2') })
})

test('one odd directory entry cannot turn the rest of a site into member links', () => {
  const odd = buildMemberLinkIndex(
    DIRECTORY +
      '\n[Sector: X] **[Odd Member](https://www.italchamber.org.sg/odd-member)** — slug page' +
      '\n[Sector: X] **[Acme Pte Ltd](https://acme.com/en/)** — own website' +
      '\n[Sector: X] **[Numbered](https://acme.com/products/123)** — a lone numeric page',
  )!
  assert.deepEqual(odd.prefixes, ['italchamber.org.sg/membership-directory/corporate/'])
  assert.deepEqual(checkMemberLink(odd, 'membership fees', 'https://www.italchamber.org.sg/become-member'), { kind: 'not-member' })
  assert.deepEqual(checkMemberLink(odd, 'Acme', 'https://acme.com/en/contact'), { kind: 'not-member' })
  assert.deepEqual(checkMemberLink(odd, 'a product', 'https://acme.com/products/456'), { kind: 'not-member' })
  // Fewer than 3 entries sharing a member-page pattern → no guard at all
  assert.equal(buildMemberLinkIndex(`[Sector: A] **[One](${M('1')})** — a\n[Sector: B] **[Two](${M('2')})** — b`), null)
})

test('a 300-character link text closes the same way streamed or whole', () => {
  const rw: LinkRewrite = (t, u) => `<${t.length}|${u}>`
  const text = `[${'x'.repeat(300)}](https://a.sg/?utm_source=openai) tail`
  const whole = rewriteMarkdownLinks(text, rw)
  assert.equal(whole, '<300|https://a.sg/?utm_source=openai> tail')
  const s = createMarkdownLinkStream(rw)
  const split = 301 // the chunk ends right before the closing "]"
  assert.equal(s.push(text.slice(0, split)) + s.push(text.slice(split)) + s.flush(), whole)
  const over = `[${'x'.repeat(302)}](https://a.sg)`
  assert.equal(rewriteMarkdownLinks(over, rw), over, 'longer link texts are left alone')
})

test('the broken links from the 2026-11-13 audit answer are repaired', () => {
  const seen: string[] = []
  const rw = createLinkRewrite(index, (i) => seen.push(`${i.action}:${i.text}`))
  // Verbatim shape of the Italian answer that linked two members to empty pages.
  const answer =
    '- [SILAT SRL - IL GIARDINO DI LEGNO](https://italchamber.org.sg/membership-directory/corporate/275#page-member-ajax) — mobili da giardino.\n' +
    '- [M LUXURY Asia Pte Ltd](https://italchamber.org.sg/membership-directory/corporate/270#page-member-ajax) — Barovier&Toso.\n' +
    '- [GIORGETTI Asia Pte Ltd](https://italchamber.org.sg/membership-directory/corporate/232421#page-member-ajax) — Meda.\n' +
    '- **[Unknown Srl](https://italchamber.org.sg/membership-directory/corporate/12#page-member-ajax)** — ?\n' +
    'Fonte: ([italchamber.org.sg](https://www.italchamber.org.sg/business-services?utm_source=openai))'
  assert.equal(
    rewriteMarkdownLinks(answer, rw),
    `- [SILAT SRL - IL GIARDINO DI LEGNO](${M('2473514')}) — mobili da giardino.\n` +
      `- [M LUXURY Asia Pte Ltd](${M('1432775')}) — Barovier&Toso.\n` +
      `- [GIORGETTI Asia Pte Ltd](${M('232421')}) — Meda.\n` +
      '- **Unknown Srl** — ?\n' +
      'Fonte: ([italchamber.org.sg](https://www.italchamber.org.sg/business-services))',
  )
  assert.deepEqual(seen, ['repaired:SILAT SRL - IL GIARDINO DI LEGNO', 'repaired:M LUXURY Asia Pte Ltd', 'unlinked:Unknown Srl'])
})
