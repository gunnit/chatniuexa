/**
 * Markdown link clean-up applied to every answer before it reaches the visitor
 * (streamed and non-streamed alike), so the saved message matches what was shown.
 *
 * 1. Tracking parameters that the web-search tool appends (`?utm_source=openai`)
 *    are removed from link URLs.
 * 2. Member-directory guard: for tenants with a member directory (the
 *    `[Sector: …] **[Name](url)**` format), a link that points into the
 *    directory's member pages but to an id that is NOT in the directory (an
 *    invented or mistyped URL, which opens an empty profile page) is repaired from
 *    the member's name when the name is known, and otherwise un-linked, keeping
 *    the visible text. Valid member links are normalised to the directory's
 *    canonical URL.
 *
 * Pure module (no database): `member-links.ts` loads the directory index.
 */

/** Rewrites one complete markdown link `[text](url)`; returns the replacement markdown. */
export type LinkRewrite = (text: string, url: string) => string

const MAX_LINK_TEXT_CHARS = 300
const MAX_LINK_URL_CHARS = 2048

type LinkMatch = { status: 'link'; text: string; url: string; end: number } | { status: 'none' } | { status: 'incomplete' }

/** Try to read a markdown link starting at s[0] === '['. */
function matchLinkAt(s: string): LinkMatch {
  let depth = 0
  let textEnd = -1
  for (let j = 0; j < s.length; j++) {
    const c = s[j]
    if (c === '\n') return { status: 'none' }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        textEnd = j
        break
      }
    }
    if (j > MAX_LINK_TEXT_CHARS) return { status: 'none' }
  }
  if (textEnd === -1) return s.length > MAX_LINK_TEXT_CHARS ? { status: 'none' } : { status: 'incomplete' }
  if (textEnd + 1 >= s.length) return { status: 'incomplete' }
  if (s[textEnd + 1] !== '(') return { status: 'none' }

  let parens = 0
  for (let k = textEnd + 1; k < s.length; k++) {
    const c = s[k]
    if (c === '(') parens++
    else if (c === ')') {
      parens--
      if (parens === 0) {
        const url = s.slice(textEnd + 2, k)
        if (!url) return { status: 'none' }
        return { status: 'link', text: s.slice(1, textEnd), url, end: k + 1 }
      }
    } else if (c === ' ' || c === '\n' || c === '\t' || c === '\r') {
      return { status: 'none' } // a title or plain prose in parentheses: leave untouched
    }
    if (k - textEnd > MAX_LINK_URL_CHARS) return { status: 'none' }
  }
  return { status: 'incomplete' }
}

/**
 * Streaming link rewriter. Text is passed through as soon as it cannot be part
 * of a link; from a `[` it is held back until the link closes (or proves not to
 * be one), so every link is rewritten whole even when split across deltas.
 */
export function createMarkdownLinkStream(rewrite: LinkRewrite): {
  push: (delta: string) => string
  flush: () => string
} {
  let buf = ''
  const drain = (final: boolean): string => {
    let out = ''
    while (buf) {
      const i = buf.indexOf('[')
      if (i === -1) {
        out += buf
        buf = ''
        break
      }
      out += buf.slice(0, i)
      buf = buf.slice(i)
      const m = matchLinkAt(buf)
      if (m.status === 'link') {
        out += rewrite(m.text, m.url)
        buf = buf.slice(m.end)
      } else if (m.status === 'none' || final) {
        out += '['
        buf = buf.slice(1)
      } else {
        break // incomplete: wait for more text
      }
    }
    return out
  }
  return {
    push: (delta: string) => {
      buf += delta
      return drain(false)
    },
    flush: () => drain(true),
  }
}

/** Rewrite every markdown link in a complete text. */
export function rewriteMarkdownLinks(text: string, rewrite: LinkRewrite): string {
  const stream = createMarkdownLinkStream(rewrite)
  return stream.push(text) + stream.flush()
}

const TRACKING_PARAM = String.raw`utm_source=(?:openai|chatgpt\.com)`
const TRACKING_FIRST = new RegExp(String.raw`\?${TRACKING_PARAM}(?:&|(?=#)|$)`)
const TRACKING_LATER = new RegExp(String.raw`&${TRACKING_PARAM}(?=&|#|$)`, 'g')

