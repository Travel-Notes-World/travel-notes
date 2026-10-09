import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

import type { Destination } from '@/payload-types'

import { ARTICLES_TAG, DESTINATIONS_TAG } from './revalidate'
import { findStoriesForDestinations, type Story } from './stories'

/**
 * Destination pages (/destinations/<path>) and the destinations index, read from the CMS.
 *
 * Every query runs with a visitor's permissions (`overrideAccess: false`, no user, `draft: false`),
 * so a draft destination or a draft guide can never be shown. The plain functions take a Payload
 * instance so tests can call them; pages use the cached wrappers at the bottom.
 */

/** Fallback refresh. Publishing a destination or a guide expires these straight away (tags below). */
const REVALIDATE_SECONDS = 60 * 60
const TAGS = [DESTINATIONS_TAG, ARTICLES_TAG]
/** "Places in X" shows this many on the destination page, with a link to the full list. */
export const PLACES_SHOWN = 24
export const GUIDES_SHOWN = 24
/** Upper bound on published guides read when counting guides per place. */
const GUIDES_SCANNED = 2000
/** Country → region → city → area, matching the collection's own limit. */
const MAX_DEPTH = 4
const PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/

const visitor = { draft: false, overrideAccess: false } as const
const placeFields = { name: true, path: true, kind: true, summary: true, accentColour: true, hubIndexable: true, parent: true } as const

export type Place = {
  id: string
  name: string
  path: string
  kind: Destination['kind']
  summary: string
  accent: string | null
  hubIndexable: boolean
}
export type PlaceWithGuides = Place & { guides: number }
export type ListedPlace = PlaceWithGuides & { parentName: string | null }

export type DestinationPage = {
  place: Place
  body: Destination['body']
  /** Country first, down to the parent of this place. */
  ancestors: Place[]
  guides: Story[]
  /** Published guides about this place and the places inside it. */
  guideTotal: number
  /** Places directly inside this one that have guides or a body, most guides first. */
  places: PlaceWithGuides[]
  /** How many such places there are in total, before `places` is cut to the display limit. */
  placeTotal: number
}

type PlaceDoc = Pick<Destination, 'id' | 'name' | 'path' | 'slug' | 'kind' | 'summary' | 'accentColour' | 'hubIndexable' | 'parent'>

const relId = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : null

const toPlace = (d: PlaceDoc): Place => ({
  id: d.id,
  name: d.name,
  path: d.path ?? d.slug,
  kind: d.kind,
  summary: d.summary ?? '',
  accent: d.accentColour || null,
  hubIndexable: Boolean(d.hubIndexable),
})

export type Resolution = { kind: 'found'; doc: Destination } | { kind: 'redirect'; path: string } | null

/**
 * Find the published destination for an address.
 * - The exact canonical path: found.
 * - The same path in other letter case: redirect to the canonical path.
 * - A path the destination had in an earlier published version (it was renamed or moved): redirect
 *   to where it is now, but only if it is still published and the target differs from the request.
 * - Anything else: null, which the page turns into a 404.
 */
