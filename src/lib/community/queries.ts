import type { Payload, Where } from 'payload'

import type { Contribution, Media } from '../../payload-types'
import { LIMITS, type ContributionType } from './constants'
import { contributionPath } from './contributions'
import { cms, relId, relIds } from './db'
import { destinationsByIds, isUuid } from './destinations'
import { authorsById } from './members'
import { totalsByCurrency, type CurrencyTotal } from './money'
import { excerpt } from './text'
import { currentEventStatus } from './time'
import type { Page, PublicAuthor } from './types'

/**
 * Public reads. Everything here returns approved content only, and builds a plain object with
 * exactly the fields a visitor may see. Queries run with a visitor's permissions
 * (`overrideAccess: false`, no user) AND filter on state explicitly, so two independent rules
 * would both have to fail before unapproved content could appear.
 */

export type PlaceRef = { id: string; name: string; label: string; path: string }
export type Photo = { id: string; url: string; thumbUrl: string; cardUrl: string; alt: string; width: number | null; height: number | null }

export type ActivityInfo = {
  category: string | null; format: string | null; venueName: string; venueAddress: string; timeZone: string | null; allDay: boolean
  startLocal: string | null; endLocal: string | null; originalStartLocal: string | null; startsAt: string | null; endsAt: string | null
  /** Worked out from the clock when the page is built, so an event that is over never shows as upcoming. */
  status: string
  statusNote: string
  priceState: string | null; priceMinor: number | null; priceCurrency: string | null; bookingUrl: string | null; sourceUrl: string | null
  organiserName: string; organiserVerified: boolean; disclosure: string; audience: string; accessibility: string; capacity: number | null
  lastCheckedAt: string | null; interestedCount: number; goingCount: number
}

export type Card = {
  id: string; shortId: string; type: ContributionType; title: string; path: string; excerpt: string
  author: PublicAuthor; authorId: string | null; publishedAt: string | null; updatedAt: string | null
  destinations: PlaceRef[]; style: string | null; replyCount: number; helpfulCount: number
  question?: { resolved: boolean; hasAcceptedAnswer: boolean }
  trip?: { startDate: string | null; endDate: string | null; travelMonth: string | null; durationDays: number | null; partySize: number | null }
  activity?: ActivityInfo
  photo?: Photo
}

export type Detail = Card & {
  body: string; language: string; indexing: string; topics: { name: string; slug: string }[]; photos: Photo[]
  questionDetail?: { travelMonth: string | null; durationDays: number | null; partyType: string | null; budgetMinor: number | null; budgetCurrency: string | null; acceptedAnswerId: string | null; duplicateOf: { title: string; path: string } | null }
  tripDetail?: {
    nights: number | null; partyType: string | null; costScope: string | null; flightsIncluded: boolean; costNotes: string; transport: string; recommendations: string; mistakes: string
    costs: { category: string; amountMinor: number; currency: string; basis: string; quantity: number; date: string | null; kind: string; note: string }[]
    /** One total per currency. Different currencies are never added together. */
    totals: CurrencyTotal[]
    hasEstimates: boolean
    days: { title: string; date: string | null; stops: { title: string; place: string; timeNote: string; costMinor: number | null; costCurrency: string | null; description: string; destination: PlaceRef | null }[] }[]
  }
}

const PUBLISHED: Where = { state: { equals: 'published' } }

function toPhoto(media: Media): Photo | null {
  if (media.state !== 'approved' || !media.url) return null
  return {
    id: media.id,
    url: media.url,
    thumbUrl: media.sizes?.thumb?.url ?? media.url,
    cardUrl: media.sizes?.card?.url ?? media.url,
    alt: media.alt ?? '',
    width: media.width ?? null,
    height: media.height ?? null,
  }
}

function activityInfo(doc: Contribution, now: Date): ActivityInfo {
  const a = doc.activity ?? {}
  return {
    category: a.category ?? null, format: a.format ?? null, venueName: a.venueName ?? '', venueAddress: a.venueAddress ?? '', timeZone: a.timeZone ?? null, allDay: Boolean(a.allDay),
    startLocal: a.startLocal ?? null, endLocal: a.endLocal ?? null, originalStartLocal: a.originalStartLocal ?? null, startsAt: a.startsAt ?? null, endsAt: a.endsAt ?? null,
    status: currentEventStatus(a, now), statusNote: a.statusNote ?? '',
    priceState: a.priceState ?? null, priceMinor: a.priceMinor ?? null, priceCurrency: a.priceCurrency ?? null, bookingUrl: a.bookingUrl ?? null, sourceUrl: a.sourceUrl ?? null,
    // organiserContact is deliberately not copied: it is private.
    organiserName: a.organiserName ?? '', organiserVerified: Boolean(a.organiserVerified), disclosure: a.disclosure ?? 'none', audience: a.audience ?? '', accessibility: a.accessibility ?? '',
    capacity: a.capacity ?? null, lastCheckedAt: a.lastCheckedAt ?? null, interestedCount: a.interestedCount ?? 0, goingCount: a.goingCount ?? 0,
  }
}

