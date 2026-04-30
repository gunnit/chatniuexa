import GithubSlugger from 'github-slugger'
import type { Locale } from '@/lib/posts'

type Heading = {
  level: 2 | 3
  text: string
  id: string
}

const LABEL: Record<Locale, string> = {
  en: 'In this article',
  it: 'In questo articolo',
}

export function extractHeadings(body: string): Heading[] {
  const slugger = new GithubSlugger()
  const lines = body.split('\n')
  const headings: Heading[] = []
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length as 2 | 3
    const text = m[2].replace(/[#*_`]/g, '').trim()
    headings.push({ level, text, id: slugger.slug(text) })
  }
  return headings
}

export function TableOfContents({
  headings,
  locale,
}: {
  headings: Heading[]
  locale: Locale
}) {
  if (headings.length === 0) return null

  return (
    <nav
      aria-label={LABEL[locale]}
      className="not-prose my-12 border-l-2 border-[#0F766E]/40 pl-6 py-1"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F766E]">
        {LABEL[locale]}
      </div>
      <ol className="mt-4 space-y-2.5 text-[15px] leading-snug">
        {headings.map((h, i) => (
          <li key={h.id} className={h.level === 3 ? 'pl-5' : ''}>
            {h.level === 2 ? (
              <a
                href={`#${h.id}`}
                className="group flex items-baseline gap-3 text-[#18181B] hover:text-[#0F766E]"
              >
                <span className="font-mono text-[11px] text-[#A1A1AA] tabular-nums group-hover:text-[#0F766E]">
                  {String(headings.filter((x, j) => x.level === 2 && j <= i).length).padStart(2, '0')}
                </span>
                <span className="font-serif text-[16px] tracking-[-0.005em]">{h.text}</span>
              </a>
            ) : (
              <a
                href={`#${h.id}`}
                className="block text-[14px] text-[#52525B] hover:text-[#0F766E]"
              >
                {h.text}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