/** Remove the tracking parameter the web-search tool adds to cited URLs. */
export function stripModelTrackingParams(url: string): string {
  return url.replace(TRACKING_FIRST, (m) => (m.endsWith('&') ? '?' : '')).replace(TRACKING_LATER, '')
}

// ---------------------------------------------------------------------------
// Member-directory guard
// ---------------------------------------------------------------------------

export interface MemberLinkIndex {
  /** urlKey(member url) → canonical url from the directory */
  urls: Map<string, string>
  /** normalised member name → canonical url, or null when two members share it */
  names: Map<string, string | null>
  /** urlKey prefixes of member pages, e.g. `italchamber.org.sg/membership-directory/corporate/` */
  prefixes: string[]
}

/** host without www + path without trailing slash, lower-cased; null for non-http(s) urls. */
export function urlKey(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase()
  } catch {
    return null
  }
}

const LEGAL_SUFFIX = /\s+(?:pte|ltd|limited|llc|llp|inc|corp|co|spa|s p a|srl|s r l|gmbh|sa|bv|plc|pty)$/

/** Normalise a company name for lookup: case, accents, punctuation and legal suffixes. */
export function normalizeMemberName(name: string): string {
  let s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim()
  while (LEGAL_SUFFIX.test(s)) s = s.replace(LEGAL_SUFFIX, '').trim()
  return s
}

// `[Sector: X] [Also relevant to: A; B] **[Name](url)**` — same member line the RAG roster reads.
const MEMBER_ENTRY = /\[Sector:[^\]]*\]\s*(?:\[Also relevant to:[^\]]*\]\s*)?\*\*\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)\*\*/g

/** Build the member index from directory text; null when the text has no member entries. */
export function buildMemberLinkIndex(directoryText: string): MemberLinkIndex | null {
  const urls = new Map<string, string>()
  const names = new Map<string, string | null>()
  const prefixes = new Set<string>()
  for (const m of directoryText.matchAll(MEMBER_ENTRY)) {
    const name = m[1].trim()
    const url = m[2]
    const key = urlKey(url)
    if (!key) continue
    const slash = key.lastIndexOf('/')
    if (slash <= 0) continue
    prefixes.add(key.slice(0, slash + 1))
    if (!urls.has(key)) urls.set(key, url)
    const n = normalizeMemberName(name)
    if (!n) continue
    if (!names.has(n)) names.set(n, url)
    else if (names.get(n) !== null && urlKey(names.get(n)!) !== key) names.set(n, null) // ambiguous
  }
  if (urls.size === 0) return null
  return { urls, names, prefixes: [...prefixes] }
}

export type MemberLinkVerdict =
  | { kind: 'not-member' }
  | { kind: 'valid'; url: string }
  | { kind: 'repaired'; url: string }
  | { kind: 'invalid' }

/**
 * Classify a link against the member index. A link whose text is exactly a
 * member's name is pointed at that member's page, also when its URL is another
 * member's (valid) page; any other link into the member pages must use a known
 * member URL.
 */
export function checkMemberLink(index: MemberLinkIndex, text: string, url: string): MemberLinkVerdict {
  const key = urlKey(url)
  if (!key || !index.prefixes.some((p) => key.startsWith(p) && key.length > p.length)) return { kind: 'not-member' }
  const canonical = index.urls.get(key)
  const named = index.names.get(normalizeMemberName(text))
  if (named && urlKey(named) !== key) return { kind: 'repaired', url: named }
  if (canonical) return { kind: 'valid', url: canonical }
  return { kind: 'invalid' }
}

/**
 * The rewrite applied to every answer: strip tracking parameters, then (when a
 * member index exists) validate member-page links. `onInvalid` is told about
 * every repaired or removed link (for logging).
 */
export function createLinkRewrite(
  index: MemberLinkIndex | null,
  onInvalid?: (info: { text: string; url: string; action: 'repaired' | 'unlinked' }) => void,
): LinkRewrite {
  return (text, url) => {
    const cleaned = stripModelTrackingParams(url)
    if (!index) return `[${text}](${cleaned})`
    const verdict = checkMemberLink(index, text, cleaned)
    switch (verdict.kind) {
      case 'not-member':
        return `[${text}](${cleaned})`
      case 'valid':
        return `[${text}](${verdict.url})`
      case 'repaired':
        onInvalid?.({ text, url, action: 'repaired' })
        return `[${text}](${verdict.url})`
      case 'invalid':
        onInvalid?.({ text, url, action: 'unlinked' })
        return text
    }
  }
}