type Lookups = { authors: Map<string, PublicAuthor>; places: Map<string, PlaceRef>; photos: Map<string, Photo> }

async function lookups(payload: Payload, docs: Contribution[], options: { allPhotos?: boolean } = {}): Promise<Lookups> {
  const placeIds = docs.flatMap((d) => [...relIds(d.destinations), ...(d.itineraryDays ?? []).flatMap((day) => (day.stops ?? []).map((s) => relId(s.destination)))])
  const photoIds = docs.flatMap((d) => (options.allPhotos ? relIds(d.photos) : relIds(d.photos).slice(0, 1)))
  const [authors, places, media] = await Promise.all([
    authorsById(docs.map((d) => relId(d.author))),
    destinationsByIds(placeIds, payload),
    // Read with a visitor's permissions: the collection itself only returns approved photos.
    photoIds.length ? payload.find({ collection: 'media', where: { id: { in: [...new Set(photoIds)] } }, limit: photoIds.length, pagination: false, depth: 0, overrideAccess: false }) : Promise.resolve({ docs: [] as Media[] }),
  ])
  const photos = new Map<string, Photo>()
  for (const m of media.docs) {
    const photo = toPhoto(m)
    if (photo) photos.set(m.id, photo)
  }
  return { authors, places: new Map(places.map((p) => [p.id, { id: p.id, name: p.name, label: p.label, path: p.path }])), photos }
}

function toCard(doc: Contribution, l: Lookups, now: Date): Card {
  const type = doc.type as ContributionType
  const authorId = relId(doc.author)
  const author = (authorId && l.authors.get(authorId)) || { handle: null, displayName: 'Deleted member', hasProfile: false }
  const card: Card = {
    id: doc.id, shortId: doc.shortId, type, title: doc.title, path: contributionPath(doc), excerpt: excerpt(doc.body, 180),
    author, authorId: author.hasProfile ? authorId : null, publishedAt: doc.publishedAt ?? null, updatedAt: doc.contentUpdatedAt ?? doc.publishedAt ?? null,
    destinations: relIds(doc.destinations).map((id) => l.places.get(id)).filter((p): p is PlaceRef => Boolean(p)),
    style: doc.style ?? null, replyCount: doc.replyCount ?? 0, helpfulCount: doc.helpfulCount ?? 0,
  }
  if (type === 'question') card.question = { resolved: Boolean(doc.question?.resolved), hasAcceptedAnswer: Boolean(relId(doc.question?.acceptedAnswer)) }
  if (type === 'trip') card.trip = { startDate: doc.trip?.startDate ?? null, endDate: doc.trip?.endDate ?? null, travelMonth: doc.trip?.travelMonth ?? null, durationDays: doc.trip?.durationDays ?? null, partySize: doc.trip?.partySize ?? null }
  if (type === 'activity') card.activity = activityInfo(doc, now)
  const first = relIds(doc.photos).map((id) => l.photos.get(id)).find(Boolean)
  if (first) card.photo = first
  return card
}

async function toCards(payload: Payload, docs: Contribution[], now = new Date()): Promise<Card[]> {
  if (!docs.length) return []
  const l = await lookups(payload, docs)
  return docs.map((doc) => toCard(doc, l, now))
}

export type ListFilters = {
  type?: ContributionType
  destinationId?: string | null
  topicId?: string | null
  authorId?: string | null
  style?: string | null
  /** Questions: only those with no approved answer yet, still open, or resolved. */
  question?: 'unanswered' | 'open' | 'resolved' | null
  /** Activities: upcoming (default for activity lists) or past. */
  when?: 'upcoming' | 'past' | null
  /** Activities that overlap this period (UTC instants). */
  from?: Date | null
  to?: Date | null
  ids?: string[]
  page?: number
  pageSize?: number
  now?: Date
}

