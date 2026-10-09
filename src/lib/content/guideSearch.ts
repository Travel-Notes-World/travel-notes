import type { Payload, Where } from 'payload'

import type { Article, Destination } from '@/payload-types'

import { run, sql } from '../community/db'

/**
 * Editorial guide search.
 *
 * With words: PostgreSQL full-text search over "search_vector" (title weighted A, deck and excerpt
 * B, body C; see migration 20261009_160847_article_search), ordered by rank, then newest, then id,
 * so pages are stable. Without words: a destination or travel style alone lists matching guides,
 * newest first. Both combine with the destination (including places inside it) and style filters.
 *
 * Only the main "articles" row is searched, which always holds the published version, and the hits
 * are then loaded again with a visitor's permissions, so a draft can never appear.
 */

export const GUIDE_PAGE_SIZE = 20
/** Upper bound on matches considered per search; far above any real result list. */
const MATCH_CAP = 2000

export type GuideHit = {
  title: string
  path: string
  excerpt: string
  destination: { name: string; path: string } | null
  /** The editor-set update date, or the first publication date. */
  date: string
  updated: boolean
}

export type GuideResults = { items: GuideHit[]; total: number; page: number; totalPages: number }

export type GuideQuery = {
  /** The words typed, already cleaned and capped. Fewer than 2 characters means "no words". */
  q: string
  /** The chosen destination and every place inside it. */
  destinationIds?: string[] | null
  style?: string | null
  page?: number
  pageSize?: number
}

const EMPTY: GuideResults = { items: [], total: 0, page: 1, totalPages: 0 }

function toHit(a: Article): GuideHit {
  const d = a.primaryDestination && typeof a.primaryDestination === 'object' ? (a.primaryDestination as Destination) : null
  const first = a.firstPublishedAt ?? a.createdAt
  return {
    title: a.title,
    path: `/stories/${a.slug}`,
    excerpt: a.excerpt,
    destination: d?.path && d._status === 'published' ? { name: d.name, path: d.path } : null,
    date: a.editorialUpdatedAt ?? first,
    updated: Boolean(a.editorialUpdatedAt && a.editorialUpdatedAt !== first),
  }
}

/** Load published articles by id with a visitor's permissions, keeping the given order. */
async function loadInOrder(payload: Payload, ids: string[]): Promise<GuideHit[]> {
  if (!ids.length) return []
  const found = await payload.find({ collection: 'articles', where: { id: { in: ids } }, limit: ids.length, depth: 1, draft: false, overrideAccess: false })
  const byId = new Map(found.docs.map((a) => [a.id, a]))
  return ids.map((id) => byId.get(id)).filter((a): a is Article => Boolean(a)).map(toHit)
}

/** The ranked full-text query. Exported so tests can check its plan uses the GIN index. */
export function rankedGuideSql(q: string, filters: { destinationIds?: string[] | null; style?: string | null }, limit: number, offset: number) {
  const ids = filters.destinationIds?.length ? sql.join(filters.destinationIds.map((id) => sql`${id}::uuid`), sql`, `) : null
  const destination = ids
    ? sql`AND (a."primary_destination_id" IN (${ids}) OR EXISTS (
        SELECT 1 FROM "articles_rels" r WHERE r."parent_id" = a."id" AND r."path" = 'additionalDestinations' AND r."destinations_id" IN (${ids})))`
    : sql``
  const style = filters.style
    ? sql`AND EXISTS (SELECT 1 FROM "articles_travel_styles" s WHERE s."parent_id" = a."id" AND s."value"::text = ${filters.style})`
    : sql``
  return sql`SELECT a."id", count(*) OVER () AS "total"
    FROM "articles" a, websearch_to_tsquery('english', ${q}) AS q
    WHERE a."_status" = 'published' AND a."search_vector" @@ q ${destination} ${style}
    ORDER BY ts_rank(a."search_vector", q) DESC, a."first_published_at" DESC NULLS LAST, a."id"
    LIMIT ${limit} OFFSET ${offset}`
}

export async function searchGuides(payload: Payload, query: GuideQuery): Promise<GuideResults> {
  const pageSize = Math.max(1, Math.min(query.pageSize ?? GUIDE_PAGE_SIZE, 50))
  const page = Math.max(1, Math.floor(query.page ?? 1))
  const offset = (page - 1) * pageSize
  const words = query.q.trim().length >= 2

  if (words) {
    if (offset >= MATCH_CAP) return { ...EMPTY, page }
    const result = await run(payload, rankedGuideSql(query.q, query, pageSize, offset))
    const rows = result.rows as { id: string; total: string | number }[]
    // An empty page past the end still needs the total for the page links.
    const total = rows.length ? Math.min(Number(rows[0].total), MATCH_CAP) : offset ? await countRanked(payload, query) : 0
    return { items: await loadInOrder(payload, rows.map((r) => String(r.id))), total, page, totalPages: Math.ceil(total / pageSize) }
  }

  if (!query.destinationIds?.length && !query.style) return { ...EMPTY, page }
  const where: Where[] = []
  if (query.destinationIds?.length) {
    where.push({ or: [{ primaryDestination: { in: query.destinationIds } }, { additionalDestinations: { in: query.destinationIds } }] })
  }
  if (query.style) where.push({ travelStyles: { in: [query.style] } })
  const found = await payload.find({ collection: 'articles', where: { and: where }, sort: ['-firstPublishedAt', 'id'], page, limit: pageSize, depth: 1, draft: false, overrideAccess: false })
  return { items: found.docs.map(toHit), total: found.totalDocs, page, totalPages: found.totalPages }
}

async function countRanked(payload: Payload, query: GuideQuery): Promise<number> {
  const result = await run(payload, rankedGuideSql(query.q, query, 1, 0))
  const row = result.rows[0] as { total?: string | number } | undefined
  return row ? Math.min(Number(row.total), MATCH_CAP) : 0
}
