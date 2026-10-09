import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import type { Author, Destination, TravelUpdate } from '@/payload-types'

import { UPDATES_TAG, updateTag } from './revalidate'
import { categoryLabel, isCategory, validSourceUrl, type UpdateCategory } from './updateRules'

/**
 * Travel updates for the public pages: /updates, /updates/<slug>, the RSS feed, the weekly list for
 * the newsletter and the "What's changed" box on destination pages.
 *
 * Every query runs with a visitor's permissions (`overrideAccess: false`, no user, `draft: false`),
 * so a draft can never appear. Plain functions take a Payload instance so tests can call them; pages
 * use the cached wrappers at the bottom, which publishing an update expires.
 */

const REVALIDATE_SECONDS = 60 * 60
export const UPDATES_PAGE_SIZE = 20
/** The "What's changed" box on a destination page. */
export const UPDATES_ON_DESTINATION = 3
/** Updates older than this leave destination pages (they stay on /updates and their own page). */
export const DESTINATION_UPDATE_DAYS = 365
export const FEED_SIZE = 30

const visitor = { draft: false, overrideAccess: false } as const

export type UpdateView = {
  id: string
  slug: string
  path: string
  title: string
  summary: string
  category: UpdateCategory
  categoryLabel: string
  affectsAustralians: boolean
  destinations: { name: string; path: string }[]
  sources: { name: string; url: string }[]
  author: { name: string; slug: string } | null
  firstPublished: string
  /** Set only when an editor recorded a real change or correction. */
  updated: string | null
  updateNote: string
  effectiveDate: string | null
  endDate: string | null
  body: TravelUpdate['body']
  seo: { title: string; description: string; noindex: boolean }
}

export type UpdateList = { items: UpdateView[]; total: number; page: number; totalPages: number }

const populated = <T extends { id: string }>(value: string | T | null | undefined): T | undefined =>
  value && typeof value === 'object' ? value : undefined

