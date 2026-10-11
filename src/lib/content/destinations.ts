import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

import type { Destination, Image } from '@/payload-types'

import { factLabel, monthRanges, monthRatings, type MonthRating, type Month, utcOffsetLabel } from './destinationFacts'

import { ARTICLES_TAG, DESTINATIONS_TAG, UPDATES_TAG } from './revalidate'
import { findStoriesForDestinations, type Story } from './stories'
import { activeUpdatesFor, type UpdateView } from './updates'

/**
 * Destination pages (/destinations/<path>) and the destinations index, read from the CMS.
 *
 * Every query runs with a visitor's permissions (`overrideAccess: false`, no user, `draft: false`),
 * so a draft destination or a draft guide can never be shown. The plain functions take a Payload
 * instance so tests can call them; pages use the cached wrappers at the bottom.
 */

/** Fallback refresh. Publishing a destination or a guide expires these straight away (tags below). */
const REVALIDATE_SECONDS = 60 * 60
const TAGS = [DESTINATIONS_TAG, ARTICLES_TAG, UPDATES_TAG]
/** "Places in X" shows this many on the destination page, with a link to the full list. */
export const PLACES_SHOWN = 24
export const GUIDES_SHOWN = 24
/** Upper bound on published guides read when counting guides per place. */
const GUIDES_SCANNED = 2000
/** Country → region → city → area, matching the collection's own limit. */
const MAX_DEPTH = 4
const PATH = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/

const visitor = { draft: false, overrideAccess: false } as const
const placeFields = { name: true, path: true, kind: true, summary: true, accentColour: true, hubIndexable: true, parent: true, heroImage: true } as const

export type Place = {
  id: string
  name: string
  path: string
  kind: Destination['kind']
  summary: string
  accent: string | null
  hubIndexable: boolean
  /** Id of the main photo, if the destination has one. Loaded separately as a {@link Photo}. */
  imageId: string | null
}
export type PlaceWithGuides = Place & { guides: number; image?: Photo | null }

/** An editorial photo ready to show: the sizes to choose from and the credit line. */
export type Photo = {
  src: string
  /** "url 480w, url 960w, ..." from the stored sizes, smallest first. */
  srcSet: string
  width: number
  height: number
  alt: string
  caption: string | null
  credit: string
  licence: Image['licence']
  licenceUrl: string | null
  sourceUrl: string | null
  /** Focal point in percent, for object-position when the photo is cropped. */
  focus: { x: number; y: number }
}

export type Fact = { kind: string; label: string; value: string; source: { name: string; url: string } | null }
export type Faq = { question: string; answer: string }

/** Everything the "Plan your trip" parts of the page need, all optional so an empty field shows nothing. */
export type Planning = {
  photo: Photo | null
  goodFor: string | null
  timeNeeded: string | null
  months: { month: Month; rating: MonthRating }[] | null
  bestRange: string
  goodRange: string
  whenToGo: string | null
  facts: Fact[]
  factsCheckedAt: string | null
  sources: { name: string; url: string }[]
  faqs: Faq[]
  author: { name: string; slug: string } | null
  location: { latitude: number; longitude: number; source: string | null } | null
  timeZone: { name: string; offset: string } | null
  seo: { title: string | null; description: string | null }
  updatedAt: string | null
}
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
  /** "What's changed": the newest travel updates that still apply here, in a place inside it, or in the country or region it is in. */
  updates: UpdateView[]
  planning: Planning
}

type PlaceDoc = Pick<Destination, 'id' | 'name' | 'path' | 'slug' | 'kind' | 'summary' | 'accentColour' | 'hubIndexable' | 'parent' | 'heroImage'>

const relId = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : null

/**
 * The summary an editor wrote, or '' while it is still the importer's placeholder
 * ("Traveller questions, trip reports and activities about Kyoto, Japan." from
 * scripts/import-destinations.ts). That wording describes the community hub, not a destination
 * page, so it is never shown here; pages fall back to their own wording instead.
 */
