import type { Payload } from 'payload'

import type { Destination } from '../../payload-types'
import { listPublished, type Card } from '../community/queries'
import type { Month, MonthRating } from '../content/destinationFacts'
import type { DestinationPage, Fact } from '../content/destinations'
import type { Story } from '../content/stories'
import type { UpdateView } from '../content/updates'
import { evenSplit, tripWindow, type PlannerInput } from './input'

/**
 * Everything the Trip Planner shows for a set of inputs, read from content Travel Notes already
 * publishes. Nothing here is generated or guessed:
 *
 * - "When you're going" comes from the months an editor rated on the destination page.
 * - "Before you go" lists only facts an editor published with an official source (entry rules,
 *   government advice, health, emergency number) and the travel updates that apply now.
 * - Ideas are published guides, approved trip reports and questions, and activities on the dates.
 *
 * When Travel Notes has nothing checked for a place, the planner says so rather than filling the gap.
 */

/** Fact kinds a traveller may act on; they are only published with an official source. */
const CHECK_KINDS = ['visa', 'advice', 'health', 'emergency']
/** Everyday facts worth a glance while planning. */
const HANDY_KINDS = ['currency', 'plugs', 'driving', 'water', 'tipping', 'language']

const IDEAS = { guides: 4, trips: 3, questions: 3, activities: 6 } as const

export type PlannerPlace = {
  id: string
  name: string
  label: string
  path: string
  kind: string
  summary: string
  days: number
  /** The country this place is in (the place itself for a country). */
  countryId: string | null
  timeZone: { name: string; offset: string } | null
  timeNeeded: string | null
  goodFor: string | null
  /** The editor's rating for each month of the trip, or null when no months have been rated yet. */
  timing: { month: Month; rating: MonthRating }[] | null
  bestRange: string
  whenToGo: string | null
  guides: Story[]
  guideTotal: number
  trips: Card[]
  questions: Card[]
  activities: Card[]
}

export type PlannerCountry = {
  id: string
  name: string
  path: string
  isoCode: string | null
  checks: Fact[]
  handy: Fact[]
  checkedAt: string | null
}

export type PlannerResult = {
  places: PlannerPlace[]
  countries: PlannerCountry[]
  /** Travel updates that still apply to any place on the trip, newest first, each once. */
  updates: UpdateView[]
  /** Chosen ids that are not (or no longer) published destinations. */
  missing: number
}

type PageLoader = (doc: Destination) => Promise<DestinationPage>

const visitor = { draft: false, overrideAccess: false } as const

async function publishedDestinations(payload: Payload, ids: string[]): Promise<Destination[]> {
  if (!ids.length) return []
  const found = await payload.find({ collection: 'destinations', where: { id: { in: ids } }, limit: ids.length, pagination: false, depth: 1, ...visitor })
  const byId = new Map(found.docs.map((d) => [d.id, d]))
  return ids.map((id) => byId.get(id)).filter((d): d is Destination => Boolean(d))
}

function timingFor(page: DestinationPage, months: Month[]): PlannerPlace['timing'] {
  if (!page.planning.months) return null
  if (!months.length) return null
  const rated = new Map(page.planning.months.map((m) => [m.month, m.rating]))
  return months.map((month) => ({ month, rating: rated.get(month) ?? 'other' }))
}

export async function loadPlanner(
  payload: Payload,
  input: PlannerInput,
  options: { pageFor: PageLoader; months: Month[]; community: boolean; now?: Date },
): Promise<PlannerResult> {
  const docs = await publishedDestinations(payload, input.placeIds)
  const missing = input.placeIds.length - docs.length
  // Days follow the places that still exist; a removed place's days go to the others evenly.
  const split = docs.length === input.placeIds.length ? input.split : evenSplit(Math.max(input.days, docs.length), docs.length)

  const pages = await Promise.all(docs.map((d) => options.pageFor(d)))
  const window = tripWindow(input)

  const countryIds = [...new Set(docs.map((d, i) => (d.kind === 'country' ? d.id : pages[i].ancestors.find((a) => a.kind === 'country')?.id ?? null)).filter((id): id is string => Boolean(id)))]
  const countryDocs = await publishedDestinations(payload, countryIds)
  const countryPages = await Promise.all(countryDocs.map((d) => (docs.some((x) => x.id === d.id) ? pages[docs.findIndex((x) => x.id === d.id)] : options.pageFor(d))))

  const places = await Promise.all(
    docs.map(async (doc, i): Promise<PlannerPlace> => {
      const page = pages[i]
      const countryId = doc.kind === 'country' ? doc.id : page.ancestors.find((a) => a.kind === 'country')?.id ?? null
      const [trips, questions, activities] = options.community
        ? await Promise.all([
            listPublished({ type: 'trip', destinationId: doc.id, pageSize: IDEAS.trips, now: options.now }),
            listPublished({ type: 'question', destinationId: doc.id, pageSize: IDEAS.questions, now: options.now }),
            // Activities only when there are dates to match them to.
            window ? listPublished({ type: 'activity', destinationId: doc.id, from: window.from, to: window.to, pageSize: IDEAS.activities, now: options.now }) : null,
          ])
        : [null, null, null]
      return {
        id: doc.id,
        name: page.place.name,
        label: page.ancestors.length ? `${page.place.name}, ${page.ancestors[0].name}` : page.place.name,
        path: page.place.path,
        kind: page.place.kind,
        summary: page.place.summary,
        days: split[i] ?? 0,
        countryId,
        timeZone: page.planning.timeZone,
        timeNeeded: page.planning.timeNeeded,
        goodFor: page.planning.goodFor,
        timing: timingFor(page, options.months),
        bestRange: page.planning.bestRange,
        whenToGo: page.planning.whenToGo,
        guides: page.guides.slice(0, IDEAS.guides),
        guideTotal: page.guideTotal,
        trips: trips?.items ?? [],
        questions: questions?.items ?? [],
        activities: activities?.items ?? [],
      }
    }),
  )

  const countries = countryDocs.map((doc, i): PlannerCountry => {
    const planning = countryPages[i].planning
    return {
      id: doc.id,
      name: doc.name,
      path: doc.path ?? doc.slug,
      isoCode: doc.isoCountryCode ?? null,
      checks: planning.facts.filter((f) => CHECK_KINDS.includes(f.kind) && f.source),
      handy: planning.facts.filter((f) => HANDY_KINDS.includes(f.kind)),
      checkedAt: planning.factsCheckedAt,
    }
  })

  const seen = new Set<string>()
  const updates = [...pages, ...countryPages]
    .flatMap((p) => p.updates)
    .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
    .sort((a, b) => (b.updated ?? b.firstPublished).localeCompare(a.updated ?? a.firstPublished))

  return { places, countries, updates, missing }
}

/** "Best", "Good" or "Check conditions" for a set of months, worst first, for a one-line summary. */
export function timingSummary(timing: NonNullable<PlannerPlace['timing']>): MonthRating {
  if (timing.some((t) => t.rating === 'other')) return 'other'
  if (timing.some((t) => t.rating === 'good')) return 'good'
  return 'best'
}