export async function resolveDestination(payload: Payload, requested: string): Promise<Resolution> {
  const path = requested.toLowerCase()
  if (!PATH.test(path)) return null
  const found = await payload.find({ collection: 'destinations', where: { path: { equals: path } }, limit: 1, depth: 0, ...visitor })
  const doc = found.docs[0]
  if (doc?.path) return doc.path === requested ? { kind: 'found', doc } : { kind: 'redirect', path: doc.path }

  // Version history is staff-only, so only the destination id is taken from it. The destination
  // itself is then loaded with a visitor's permissions, which rules out drafts. Destinations have no
  // autosave, so every version is a deliberate save; only published ones count as old addresses.
  const versions = await payload.findVersions({
    collection: 'destinations',
    where: { and: [{ 'version.path': { equals: path } }, { 'version._status': { equals: 'published' } }] },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const id = relId(versions.docs[0]?.parent)
  if (!id) return null
  const current = await payload.find({ collection: 'destinations', where: { id: { equals: id } }, limit: 1, depth: 0, ...visitor })
  const target = current.docs[0]?.path
  return target && target !== path && target !== requested ? { kind: 'redirect', path: target } : null
}

/** The published parents of a destination, country first. */
async function ancestorsOf(payload: Payload, doc: PlaceDoc): Promise<Place[]> {
  const chain: Place[] = []
  const seen = new Set([doc.id])
  let parentId = relId(doc.parent)
  while (parentId && !seen.has(parentId) && chain.length < MAX_DEPTH) {
    seen.add(parentId)
    const found = await payload.find({ collection: 'destinations', where: { id: { equals: parentId } }, limit: 1, depth: 0, select: placeFields, ...visitor })
    const parent = found.docs[0] as PlaceDoc | undefined
    if (!parent) break
    chain.unshift(toPlace(parent))
    parentId = relId(parent.parent)
  }
  return chain
}

/**
 * Every published place inside a destination, with the direct child each one sits under, so a
 * guide about a city can be counted for the region that contains it.
 */
async function placesInside(payload: Payload, rootId: string): Promise<{ children: PlaceDoc[]; branchOf: Map<string, string> }> {
  const branchOf = new Map<string, string>()
  let children: PlaceDoc[] = []
  let frontier = [rootId]
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const found = await payload.find({
      collection: 'destinations',
      where: { parent: { in: frontier } },
      limit: 0,
      pagination: false,
      depth: 0,
      select: placeFields,
      ...visitor,
    })
    const docs = found.docs as PlaceDoc[]
    if (depth === 0) children = docs
    frontier = []
    for (const d of docs) {
      if (branchOf.has(d.id) || d.id === rootId) continue
      const parentId = relId(d.parent)
      branchOf.set(d.id, depth === 0 ? d.id : (parentId && branchOf.get(parentId)) || d.id)
      frontier.push(d.id)
    }
  }
  return { children, branchOf }
}

/** How many published guides mention each destination, as the main or an additional destination. */
async function guideCounts(payload: Payload, destinationIds?: string[]): Promise<Map<string, number>> {
  const found = await payload.find({
    collection: 'articles',
    where: destinationIds
      ? { or: [{ primaryDestination: { in: destinationIds } }, { additionalDestinations: { in: destinationIds } }] }
      : { or: [{ primaryDestination: { exists: true } }, { additionalDestinations: { exists: true } }] },
    select: { primaryDestination: true, additionalDestinations: true },
    sort: '-firstPublishedAt',
    limit: GUIDES_SCANNED,
    depth: 0,
    ...visitor,
  })
  const counts = new Map<string, number>()
  for (const a of found.docs) {
    const ids = new Set([relId(a.primaryDestination), ...(a.additionalDestinations ?? []).map(relId)].filter((id): id is string => Boolean(id)))
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Ids of published destinations, among those given, that have an editor-written body. */
async function withBody(payload: Payload, ids?: string[]): Promise<PlaceDoc[]> {
  const found = await payload.find({
    collection: 'destinations',
    where: ids ? { and: [{ id: { in: ids } }, { body: { exists: true } }] } : { body: { exists: true } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: placeFields,
    ...visitor,
  })
  return found.docs as PlaceDoc[]
}

/**
 * Everything the destination page shows. `placesLimit` caps "Places in X" (null lists them all,
 * for the full list on the index page).
 */
export async function loadDestinationPage(payload: Payload, doc: Destination, placesLimit: number | null = PLACES_SHOWN): Promise<DestinationPage> {
  const [ancestors, inside] = await Promise.all([ancestorsOf(payload, doc), placesInside(payload, doc.id)])
  const scope = [doc.id, ...inside.branchOf.keys()]
  const [guides, counts, childrenWithBody] = await Promise.all([
    findStoriesForDestinations(payload, scope, GUIDES_SHOWN),
    guideCounts(payload, scope),
    inside.children.length ? withBody(payload, inside.children.map((c) => c.id)) : Promise.resolve([]),
  ])

  // A guide counts once for the whole page, and once for each child place whose area it covers.
  const perBranch = new Map<string, number>()
  for (const [id, n] of counts) {
    const branch = inside.branchOf.get(id)
    if (branch) perBranch.set(branch, (perBranch.get(branch) ?? 0) + n)
  }
  const hasBody = new Set(childrenWithBody.map((c) => c.id))
  const places = inside.children
    .filter((c) => (perBranch.get(c.id) ?? 0) > 0 || hasBody.has(c.id))
    .map((c) => ({ ...toPlace(c), guides: perBranch.get(c.id) ?? 0 }))
    .sort((a, b) => b.guides - a.guides || a.name.localeCompare(b.name))

  const guideTotal = await countGuides(payload, scope)
  return {
    place: toPlace(doc),
    body: doc.body ?? null,
    ancestors,
    guides,
    guideTotal,
    places: placesLimit === null ? places : places.slice(0, placesLimit),
    placeTotal: places.length,
  }
}

async function countGuides(payload: Payload, ids: string[]): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'articles',
    where: { or: [{ primaryDestination: { in: ids } }, { additionalDestinations: { in: ids } }] },
    ...visitor,
  })
  return totalDocs
}

/**
 * The destinations index: only places with at least one published guide or an editor-written
 * body, never the thousands of imported places with nothing on them yet.
 */
export async function listDestinationsWithContent(payload: Payload): Promise<ListedPlace[]> {
  const counts = await guideCounts(payload)
  const [bodied, guided] = await Promise.all([
    withBody(payload),
    counts.size
      ? payload.find({ collection: 'destinations', where: { id: { in: [...counts.keys()] } }, limit: 0, pagination: false, depth: 0, select: placeFields, ...visitor })
      : Promise.resolve({ docs: [] as PlaceDoc[] }),
  ])
  const byId = new Map<string, PlaceDoc>()
  for (const d of [...(guided.docs as PlaceDoc[]), ...bodied]) byId.set(d.id, d)
  const parentIds = [...new Set([...byId.values()].map((d) => relId(d.parent)).filter((id): id is string => Boolean(id)))]
  const parents = parentIds.length
    ? await payload.find({ collection: 'destinations', where: { id: { in: parentIds } }, limit: 0, pagination: false, depth: 0, select: { name: true }, ...visitor })
    : { docs: [] }
  const parentName = new Map(parents.docs.map((p) => [p.id, p.name]))
  return [...byId.values()]
    .filter((d) => d.path)
    .map((d) => ({ ...toPlace(d), guides: counts.get(d.id) ?? 0, parentName: parentName.get(relId(d.parent) ?? '') ?? null }))
    .sort((a, b) => b.guides - a.guides || a.name.localeCompare(b.name))
}

/** Search engines may index a destination page only after an administrator ticks "hubIndexable". */
export const destinationRobots = (place: Pick<Place, 'hubIndexable'>) => (place.hubIndexable ? undefined : { index: false, follow: true })

/** Sitemap entries: indexable published destinations only. */
export async function indexableDestinationPaths(payload: Payload): Promise<{ path: string; lastModified?: string }[]> {
  const found = await payload.find({
    collection: 'destinations',
    where: { hubIndexable: { equals: true } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { path: true, updatedAt: true },
    ...visitor,
  })
  return found.docs
    .filter((d) => d.path)
    .map((d) => ({ path: `/destinations/${d.path}`, lastModified: d.updatedAt ? new Date(d.updatedAt).toISOString() : undefined }))
}

// Cached wrappers for pages. Keys include every argument; tags expire them on publish.

export const getDestinationResolution = (requested: string) =>
  unstable_cache(async () => resolveDestination(await getPayload({ config }), requested), ['destination-resolve', requested], {
    tags: TAGS,
    revalidate: REVALIDATE_SECONDS,
  })()

export const getDestinationPage = (doc: Destination, placesLimit: number | null = PLACES_SHOWN) =>
  unstable_cache(async () => loadDestinationPage(await getPayload({ config }), doc, placesLimit), ['destination-page', doc.id, String(placesLimit)], {
    tags: TAGS,
    revalidate: REVALIDATE_SECONDS,
  })()

export const getDestinationsWithContent = () =>
  unstable_cache(async () => listDestinationsWithContent(await getPayload({ config })), ['destinations-with-content'], {
    tags: TAGS,
    revalidate: REVALIDATE_SECONDS,
  })()
