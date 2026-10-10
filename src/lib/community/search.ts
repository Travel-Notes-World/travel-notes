import { LIMITS, TRAVEL_STYLES, type ContributionType } from './constants'
import { cms, run, sql } from './db'
import { isUuid, withDescendants } from './destinations'
import { track } from './metrics'
import { GUIDE_PAGE_SIZE, searchGuides, type GuideResults } from '../content/guideSearch'
import { listPublished, type Card } from './queries'
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

/** The longest search text accepted; anything longer is cut, never refused. */
export const SEARCH_QUERY_MAX = 200
/** Guides shown above community posts when searching everything. */
export const GUIDES_ON_EVERYTHING = 5

export type SearchResult = Page<Card> & { query: string; guides: GuideResults; guideError: boolean }

/**
 * Search approved community posts and editorial guides, both with PostgreSQL full-text search.
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
  // Longer text is cut at the last whole word, so a cut never leaves half a word to search for.
  const raw = cleanLine(input.q, SEARCH_QUERY_MAX + 1)
  const query = raw.length <= SEARCH_QUERY_MAX ? raw : /\s/.test(raw) ? raw.replace(/\s+\S*$/, '') : raw.slice(0, SEARCH_QUERY_MAX)
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const type = input.type && input.type !== 'guide' ? input.type : undefined
  const destinationId = input.destinationId && isUuid(input.destinationId) ? input.destinationId : null

  const style = TRAVEL_STYLES.some((s) => s.value === input.style) ? (input.style as string) : null

  // Editorial guides: ranked full-text search with words; a destination (including places inside
  // it) or a travel style alone lists matching guides, so "guides for Kyoto" and the homepage style
  // buttons work without words. "Editorial guides" pages through all of them; "Everything" shows the
  // top few above community posts with a link to the rest. A failure here never breaks the page.
  let guides: GuideResults = { items: [], total: 0, page: 1, totalPages: 0 }
  let guideError = false
  const guideFilters = Boolean(style) || (Boolean(destinationId) && input.type === 'guide')
  if ((query.length >= 2 || guideFilters) && (!input.type || input.type === 'guide') && (input.type === 'guide' || page === 1)) {
    try {
      guides = await searchGuides(payload, {
        q: query,
        destinationIds: destinationId ? await withDescendants(destinationId, payload) : null,
        style,
        page: input.type === 'guide' ? page : 1,
        pageSize: input.type === 'guide' ? GUIDE_PAGE_SIZE : GUIDES_ON_EVERYTHING,
      })
    } catch (error) {
      guideError = true
      console.error('[search] guide search failed; showing the rest of the results.', error instanceof Error ? error.message : error)
    }
  }
  const empty: SearchResult = { items: [], page, totalPages: 0, total: 0, query, guides, guideError }
  if (input.type === 'guide') return empty

  const filters = {
    type,
    destinationId,
    style: input.style || null,
    from: type === 'activity' ? input.from ?? null : null,
    to: type === 'activity' ? input.to ?? null : null,
    // A dated search looks at any event in that period, past or future. Otherwise activities mean upcoming ones.
    when: type === 'activity' && (input.from || input.to) ? null : undefined,
  }

  if (query.length < 2) {
    // Filters without words: a plain filtered list.
    if (!type && !filters.destinationId && !filters.style) return empty
    const listed = await listPublished({ ...filters, page })
    return { ...listed, query, guides, guideError }
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
  if (!ranked.length) return empty

  // Apply the remaining filters and the visibility re-check through the public query, then keep the relevance order.
  const eligible = await listPublished({ ...filters, when: type === 'activity' ? filters.when : null, ids: ranked, page: 1, pageSize: 50 })
  let all = eligible.items
  for (let p = 2; p <= eligible.totalPages; p++) all = all.concat((await listPublished({ ...filters, when: type === 'activity' ? filters.when : null, ids: ranked, page: p, pageSize: 50 })).items)
  const order = new Map(ranked.map((id, i) => [id, i]))
  all.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  const pageSize = LIMITS.pageSize
  const total = all.length
  if (page === 1) await track('community_search', type ?? 'all')
  return { items: all.slice((page - 1) * pageSize, page * pageSize), page, totalPages: Math.ceil(total / pageSize), total, query, guides, guideError }
}
