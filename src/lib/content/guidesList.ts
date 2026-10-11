import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import { ARTICLE_TYPES } from '@/collections/Articles'
import { TRAVEL_STYLES } from '@/lib/community/constants'

import { ARTICLES_TAG, AUTHORS_TAG, DESTINATIONS_TAG } from './revalidate'
import { findStories, type Story } from './stories'

/**
 * The /guides page: every published guide, newest first, with filters by guide type, country and
 * travel style, page numbers, and the newest featured guide on top of the unfiltered first page.
 * All reads use a visitor's permissions, so drafts never appear.
 */

export const GUIDES_PER_PAGE = 24
const SCANNED = 2000
const visitor = { draft: false, overrideAccess: false } as const

export type GuideFilters = { type: string; country: string; style: string; page: number }
export type FilterOption = { value: string; label: string; count: number }
export type GuideOptions = { types: FilterOption[]; countries: FilterOption[]; styles: FilterOption[] }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

/** Read the filters from the address. Anything unknown is ignored rather than causing an error. */
export function readGuideFilters(params: Record<string, string | string[] | undefined>): GuideFilters {
  const type = one(params.type)
  const style = one(params.style)
  const country = one(params.country).toLowerCase()
  const page = Number.parseInt(one(params.page), 10)
  return {
    type: ARTICLE_TYPES.some((t) => t.value === type) ? type : '',
    style: TRAVEL_STYLES.some((s) => s.value === style) ? style : '',
    country: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(country) ? country : '',
    page: Number.isFinite(page) && page > 1 && page < 10000 ? page : 1,
  }
}

export const isFiltered = (f: GuideFilters) => Boolean(f.type || f.country || f.style)

/** The address for a set of filters, without empty values. Page 1 has no page number. */
export function guidesHref(f: Partial<GuideFilters>): string {
  const q = new URLSearchParams()
  if (f.type) q.set('type', f.type)
  if (f.country) q.set('country', f.country)
  if (f.style) q.set('style', f.style)
  if (f.page && f.page > 1) q.set('page', String(f.page))
  const s = q.toString()
  return s ? `/guides?${s}` : '/guides'
}

/** Ids of the published destinations in a country: the country itself and every place inside it. */
async function countryScope(payload: Payload, country: string): Promise<string[]> {
  const found = await payload.find({
    collection: 'destinations',
    where: { or: [{ path: { equals: country } }, { path: { like: `${country}/` } }] },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { path: true },
    ...visitor,
  })
  // `like` matches anywhere in the text, so keep only paths that really start with the country.
  return found.docs.filter((d) => d.path === country || d.path?.startsWith(`${country}/`)).map((d) => d.id)
}

async function whereFor(payload: Payload, f: GuideFilters): Promise<Where | null> {
  const and: Where[] = []
  if (f.type) and.push({ type: { equals: f.type } })
  if (f.style) and.push({ travelStyles: { in: [f.style] } })
  if (f.country) {
    const ids = await countryScope(payload, f.country)
    if (!ids.length) return null
    and.push({ or: [{ primaryDestination: { in: ids } }, { additionalDestinations: { in: ids } }] })
  }
  return and.length ? { and } : {}
}

export type GuidesPage = { featured: Story | null; guides: Story[]; total: number; pages: number; page: number }

/** One page of guides. On the unfiltered first page the newest featured guide leads and is left out of the grid. */
export async function loadGuidesPage(payload: Payload, f: GuideFilters): Promise<GuidesPage> {
  const where = await whereFor(payload, f)
  if (!where) return { featured: null, guides: [], total: 0, pages: 0, page: f.page }
  const featured = !isFiltered(f) && f.page === 1 ? (await findStories(payload, { featured: { equals: true } }, 1))[0] ?? null : null
  const scoped: Where = featured ? { and: [where, { id: { not_equals: featured.id } }] } : where
  const result = await payload.find({
    collection: 'articles',
    where: scoped,
    sort: '-firstPublishedAt',
    limit: GUIDES_PER_PAGE,
    page: f.page,
    depth: 0,
    select: { slug: true },
    ...visitor,
  })
  const ids = result.docs.map((d) => d.id)
  const docs = ids.length ? await findStories(payload, { id: { in: ids } }, ids.length) : []
  const byId = new Map(docs.map((d) => [d.id, d]))
  return {
    featured,
    guides: ids.map((id) => byId.get(id)).filter((s): s is Story => Boolean(s)),
    total: result.totalDocs + (featured ? 1 : 0),
    pages: result.totalPages,
    page: f.page,
  }
}

/** Filter choices that would find at least one guide, with how many. */
export async function loadGuideOptions(payload: Payload): Promise<GuideOptions> {
  const found = await payload.find({
    collection: 'articles',
    limit: SCANNED,
    depth: 0,
    select: { type: true, travelStyles: true, primaryDestination: true, additionalDestinations: true },
    ...visitor,
  })
  const types = new Map<string, number>()
  const styles = new Map<string, number>()
  const destIds = new Set<string>()
  for (const a of found.docs) {
    types.set(a.type, (types.get(a.type) ?? 0) + 1)
    for (const s of a.travelStyles ?? []) styles.set(s, (styles.get(s) ?? 0) + 1)
    for (const d of [a.primaryDestination, ...(a.additionalDestinations ?? [])]) if (typeof d === 'string') destIds.add(d)
  }
  // Each guide counts once per country, whichever of its places are in that country.
  const dests = destIds.size
    ? await payload.find({ collection: 'destinations', where: { id: { in: [...destIds] } }, limit: destIds.size, depth: 0, select: { path: true }, ...visitor })
    : { docs: [] }
  const countryOf = new Map(dests.docs.filter((d) => d.path).map((d) => [d.id, d.path!.split('/')[0]]))
  const countryCounts = new Map<string, number>()
  for (const a of found.docs) {
    const set = new Set([a.primaryDestination, ...(a.additionalDestinations ?? [])].map((d) => (typeof d === 'string' ? countryOf.get(d) : undefined)).filter(Boolean) as string[])
    for (const c of set) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
  }
  const countryNames = countryCounts.size
    ? await payload.find({ collection: 'destinations', where: { path: { in: [...countryCounts.keys()] } }, limit: countryCounts.size, depth: 0, select: { name: true, path: true }, ...visitor })
    : { docs: [] }
  return {
    types: ARTICLE_TYPES.filter((t) => types.has(t.value)).map((t) => ({ value: t.value, label: t.label, count: types.get(t.value)! })),
    styles: TRAVEL_STYLES.filter((s) => styles.has(s.value)).map((s) => ({ value: s.value, label: s.label, count: styles.get(s.value)! })),
    countries: countryNames.docs
      .map((d) => ({ value: d.path!, label: d.name, count: countryCounts.get(d.path!) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }
}

const TAGS = [ARTICLES_TAG, DESTINATIONS_TAG, AUTHORS_TAG]

export const getGuidesPage = (f: GuideFilters) =>
  unstable_cache(async () => loadGuidesPage(await getPayload({ config }), f), ['guides-page', f.type, f.country, f.style, String(f.page)], { tags: TAGS, revalidate: 3600 })()

export const getGuideOptions = () => unstable_cache(async () => loadGuideOptions(await getPayload({ config })), ['guides-options'], { tags: TAGS, revalidate: 3600 })()
