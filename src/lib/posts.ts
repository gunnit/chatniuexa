import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import { z } from 'zod'

export const SUPPORTED_LOCALES = ['en', 'it'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

const POSTS_ROOT = path.join(process.cwd(), 'content', 'posts')
const AUTHORS_ROOT = path.join(process.cwd(), 'content', 'authors')

export const ArticleType = z.enum(['listicle', 'how-to', 'comparison', 'qa'])
export type ArticleType = z.infer<typeof ArticleType>

export const PostFrontmatterSchema = z.object({
  title: z.string().min(10).max(120),
  description: z.string().min(120).max(180),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case'),
  locale: z.enum(['en', 'it']),
  hreflangSlug: z.string().regex(/^[a-z0-9-]+$/),
  type: ArticleType,
  publishedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'publishedAt must be ISO date',
  }),
  updatedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'updatedAt must be ISO date',
  }),
  author: z.string(),
  tags: z.array(z.string()).min(1).max(8),
  heroImage: z.string().nullable().optional(),
})

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>

export type Post = PostFrontmatter & {
  filepath: string
  raw: string
  body: string
  readingTimeMinutes: number
}

export const AuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  bio: z.object({ en: z.string(), it: z.string() }),
  avatar: z.string(),
  sameAs: z.array(z.string().url()),
  url: z.object({ en: z.string(), it: z.string() }),
})

export type Author = z.infer<typeof AuthorSchema>

const authorCache = new Map<string, Author>()

export function getAuthor(id: string): Author {
  const cached = authorCache.get(id)
  if (cached) return cached
  const filepath = path.join(AUTHORS_ROOT, `${id}.json`)
  if (!fs.existsSync(filepath)) {
    throw new Error(`Author not found: ${id}`)
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  const parsed = AuthorSchema.parse(data)
  authorCache.set(id, parsed)
  return parsed
}

function localeDir(locale: Locale): string {
  return path.join(POSTS_ROOT, locale)
}

function readPostFile(filepath: string): Post {
  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)
  const frontmatter = PostFrontmatterSchema.parse(data)
  const stats = readingTime(content)
  return {
    ...frontmatter,
    filepath,
    raw,
    body: content,
    readingTimeMinutes: Math.max(1, Math.round(stats.minutes)),
  }
}

export function getAllPosts(locale: Locale): Post[] {
  const dir = localeDir(locale)
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))
  return files
    .map((file) => readPostFile(path.join(dir, file)))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}

export function getPostBySlug(locale: Locale, slug: string): Post | null {
  const filepath = path.join(localeDir(locale), `${slug}.mdx`)
  if (!fs.existsSync(filepath)) return null
  return readPostFile(filepath)
}

export function getAllSlugs(locale: Locale): string[] {
  const dir = localeDir(locale)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''))
}

/**
 * Localized blog index path. EN has no locale prefix per next-intl `as-needed`.
 */
export function blogIndexPath(locale: Locale): string {
  return locale === 'en' ? '/blog' : `/${locale}/blog`
}

export function articlePath(locale: Locale, slug: string): string {
  return locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`
}
