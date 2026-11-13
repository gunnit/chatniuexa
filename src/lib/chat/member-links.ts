/**
 * Loads (and caches) a tenant's member-directory link index for the link guard
 * in `links.ts`. Tenants without a directory document get `null`, which leaves
 * only the tracking-parameter clean-up active.
 */
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { buildMemberLinkIndex, createLinkRewrite, type LinkRewrite, type MemberLinkIndex } from '@/lib/chat/links'

// The directory is refreshed weekly; a few minutes of staleness is harmless.
const TTL_MS = 10 * 60 * 1000
const ERROR_TTL_MS = 60 * 1000

const cache = new Map<string, { index: MemberLinkIndex | null; expires: number }>()

export async function getMemberLinkIndex(tenantId: string): Promise<MemberLinkIndex | null> {
  const now = Date.now()
  const hit = cache.get(tenantId)
  if (hit && hit.expires > now) return hit.index
  try {
    // Same selection as getDirectoryChunks: complete sources whose document is a
    // `[Sector: …]` member directory. Whole documents, so no entry is split.
    const rows = await prisma.$queryRaw<Array<{ content: string }>>`
      SELECT d.content
      FROM documents d
      JOIN data_sources ds ON d."dataSourceId" = ds.id
      WHERE ds."tenantId" = ${tenantId}
        AND ds.status = 'COMPLETE'
        AND d.content ILIKE '%[Sector:%'
    `
    const index = rows.length ? buildMemberLinkIndex(rows.map((r) => r.content).join('\n')) : null
    cache.set(tenantId, { index, expires: now + TTL_MS })
    return index
  } catch (error) {
    logger.error('Failed to load member link index', { tenantId, error: String(error) })
    cache.set(tenantId, { index: null, expires: now + ERROR_TTL_MS })
    return null
  }
}

/** The link rewrite for a tenant's answers; logs every repaired or removed member link. */
export async function getLinkRewrite(tenantId: string, chatbotId: string): Promise<LinkRewrite> {
  const index = await getMemberLinkIndex(tenantId)
  return createLinkRewrite(index, (info) => logger.warn('Answer contained an unknown member link', { chatbotId, ...info }))
}