export function toView(doc: TravelUpdate): UpdateView {
  const author = populated<Author>(doc.author)
  const destinations = (doc.destinations ?? [])
    .map((d) => populated<Destination>(d))
    .filter((d): d is Destination => Boolean(d?.path) && d?._status === 'published')
    .map((d) => ({ name: d.name, path: d.path as string }))
  const firstPublished = doc.firstPublishedAt ?? doc.createdAt
  return {
    id: doc.id,
    slug: doc.slug,
    path: `/updates/${doc.slug}`,
    title: doc.title,
    summary: doc.summary,
    category: isCategory(doc.category) ? doc.category : 'other',
    categoryLabel: categoryLabel(doc.category),
    affectsAustralians: Boolean(doc.affectsAustralians),
    destinations,
    // Only well-formed https links are ever shown, whatever is in the database.
    sources: (doc.sources ?? []).filter((s) => s.name && validSourceUrl(s.url)).map((s) => ({ name: s.name, url: s.url.trim() })),
    author: author ? { name: author.name, slug: author.slug } : null,
    firstPublished,
    // "Updated" only when the date is clearly after first publication, never at or before it.
    updated: doc.editorialUpdatedAt && new Date(doc.editorialUpdatedAt).getTime() > new Date(firstPublished).getTime() + 60_000 ? doc.editorialUpdatedAt : null,
    updateNote: doc.updateNote ?? '',
    effectiveDate: doc.effectiveDate ?? null,
    endDate: doc.endDate ?? null,
    body: doc.body ?? null,
    seo: { title: doc.seo?.title || doc.title, description: doc.seo?.description || doc.summary, noindex: Boolean(doc.seo?.noindex) },
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function findUpdate(payload: Payload, slug: string): Promise<UpdateView | null> {
  if (!SLUG.test(slug) || slug.length > 96) return null
  const found = await payload.find({ collection: 'travel-updates', where: { slug: { equals: slug } }, limit: 1, depth: 1, ...visitor })
  return found.docs[0] ? toView(found.docs[0]) : null
}

export type UpdateFilters = { page?: number; category?: string | null; destinationIds?: string[] | null; pageSize?: number }

/** Published updates, newest first, optionally for one category and/or a set of places. */
export async function listUpdates(payload: Payload, filters: UpdateFilters = {}): Promise<UpdateList> {
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const limit = Math.max(1, Math.min(filters.pageSize ?? UPDATES_PAGE_SIZE, 50))
  const where: Where[] = []
  if (filters.category && isCategory(filters.category)) where.push({ category: { equals: filters.category } })
  if (filters.destinationIds?.length) where.push({ destinations: { in: filters.destinationIds } })
  const found = await payload.find({
    collection: 'travel-updates',
    where: where.length ? { and: where } : {},
    sort: ['-firstPublishedAt', 'id'],
    page,
    limit,
    depth: 1,
    ...visitor,
  })
  return { items: found.docs.map(toView), total: found.totalDocs, page, totalPages: found.totalPages }
}

/**
 * The "What's changed" box: the newest updates for these places that still apply. An update leaves
 * the box after its end date, or after DESTINATION_UPDATE_DAYS when it has none.
 */
export async function activeUpdatesFor(payload: Payload, destinationIds: string[], limit = UPDATES_ON_DESTINATION, now = new Date()): Promise<UpdateView[]> {
  if (!destinationIds.length) return []
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const since = new Date(now.getTime() - DESTINATION_UPDATE_DAYS * 86_400_000).toISOString()
  const found = await payload.find({
    collection: 'travel-updates',
    where: {
      and: [
        { destinations: { in: destinationIds } },
        { firstPublishedAt: { greater_than_equal: since } },
        { or: [{ endDate: { exists: false } }, { endDate: { equals: null } }, { endDate: { greater_than_equal: today } }] },
      ],
    },
    sort: ['-firstPublishedAt', 'id'],
    limit,
    depth: 1,
    ...visitor,
  })
  return found.docs.map(toView)
}

/** Updates first published in the last `days` days, newest first: the list to copy into the newsletter. */
export async function updatesSince(payload: Payload, days: number, now = new Date()): Promise<UpdateView[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString()
  const found = await payload.find({
    collection: 'travel-updates',
    where: { firstPublishedAt: { greater_than_equal: since } },
    sort: ['-firstPublishedAt', 'id'],
    limit: 50,
    depth: 1,
    ...visitor,
  })
  return found.docs.map(toView)
}

/** Sitemap entries: published updates not marked noindex, plus the list page when there is at least one. */
export async function updateSitemapEntries(payload: Payload): Promise<{ path: string; lastModified?: string }[]> {
  const found = await payload.find({
    collection: 'travel-updates',
    sort: '-firstPublishedAt',
    limit: 0,
    pagination: false,
    depth: 0,
    select: { slug: true, seo: true, firstPublishedAt: true, editorialUpdatedAt: true, createdAt: true },
    ...visitor,
  })
  const entries = found.docs
    .filter((d) => !d.seo?.noindex)
    .map((d) => {
      const modified = d.editorialUpdatedAt ?? d.firstPublishedAt ?? d.createdAt
      return { path: `/updates/${d.slug}`, lastModified: modified ? new Date(modified).toISOString() : undefined }
    })
  return entries.length ? [{ path: '/updates', lastModified: entries[0].lastModified }, ...entries] : []
}

// Cached wrappers for pages. Keys include every argument; publishing an update expires them.

const cached = <T>(key: string[], fn: (payload: Payload) => Promise<T>, tags: string[] = [UPDATES_TAG]) =>
  unstable_cache(async () => fn(await getPayload({ config })), key, { tags, revalidate: REVALIDATE_SECONDS })()

export const getUpdate = (slug: string) => cached(['travel-update', slug], (p) => findUpdate(p, slug), [UPDATES_TAG, updateTag(slug)])

export const getUpdates = (filters: UpdateFilters) =>
  cached(['travel-updates', String(filters.page ?? 1), filters.category ?? '', (filters.destinationIds ?? []).join(','), String(filters.pageSize ?? '')], (p) => listUpdates(p, filters))

export const getRecentUpdates = (days: number) => cached(['travel-updates-since', String(days)], (p) => updatesSince(p, days))