export function editorSummary(name: string, summary: string | null | undefined): string {
  const text = (summary ?? '').trim()
  const imported = `Traveller questions, trip reports and activities about ${name}`
  if (text === `${imported}.` || (text.startsWith(`${imported}, `) && text.endsWith('.'))) return ''
  return text
}

const toPlace = (d: PlaceDoc): Place => ({
  id: d.id,
  name: d.name,
  path: d.path ?? d.slug,
  kind: d.kind,
  summary: editorSummary(d.name, d.summary),
  accent: d.accentColour || null,
  hubIndexable: Boolean(d.hubIndexable),
  imageId: relId(d.heroImage),
})

const SIZE_ORDER = ['thumb', 'card', 'large'] as const

/** Turn a stored editorial photo into what the page needs. A photo without a file is skipped. */
export function toPhoto(img: Image | null | undefined): Photo | null {
  if (!img?.url || !img.width || !img.height) return null
  const candidates = [
    // The thumbnail is cropped to 3:2, so it is only offered when the original has the same shape.
    ...SIZE_ORDER.map((name) => img.sizes?.[name]).filter((s, i) => s?.url && s.width && (i > 0 || Math.abs((s.height ?? 0) / s.width - img.height! / img.width!) < 0.02)),
    { url: img.url, width: img.width },
  ] as { url: string; width: number }[]
  const seen = new Set<number>()
  const srcSet = candidates
    .filter((c) => c.url && c.width && !seen.has(c.width) && seen.add(c.width))
    .sort((a, b) => a.width - b.width)
    .map((c) => `${c.url} ${c.width}w`)
    .join(', ')
  const pct = (v: number | null | undefined) => (typeof v === 'number' && v >= 0 && v <= 100 ? v : 50)
  return {
    src: img.sizes?.large?.url || img.url,
    srcSet,
    width: img.width,
    height: img.height,
    alt: img.alt,
    caption: img.caption || null,
    credit: img.credit,
    licence: img.licence,
    licenceUrl: img.licenceUrl || null,
    sourceUrl: img.sourceUrl || null,
    focus: { x: pct(img.focalX), y: pct(img.focalY) },
  }
}

/** Load editorial photos by id in one query. */
async function photosByIds(payload: Payload, ids: (string | null)[]): Promise<Map<string, Photo>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (!wanted.length) return new Map()
  const found = await payload.find({ collection: 'images', where: { id: { in: wanted } }, limit: wanted.length, depth: 0, overrideAccess: false })
  const out = new Map<string, Photo>()
  for (const img of found.docs) {
    const photo = toPhoto(img)
    if (photo) out.set(img.id, photo)
  }
  return out
}

const clean = (v: string | null | undefined) => (v ?? '').trim() || null