/** The `where` for upcoming activities, evaluated against the clock rather than a stored flag. */
export function upcomingWhere(now: Date): Where {
  const assumedStart = new Date(now.getTime() - 4 * 3_600_000).toISOString()
  return {
    and: [
      { 'activity.eventStatus': { not_in: ['cancelled', 'ended'] } },
      {
        or: [
          { 'activity.eventStatus': { equals: 'postponed' } },
          { 'activity.endsAt': { greater_than: now.toISOString() } },
          { and: [{ 'activity.endsAt': { exists: false } }, { 'activity.startsAt': { greater_than: assumedStart } }] },
        ],
      },
    ],
  }
}

/** Approved contributions, newest first (activities: soonest first), in stable pages. */
export async function listPublished(filters: ListFilters = {}): Promise<Page<Card>> {
  const payload = await cms()
  const now = filters.now ?? new Date()
  const and: Where[] = [PUBLISHED]
  if (filters.type) and.push({ type: { equals: filters.type } })
  if (filters.destinationId && isUuid(filters.destinationId)) and.push({ destinationTree: { equals: filters.destinationId } })
  if (filters.topicId && isUuid(filters.topicId)) and.push({ topics: { equals: filters.topicId } })
  if (filters.authorId && isUuid(filters.authorId)) and.push({ author: { equals: filters.authorId } })
  if (filters.style) and.push({ style: { equals: filters.style } })
  if (filters.ids) and.push({ id: { in: filters.ids.length ? filters.ids : ['00000000-0000-0000-0000-000000000000'] } })
  if (filters.type === 'question' && filters.question === 'unanswered') and.push({ replyCount: { equals: 0 } })
  if (filters.type === 'question' && filters.question === 'open') and.push({ 'question.resolved': { not_equals: true } })
  if (filters.type === 'question' && filters.question === 'resolved') and.push({ 'question.resolved': { equals: true } })
  let sort: string[] = ['-publishedAt', 'id']
  if (filters.type === 'activity') {
    if (filters.when === 'past') {
      and.push({ 'activity.eventStatus': { not_equals: 'cancelled' } }, { or: [{ 'activity.endsAt': { less_than_equal: now.toISOString() } }, { 'activity.eventStatus': { equals: 'ended' } }] })
      sort = ['-activity.startsAt', 'id']
    } else {
      if (filters.when !== null) and.push(upcomingWhere(now))
      sort = ['activity.startsAt', 'id']
    }
    // Overlap, not "starts inside": an event that began before the period and is still running counts.
    if (filters.to) and.push({ 'activity.startsAt': { less_than: filters.to.toISOString() } })
    if (filters.from) and.push({ or: [{ 'activity.endsAt': { greater_than_equal: filters.from.toISOString() } }, { and: [{ 'activity.endsAt': { exists: false } }, { 'activity.startsAt': { greater_than_equal: filters.from.toISOString() } }] }] })
  }
  const pageSize = Math.min(Math.max(filters.pageSize ?? LIMITS.pageSize, 1), 50)
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const found = await payload.find({ collection: 'contributions', where: { and }, sort, limit: pageSize, page, depth: 0, overrideAccess: false })
  return { items: await toCards(payload, found.docs, now), page: found.page ?? page, totalPages: found.totalPages, total: found.totalDocs }
}

