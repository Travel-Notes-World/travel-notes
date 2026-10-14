import type { Payload } from 'payload'

/**
 * Australian Government travel advice (Smartraveller) for the countries on a trip. The level is
 * typed in by an editor with the date it was checked; the traveller is always sent to
 * Smartraveller for the current advice. Trips inside Australia get no box.
 */

export const SMARTRAVELLER = 'https://www.smartraveller.gov.au'

export const ADVICE_LEVELS = [
  { level: 1, label: 'Exercise normal safety precautions' },
  { level: 2, label: 'Exercise a high degree of caution' },
  { level: 3, label: 'Reconsider your need to travel' },
  { level: 4, label: 'Do not travel' },
] as const

/** An advice check older than this is shown as possibly out of date. */
export const ADVICE_STALE_DAYS = 30

export type AdviceView = {
  countryId: string
  countryName: string
  /** null when Travel Notes has not recorded the level for this country. */
  level: 1 | 2 | 3 | 4 | null
  label: string | null
  note: string
  url: string
  checkedAt: string | null
  stale: boolean
}

export async function adviceFor(payload: Payload, countries: { id: string; name: string; isoCode: string | null }[], now = new Date()): Promise<AdviceView[]> {
  const overseas = countries.filter((c) => c.isoCode !== 'AU' && c.name !== 'Australia')
  if (!overseas.length) return []
  const found = await payload.find({ collection: 'travel-advisories', where: { country: { in: overseas.map((c) => c.id) } }, limit: overseas.length, pagination: false, depth: 0 })
  const byCountry = new Map(found.docs.map((d) => [typeof d.country === 'object' ? d.country.id : d.country, d]))
  return overseas.map((c) => {
    const row = byCountry.get(c.id)
    const level = row ? (Number(row.level) as AdviceView['level']) : null
    return {
      countryId: c.id,
      countryName: c.name,
      level,
      label: level ? ADVICE_LEVELS[level - 1].label : null,
      note: row?.note ?? '',
      url: row?.url ?? `${SMARTRAVELLER}/destinations`,
      checkedAt: row?.checkedAt ?? null,
      stale: row ? now.getTime() - new Date(row.checkedAt).getTime() > ADVICE_STALE_DAYS * 24 * 3600 * 1000 : false,
    }
  })
}

/** The highest level on the trip, or 0 when none is recorded. */
export const highestLevel = (advice: AdviceView[]) => advice.reduce((m, a) => Math.max(m, a.level ?? 0), 0)

/** Paid planning is not offered for a trip to a country at "Do not travel". */
export const DO_NOT_TRAVEL_MESSAGE = 'The Australian Government advises “Do not travel” to a country on this trip, so Travel Notes does not offer a paid plan for it. Read the advice on Smartraveller.'

/** The countries the trip's places are in (a place may itself be a country), in trip order. */
export async function countriesFor(payload: Payload, placeIds: string[]): Promise<{ id: string; name: string; isoCode: string | null }[]> {
  const rel = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : null)
  const docs = new Map<string, { id: string; name: string; kind: string; parent: string | null; iso: string | null }>()
  let todo = [...new Set(placeIds)]
  for (let depth = 0; depth < 5 && todo.length; depth++) {
    const found = await payload.find({ collection: 'destinations', where: { id: { in: todo } }, limit: todo.length, pagination: false, depth: 0, draft: false, select: { name: true, kind: true, parent: true, isoCountryCode: true } })
    for (const d of found.docs) docs.set(d.id, { id: d.id, name: d.name, kind: d.kind, parent: rel(d.parent), iso: d.isoCountryCode ?? null })
    todo = found.docs.map((d) => rel(d.parent)).filter((id): id is string => Boolean(id) && !docs.has(id!))
  }
  const out: { id: string; name: string; isoCode: string | null }[] = []
  for (const id of placeIds) {
    let cur = docs.get(id)
    for (let i = 0; cur && cur.kind !== 'country' && i < 5; i++) cur = cur.parent ? docs.get(cur.parent) : undefined
    if (cur && cur.kind === 'country' && !out.some((c) => c.id === cur!.id)) out.push({ id: cur.id, name: cur.name, isoCode: cur.iso })
  }
  return out
}

/** Advice for the countries of a set of trip places. */
export async function tripAdvice(payload: Payload, placeIds: string[], now = new Date()): Promise<AdviceView[]> {
  return adviceFor(payload, await countriesFor(payload, placeIds), now)
}