/** The planning parts of a destination, from its own fields. Facts without a value are left out. */
async function planningFor(payload: Payload, doc: Destination): Promise<Planning> {
  const [photos, author] = await Promise.all([
    photosByIds(payload, [relId(doc.heroImage)]),
    relId(doc.author)
      ? payload.find({ collection: 'authors', where: { id: { equals: relId(doc.author) } }, limit: 1, depth: 0, select: { name: true, slug: true }, overrideAccess: false }).then((r) => r.docs[0] ?? null)
      : Promise.resolve(null),
  ])
  const rated = (doc.bestMonths?.length ?? 0) + (doc.goodMonths?.length ?? 0) > 0
  const facts: Fact[] = (doc.facts ?? [])
    .map((f) => ({
      kind: f.kind,
      label: factLabel(f.kind, f.label),
      value: (f.value ?? '').trim(),
      source: f.sourceName && f.sourceUrl ? { name: f.sourceName.trim(), url: f.sourceUrl.trim() } : null,
    }))
    .filter((f) => f.label && f.value)
  const hasLocation = typeof doc.latitude === 'number' && typeof doc.longitude === 'number' && !(doc.latitude === 0 && doc.longitude === 0)
  const offset = doc.timeZone ? utcOffsetLabel(doc.timeZone) : ''
  return {
    photo: photos.get(relId(doc.heroImage) ?? '') ?? null,
    goodFor: clean(doc.goodFor),
    timeNeeded: clean(doc.timeNeeded),
    months: rated ? monthRatings(doc.bestMonths, doc.goodMonths) : null,
    bestRange: monthRanges(doc.bestMonths),
    goodRange: monthRanges((doc.goodMonths ?? []).filter((m) => !(doc.bestMonths ?? []).includes(m))),
    whenToGo: rated ? clean(doc.whenToGo) : null,
    facts,
    factsCheckedAt: facts.length && doc.factsCheckedAt ? doc.factsCheckedAt : null,
    sources: (doc.sources ?? []).filter((s) => s.name && s.url).map((s) => ({ name: s.name.trim(), url: s.url.trim() })),
    faqs: (doc.faqs ?? []).filter((q) => q.question?.trim() && q.answer?.trim()).map((q) => ({ question: q.question.trim(), answer: q.answer.trim() })),
    author: author ? { name: author.name, slug: author.slug } : null,
    location: hasLocation ? { latitude: doc.latitude as number, longitude: doc.longitude as number, source: doc.source?.name?.startsWith('GeoNames') ? 'GeoNames' : null } : null,
    timeZone: doc.timeZone && offset ? { name: doc.timeZone, offset } : null,
    // The importer's search title and description describe the community page, not this one, so they are not used.
    seo: {
      title: clean(doc.seo?.title) === `${doc.name} travel community` ? null : clean(doc.seo?.title),
      description: editorSummary(doc.name, doc.seo?.description) || null,
    },
    updatedAt: doc.updatedAt ?? null,
  }
}

/** True when a destination has something of its own to read: an introduction, facts, months or questions. */
export const hasOwnContent = (page: Pick<DestinationPage, 'body' | 'planning'>): boolean =>
  Boolean(page.body) || page.planning.facts.length > 0 || Boolean(page.planning.months) || page.planning.faqs.length > 0

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
  const [guides, counts, childrenWithBody, updates, planning] = await Promise.all([
    findStoriesForDestinations(payload, scope, GUIDES_SHOWN),
    guideCounts(payload, scope),
    inside.children.length ? withBody(payload, inside.children.map((c) => c.id)) : Promise.resolve([]),
    activeUpdatesFor(payload, [...ancestors.map((a) => a.id), ...scope]),
    planningFor(payload, doc),
  ])

  // A guide counts once for the whole page, and once for each child place whose area it covers.
  const perBranch = new Map<string, number>()
  for (const [id, n] of counts) {
    const branch = inside.branchOf.get(id)
    if (branch) perBranch.set(branch, (perBranch.get(branch) ?? 0) + n)
  }
  const hasBody = new Set(childrenWithBody.map((c) => c.id))
  const shown = inside.children.filter((c) => (perBranch.get(c.id) ?? 0) > 0 || hasBody.has(c.id))
  const childPhotos = await photosByIds(payload, shown.map((c) => relId(c.heroImage)))
  const places = shown
    .map((c) => ({ ...toPlace(c), guides: perBranch.get(c.id) ?? 0, image: childPhotos.get(relId(c.heroImage) ?? '') ?? null }))
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
    updates,
    planning,
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
  const photos = await photosByIds(payload, [...byId.values()].map((d) => relId(d.heroImage)))
  return [...byId.values()]
    .filter((d) => d.path)
    .map((d) => ({ ...toPlace(d), guides: counts.get(d.id) ?? 0, parentName: parentName.get(relId(d.parent) ?? '') ?? null, image: photos.get(relId(d.heroImage) ?? '') ?? null }))
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