/** One approved contribution by its stable id, with everything the public page shows. */
export async function getPublished(shortId: string, now = new Date()): Promise<Detail | null> {
  if (!/^[a-z0-9]{6,16}$/.test(shortId)) return null
  const payload = await cms()
  const found = await payload.find({ collection: 'contributions', where: { and: [{ shortId: { equals: shortId } }, PUBLISHED] }, limit: 1, depth: 0, overrideAccess: false })
  const doc = found.docs[0]
  if (!doc) return null
  const l = await lookups(payload, [doc], { allPhotos: true })
  const card = toCard(doc, l, now)
  const topicIds = relIds(doc.topics)
  const topics = topicIds.length ? (await payload.find({ collection: 'topics', where: { id: { in: topicIds } }, limit: topicIds.length, pagination: false, depth: 0, overrideAccess: false, select: { name: true, slug: true } })).docs.map((t) => ({ name: t.name, slug: t.slug })) : []
  const detail: Detail = { ...card, body: doc.body ?? '', language: doc.language ?? 'en', indexing: doc.indexing ?? 'policy', topics, photos: relIds(doc.photos).map((id) => l.photos.get(id)).filter((p): p is Photo => Boolean(p)) }

  if (doc.type === 'question') {
    const q = doc.question ?? {}
    let duplicateOf: { title: string; path: string } | null = null
    const duplicateId = relId(q.duplicateOf)
    if (duplicateId) {
      const other = await payload.find({ collection: 'contributions', where: { and: [{ id: { equals: duplicateId } }, PUBLISHED] }, limit: 1, depth: 0, overrideAccess: false })
      if (other.docs[0]) duplicateOf = { title: other.docs[0].title, path: contributionPath(other.docs[0]) }
    }
    detail.questionDetail = { travelMonth: q.travelMonth ?? null, durationDays: q.durationDays ?? null, partyType: q.partyType ?? null, budgetMinor: q.budgetMinor ?? null, budgetCurrency: q.budgetCurrency ?? null, acceptedAnswerId: relId(q.acceptedAnswer), duplicateOf }
  }
  if (doc.type === 'trip') {
    const t = doc.trip ?? {}
    const costs = (doc.tripCosts ?? []).map((c) => ({ category: c.category, amountMinor: c.amountMinor, currency: c.currency, basis: c.basis ?? 'total', quantity: c.quantity ?? 1, date: c.date ?? null, kind: c.kind ?? 'measured', note: c.note ?? '' }))
    detail.tripDetail = {
      nights: t.nights ?? null, partyType: t.partyType ?? null, costScope: t.costScope ?? null, flightsIncluded: Boolean(t.flightsIncluded), costNotes: t.costNotes ?? '',
      transport: t.transport ?? '', recommendations: t.recommendations ?? '', mistakes: t.mistakes ?? '',
      costs, totals: totalsByCurrency(costs), hasEstimates: costs.some((c) => c.kind === 'estimate'),
      days: (doc.itineraryDays ?? []).map((d) => ({
        title: d.title ?? '', date: d.date ?? null,
        stops: (d.stops ?? []).map((s) => ({ title: s.title, place: s.place ?? '', timeNote: s.timeNote ?? '', costMinor: s.costMinor ?? null, costCurrency: s.costCurrency ?? null, description: s.description ?? '', destination: l.places.get(relId(s.destination) ?? '') ?? null })),
      })),
    }
  }
  return detail
}

/**
 * For an address that no longer shows a post: tell "this was published and has been taken down"
 * (answer 410 Gone) apart from "this never existed publicly" (answer 404).
 */
export async function wasPublished(shortId: string): Promise<boolean> {
  if (!/^[a-z0-9]{6,16}$/.test(shortId)) return false
  const payload = await cms()
  const found = await payload.find({ collection: 'contributions', where: { and: [{ shortId: { equals: shortId } }, { state: { in: ['hidden', 'removed'] } }, { publishedAt: { exists: true } }] }, limit: 1, depth: 0, select: {} })
  return found.totalDocs > 0
}

export type GuideLink = { title: string; path: string; excerpt: string }

/** Published editorial guides for a destination. These are staff articles, shown apart from member posts. */
export async function guidesForDestination(destinationId: string, max = 4): Promise<GuideLink[]> {
  const payload = await cms()
  const found = await payload.find({
    collection: 'articles',
    where: { or: [{ primaryDestination: { equals: destinationId } }, { additionalDestinations: { equals: destinationId } }] },
    sort: '-firstPublishedAt', limit: max, depth: 0, draft: false, overrideAccess: false, select: { title: true, slug: true, excerpt: true },
  })
  return found.docs.map((a) => ({ title: a.title, path: `/stories/${a.slug}`, excerpt: a.excerpt }))
}

export async function cardsByIds(ids: string[]): Promise<Card[]> {
  const valid = ids.filter(isUuid)
  if (!valid.length) return []
  const payload = await cms()
  const found = await payload.find({ collection: 'contributions', where: { and: [{ id: { in: valid } }, PUBLISHED] }, limit: valid.length, pagination: false, depth: 0, overrideAccess: false })
  const cards = await toCards(payload, found.docs)
  const order = new Map(valid.map((id, i) => [id, i]))
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

/** Counts of approved posts for a destination hub, by type. */
export async function countsForDestination(destinationId: string, now = new Date()): Promise<{ questions: number; trips: number; activities: number }> {
  const payload = await cms()
  const base = (type: ContributionType): Where[] => [PUBLISHED, { type: { equals: type } }, { destinationTree: { equals: destinationId } }]
  const [questions, trips, activities] = await Promise.all([
    payload.count({ collection: 'contributions', where: { and: base('question') }, overrideAccess: false }),
    payload.count({ collection: 'contributions', where: { and: base('trip') }, overrideAccess: false }),
    payload.count({ collection: 'contributions', where: { and: [...base('activity'), upcomingWhere(now)] }, overrideAccess: false }),
  ])
  return { questions: questions.totalDocs, trips: trips.totalDocs, activities: activities.totalDocs }
}
