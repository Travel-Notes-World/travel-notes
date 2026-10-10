import type { Payload } from 'payload'

import { run, sql } from '../community/db'

/**
 * Suggestions as you type, and "did you mean" corrections, using PostgreSQL trigrams (pg_trgm,
 * migration 20261010_083000_search_trigram). A trigram match still finds "Kyoto" from "Kyto":
 * places match on "contains" or similarity (the % operator, threshold 0.3); guide and update
 * titles on "contains" or word similarity (the <% operator, threshold 0.6). Both use the GIN indexes.
 *
 * The SQL only picks candidate ids from published rows; every candidate is then loaded again with a
 * visitor's permissions (overrideAccess: false, draft: false), so a draft can never be suggested.
 */

export const SUGGEST_MIN = 2
export const SUGGEST_MAX_LENGTH = 50
export const SUGGEST_LIMIT = 8
/** How alike a word and a place name must be (0–1, pg_trgm similarity) before the word is corrected. */
export const CORRECTION_MIN = 0.35

export type Suggestion = { type: 'destination' | 'guide' | 'update'; label: string; detail: string; href: string }

const visitor = { draft: false, overrideAccess: false } as const

/** Trim, collapse spaces, drop control characters, cap the length. */
export function cleanQuery(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SUGGEST_MAX_LENGTH)
}

/** LIKE patterns: the user's text is matched literally, never as a wildcard. */
const literal = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`)

async function ids(payload: Payload, query: ReturnType<typeof sql>): Promise<string[]> {
  const result = await run(payload, query)
  return (result.rows as { id: string }[]).map((r) => String(r.id))
}

/** Keep the order the SQL ranked them in. */
const inOrder = <T extends { id: string }>(order: string[], docs: T[]) => {
  const byId = new Map(docs.map((d) => [String(d.id), d]))
  return order.map((id) => byId.get(id)).filter((d): d is T => Boolean(d))
}

export async function suggest(payload: Payload, raw: unknown): Promise<Suggestion[]> {
  const q = cleanQuery(raw)
  if (q.replace(/[^\p{L}\p{N}]/gu, '').length < SUGGEST_MIN) return []
  const starts = `${literal(q)}%`
  const contains = `%${literal(q)}%`

  // Places first: an exact name, then names starting with the text, then the closest typo match.
  const [placeIds, guideIds, updateIds] = await Promise.all([
    ids(payload, sql`SELECT d."id" FROM "destinations" d
      WHERE d."_status" = 'published' AND d."path" IS NOT NULL
        AND (d."name" ILIKE ${contains} OR d."name" % ${q})
      ORDER BY lower(d."name") = lower(${q}) DESC, d."name" ILIKE ${starts} DESC, d."name" ILIKE ${contains} DESC,
        similarity(d."name", ${q}) DESC, d."kind" = 'country' DESC, length(d."name"), d."id"
      LIMIT 4`),
    ids(payload, sql`SELECT a."id" FROM "articles" a
      WHERE a."_status" = 'published' AND (a."title" ILIKE ${contains} OR ${q} <% a."title")
      ORDER BY a."title" ILIKE ${contains} DESC, word_similarity(${q}, a."title") DESC, a."first_published_at" DESC NULLS LAST, a."id"
      LIMIT 3`),
    ids(payload, sql`SELECT u."id" FROM "travel_updates" u
      WHERE u."_status" = 'published' AND (u."title" ILIKE ${contains} OR ${q} <% u."title")
      ORDER BY u."title" ILIKE ${contains} DESC, word_similarity(${q}, u."title") DESC, u."first_published_at" DESC NULLS LAST, u."id"
      LIMIT 2`),
  ])

  const [places, guides, updates] = await Promise.all([
    placeIds.length
      ? payload.find({ collection: 'destinations', where: { id: { in: placeIds } }, limit: placeIds.length, depth: 1, select: { name: true, path: true, kind: true, parent: true }, ...visitor })
      : Promise.resolve({ docs: [] }),
    guideIds.length
      ? payload.find({ collection: 'articles', where: { id: { in: guideIds } }, limit: guideIds.length, depth: 0, select: { title: true, slug: true }, ...visitor })
      : Promise.resolve({ docs: [] }),
    updateIds.length
      ? payload.find({ collection: 'travel-updates', where: { id: { in: updateIds } }, limit: updateIds.length, depth: 0, select: { title: true, slug: true }, ...visitor })
      : Promise.resolve({ docs: [] }),
  ])

  const out: Suggestion[] = []
  for (const d of inOrder(placeIds, places.docs as { id: string; name: string; path?: string | null; parent?: unknown }[])) {
    if (!d.path) continue
    const parent = d.parent && typeof d.parent === 'object' && 'name' in d.parent ? String((d.parent as { name: unknown }).name) : ''
    out.push({ type: 'destination', label: d.name, detail: parent ? `Destination in ${parent}` : 'Destination', href: `/destinations/${d.path}` })
  }
  for (const a of inOrder(guideIds, guides.docs as { id: string; title: string; slug: string }[])) {
    out.push({ type: 'guide', label: a.title, detail: 'Guide', href: `/stories/${a.slug}` })
  }
  for (const u of inOrder(updateIds, updates.docs as { id: string; title: string; slug: string }[])) {
    out.push({ type: 'update', label: u.title, detail: 'Travel update', href: `/updates/${u.slug}` })
  }
  return out.slice(0, SUGGEST_LIMIT)
}

/** Everyday words people type around a place name; never "corrected" into a place. */
const COMMON = new Set(
  'about after along also around away back beach beaches best budget cheap city coast country days does drive eat eating family festival flight flights food free from good guide guides have hike hikes hiking holiday hotel hotels island islands itinerary kids local long luxury market markets month near night nights north places plan rain road safe safety season ski south stay street summer that the their them there things time tips tour tours train travel trip trips visa visit walk walks week weather west what when where which while winter with world'.split(' '),
)

/**
 * "Did you mean": replace each word that looks like a misspelt place name with the place, e.g.
 * "best time to visit japn" → "best time to visit Japan". Only published destination names are
 * used, only words of 4+ letters are tried, common travel words are left alone, and a word that is
 * already a real place name is kept. Returns null when nothing changes.
 */
export async function correctQuery(payload: Payload, raw: unknown): Promise<string | null> {
  const q = cleanQuery(raw)
  if (!q) return null
  const words = q.split(' ')
  let changed = false
  const fixed: string[] = []
  for (const word of words) {
    const w = word.toLowerCase()
    if (w.length < 4 || COMMON.has(w) || !/^\p{L}+$/u.test(w)) {
      fixed.push(word)
      continue
    }
    const result = await run(payload, sql`SELECT d."name", lower(d."name") = ${w} AS "exact"
      FROM "destinations" d
      WHERE d."_status" = 'published' AND d."path" IS NOT NULL AND d."name" NOT LIKE '% %'
        AND d."name" % ${w} AND similarity(d."name", ${w}) >= ${CORRECTION_MIN} AND abs(length(d."name") - ${w.length}) <= 2
      ORDER BY lower(d."name") = ${w} DESC, similarity(d."name", ${w}) DESC, d."kind" = 'country' DESC, d."id"
      LIMIT 1`)
    const row = result.rows[0] as { name?: string; exact?: boolean } | undefined
    if (row?.name && !row.exact) {
      fixed.push(row.name)
      changed = true
    } else {
      fixed.push(word)
    }
  }
  return changed ? fixed.join(' ') : null
}
