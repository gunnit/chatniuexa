/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { PostFrontmatterSchema, SUPPORTED_LOCALES } from '../src/lib/posts'

const POSTS_ROOT = path.join(process.cwd(), 'content', 'posts')

type LintIssue = { file: string; message: string }

function checkBody(body: string, filepath: string): LintIssue[] {
  const issues: LintIssue[] = []

  const statMatches = body.match(/<Stat\b/g) ?? []
  if (statMatches.length < 1) {
    issues.push({ file: filepath, message: 'Missing <Stat> — add at least 1 (Princeton GEO: +33% citation lift).' })
  }

  const quoteMatches = body.match(/<Quote\b[^>]*\bsource=/g) ?? []
  if (quoteMatches.length < 1) {
    issues.push({ file: filepath, message: 'Missing <Quote source="…"> — add at least 1 sourced quote (Princeton GEO: +41%).' })
  }

  const sourceCiteMatches = body.match(/<SourceCite\b/g) ?? []
  if (sourceCiteMatches.length < 3) {
    issues.push({
      file: filepath,
      message: `Found ${sourceCiteMatches.length} <SourceCite> — need at least 3 (Princeton GEO: +28%).`,
    })
  }

  // Strip leading frontmatter block + headings before the first paragraph.
  const lines = body.split('\n')
  const firstParagraphLines: string[] = []
  let started = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!started) {
      if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('<')) continue
      started = true
    }
    if (started) {
      if (trimmed === '') break
      firstParagraphLines.push(trimmed)
    }
  }
  const firstParaWords = firstParagraphLines.join(' ').split(/\s+/).filter(Boolean).length
  if (firstParaWords > 60) {
    issues.push({
      file: filepath,
      message: `First paragraph has ${firstParaWords} words — keep it ≤60 (inverted pyramid for AI extraction).`,
    })
  }

  // Find first H2 position — it should appear within the first ~300 words.
  let wordCount = 0
  let foundH2 = false
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      foundH2 = true
      break
    }
    wordCount += line.split(/\s+/).filter(Boolean).length
    if (wordCount > 300) break
  }
  if (!foundH2) {
    issues.push({
      file: filepath,
      message: 'No H2 found within first 300 words — add structural headings.',
    })
  }

  return issues
}

function checkSiblingExists(slug: string, siblingLocale: 'en' | 'it'): boolean {
  const sibling = path.join(POSTS_ROOT, siblingLocale, `${slug}.mdx`)
  return fs.existsSync(sibling)
}

function lintFile(filepath: string): LintIssue[] {
  const issues: LintIssue[] = []
  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)

  const parsed = PostFrontmatterSchema.safeParse(data)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ file: filepath, message: `Frontmatter: ${issue.path.join('.')} — ${issue.message}` })
    }
    return issues
  }

  const fm = parsed.data
  const expectedFile = path.join(POSTS_ROOT, fm.locale, `${fm.slug}.mdx`)
  if (path.resolve(expectedFile) !== path.resolve(filepath)) {
    issues.push({
      file: filepath,
      message: `Frontmatter slug "${fm.slug}" / locale "${fm.locale}" does not match filename.`,
    })
  }

  const siblingLocale = fm.locale === 'en' ? 'it' : 'en'
  if (!checkSiblingExists(fm.hreflangSlug, siblingLocale)) {
    issues.push({
      file: filepath,
      message: `hreflangSlug "${fm.hreflangSlug}" not found at content/posts/${siblingLocale}/${fm.hreflangSlug}.mdx`,
    })
  }

  issues.push(...checkBody(content, filepath))
  return issues
}

function main() {
  const allIssues: LintIssue[] = []
  for (const locale of SUPPORTED_LOCALES) {
    const dir = path.join(POSTS_ROOT, locale)
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))
    for (const file of files) {
      const filepath = path.join(dir, file)
      allIssues.push(...lintFile(filepath))
    }
  }

  if (allIssues.length === 0) {
    console.log('✓ Article lint passed.')
    process.exit(0)
  }

  console.error(`✗ Article lint found ${allIssues.length} issue(s):\n`)
  for (const issue of allIssues) {
    const rel = path.relative(process.cwd(), issue.file)
    console.error(`  • ${rel}`)
    console.error(`    ${issue.message}`)
  }
  process.exit(1)
}

main()
