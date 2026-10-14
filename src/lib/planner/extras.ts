import type { Payload } from 'payload'

import type { CurrencyTotal } from '../community/money'
import { getPublished, listPublished } from '../community/queries'

/**
 * Extra planning help that is worked out from real data, never guessed:
 *
 * - Reported costs are what members wrote in published trip reports, with the month they travelled.
 * - Distances are straight lines between the coordinates of places. Real road or rail journeys are
 *   longer, and travel times are not given because Travel Notes has no checked timetable data.
 */

export type ReportedCost = { title: string; path: string; travelMonth: string | null; nights: number | null; partySize: number | null; costScope: string | null; flightsIncluded: boolean; totals: CurrencyTotal[]; hasEstimates: boolean }

/** Costs from up to three published trip reports about these places, newest first. */
export async function reportedCosts(placeIds: string[], community: boolean): Promise<ReportedCost[]> {
  if (!community || !placeIds.length) return []
  const out: ReportedCost[] = []
  for (const id of placeIds) {
    const page = await listPublished({ type: 'trip', destinationId: id, pageSize: 3 })
    for (const card of page.items) {
      if (out.length >= 3 || out.some((r) => r.path === card.path)) continue
      const d = await getPublished(card.shortId).catch(() => null)
      if (!d?.tripDetail || !d.tripDetail.totals.length) continue
      out.push({
        title: d.title,
        path: d.path,
        travelMonth: d.trip?.travelMonth ?? null,
        nights: d.tripDetail.nights,
        partySize: d.trip?.partySize ?? null,
        costScope: d.tripDetail.costScope,
        flightsIncluded: d.tripDetail.flightsIncluded,
        totals: d.tripDetail.totals,
        hasEstimates: d.tripDetail.hasEstimates,
      })
    }
  }
  return out
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Our rule of thumb from straight-line distance. Shown as a rule of thumb, not as a travel time. */
export const tripType = (km: number): 'day' | 'overnight' => (km <= 150 ? 'day' : 'overnight')

export type Nearby = { id: string; name: string; path: string; km: number; type: 'day' | 'overnight'; fromId: string; fromName: string }
export type PlaceLeg = { from: string; to: string; km: number }

type Located = { id: string; name: string; path: string; latitude: number; longitude: number }

async function located(payload: Payload, ids: string[]): Promise<Located[]> {
  if (!ids.length) return []
  const found = await payload.find({ collection: 'destinations', where: { id: { in: ids } }, limit: ids.length, depth: 0, draft: false, overrideAccess: false, select: { name: true, path: true, slug: true, latitude: true, longitude: true } })
  const byId = new Map(found.docs.map((d) => [d.id, d]))
  return ids
    .map((id) => byId.get(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d && typeof d.latitude === 'number' && typeof d.longitude === 'number'))
    .map((d) => ({ id: d.id, name: d.name, path: d.path ?? d.slug, latitude: d.latitude!, longitude: d.longitude! }))
}

/** Straight-line distances between the places of a trip, in order. */
export async function placeLegs(payload: Payload, placeIds: string[]): Promise<PlaceLeg[]> {
  const places = await located(payload, placeIds)
  const legs: PlaceLeg[] = []
  for (let i = 1; i < places.length; i++) legs.push({ from: places[i - 1].name, to: places[i].name, km: Math.round(distanceKm(places[i - 1], places[i])) })
  return legs
}

/**
 * Larger or featured places within 400 km of each place on the trip, nearest first. Only places
 * with an editor-made page or a population of at least 100,000 are suggested, so the list is not
 * filled with tiny towns.
 */
export async function nearbyPlaces(payload: Payload, placeIds: string[], max = 6): Promise<Nearby[]> {
  const places = await located(payload, placeIds)
  const seen = new Set(placeIds)
  const out: Nearby[] = []
  for (const p of places) {
    const box = { lat: 4, lon: 5 }
    const found = await payload.find({
      collection: 'destinations',
      where: {
        and: [
          { kind: { in: ['city', 'area', 'region'] } },
          { latitude: { greater_than: p.latitude - box.lat } },
          { latitude: { less_than: p.latitude + box.lat } },
          { longitude: { greater_than: p.longitude - box.lon } },
          { longitude: { less_than: p.longitude + box.lon } },
          { or: [{ hubIndexable: { equals: true } }, { population: { greater_than_equal: 100_000 } }] },
        ],
      },
      limit: 60,
      depth: 0,
      draft: false,
      overrideAccess: false,
      select: { name: true, path: true, slug: true, latitude: true, longitude: true },
    })
    for (const d of found.docs) {
      if (seen.has(d.id) || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') continue
      const km = distanceKm(p, { latitude: d.latitude, longitude: d.longitude })
      if (km < 5 || km > 400) continue
      seen.add(d.id)
      out.push({ id: d.id, name: d.name, path: d.path ?? d.slug, km: Math.round(km), type: tripType(km), fromId: p.id, fromName: p.name })
    }
  }
  return out.sort((a, b) => a.km - b.km).slice(0, max)
}
