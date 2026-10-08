import { LIMITS, type ContributionType } from './constants'
import { cms, run, sql } from './db'
import { isUuid } from './destinations'
import { track } from './metrics'
import { listPublished, type Card, type GuideLink } from './queries'
import { cleanLine } from './text'
import type { Page } from './types'

export type SearchInput = {
  q?: unknown
  type?: ContributionType | 'guide' | null
  destinationId?: string | null
  style?: string | null
  /** Approved in the last N days. */
  recentDays?: number | null
  /** Activities overlapping this period. */
  from?: Date | null
  to?: Date | null
  page?: number
}

export type SearchResult = Page<Card> & { query: string; guides: GuideLink[] }

/**
 * Search approved community posts with PostgreSQL full-text search, and editorial guides by title.
 *
 * Only published content is ever in the search column: it is rebuilt from approved content when a
 * moderator approves, and emptied when a post is removed. The matching ids are then loaded again
 * through the normal public query, which re-checks that each one is still published. A post hidden
 * a second ago can therefore not appear, even if its row still matched.
 *
 * Order is by relevance, then newest, then id, so the same search always gives the same pages.
 * The words typed are never written to analytics or logs: only "a search happened" is counted.
 */
export async function search(input: SearchInput): Promise<SearchResult> {
  const payload = await cms()
  const query = cleanLine(input.q, 120)
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const type = input.type && input.type !== 'guide' ? input.type : undefined
  const empty: SearchResult = { items: [], page, totalPages: 0, total: 0, query, guides: [] }

  let guides: GuideLink[] = []
  if (query.length >= 2 && (!input.type || input.type === 'guide') && page === 1) {
    const found = await payload.find({
      collection: 'articles',
      where: { or: [{ title: { like: query } }, { excerpt: { like: query } }] },
      sort: '-firstPublishedAt', limit: 5, depth: 0, draft: false, overrideAccess: false, select: { title: true, slug: true, excerpt: true },
    })
    guides = found.docs.map((a) => ({ title: a.title, path: `/stories/${a.slug}`, excerpt: a.excerpt }))
  }
  if (input.type === 'guide') return { ...empty, guides }

  const filters = {
    type,
    destinationId: input.destinationId && isUuid(input.destinationId) ? input.destinationId : null,
    style: input.style || null,
    from: type === 'activity' ? input.from ?? null : null,
    to: type === 'activity' ? input.to ?? null : null,
    // A dated search looks at any event in that period, past or future. Otherwise activities mean upcoming ones.
    when: type === 'activity' && (input.from || input.to) ? null : undefined,
  }

  if (query.length < 2) {
    // Filters without words: a plain filtered list.
    if (!type && !filters.destinationId && !filters.style) return { ...empty, guides }
    const listed = await listPublished({ ...filters, page })
    return { ...listed, query, guides }
  }

  const recent = input.recentDays && input.recentDays > 0 ? sql`AND "published_at" >= now() - make_interval(days => ${Math.min(Math.floor(input.recentDays), 3650)}::int)` : sql``
  const typeFilter = type ? sql`AND "type" = ${type}::"enum_contributions_type"` : sql``
  const matches = await run(
    payload,
    sql`SELECT "id" FROM "contributions", websearch_to_tsquery('english', ${query}) AS q
        WHERE "state" = 'published' AND "search_vector" @@ q ${typeFilter} ${recent}
        ORDER BY ts_rank("search_vector", q) DESC, "published_at" DESC NULLS LAST, "id"
        LIMIT ${LIMITS.searchCandidateCap}`,
  )
  const ranked = matches.rows.map((r) => String(r.id))
  if (!ranked.length) return { ...empty, guides }

  // Apply the remaining filters and the visibility re-check through the public query, then keep the relevance order.
  const eligible = await listPublished({ ...filters, when: type === 'activity' ? filters.when : null, ids: ranked, page: 1, pageSize: 50 })
  let all = eligible.items
  for (let p = 2; p <= eligible.totalPages; p++) all = all.concat((await listPublished({ ...filters, when: type === 'activity' ? filters.when : null, ids: ranked, page: p, pageSize: 50 })).items)
  const order = new Map(ranked.map((id, i) => [id, i]))
  all.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  const pageSize = LIMITS.pageSize
  const total = all.length
  if (page === 1) await track('community_search', type ?? 'all')
  return { items: all.slice((page - 1) * pageSize, page * pageSize), page, totalPages: Math.ceil(total / pageSize), total, query, guides }
}
