import type { Payload } from 'payload'

import type { PriceCheck as PriceCheckDoc } from '../../payload-types'
import type { PriceCheck, PriceFinder } from './budget'
import type { Basis, CostItem, PriceKind } from './costs'

const rel = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : null)
const cents = (dollars: number | null | undefined): number | null => (typeof dollars === 'number' && Number.isFinite(dollars) ? Math.round(dollars * 100) : null)

export function toPriceCheck(doc: PriceCheckDoc, placeName: string): PriceCheck {
  const low = cents(doc.amount) ?? 0
  const childLow = cents(doc.childAmount)
  return {
    id: doc.id,
    item: doc.item as CostItem,
    name: doc.name ?? '',
    placeId: rel(doc.destination) ?? '',
    placeName,
    toPlaceId: rel(doc.toDestination),
    lowCents: low,
    highCents: Math.max(low, cents(doc.amountHigh) ?? low),
    childLowCents: childLow,
    childHighCents: childLow === null ? null : Math.max(childLow, cents(doc.childAmountHigh) ?? childLow),
    childMaxAge: doc.childMaxAge ?? null,
    freeUnderAge: doc.freeUnderAge ?? null,
    currency: doc.currency,
    basis: doc.basis as Basis,
    kind: doc.kind as PriceKind,
    sourceName: doc.sourceName,
    sourceUrl: doc.sourceUrl,
    checkedAt: doc.checkedAt,
    includes: doc.includes ?? '',
    excludes: doc.excludes ?? '',
    bookingUrl: doc.bookingUrl ?? null,
    method: doc.method === 'ai_research' ? 'ai_research' : 'editor',
    quote: doc.quote ?? '',
    fx: null,
  }
}

/** Each place followed by its parents (city → region → country), read from published destinations. */
async function chains(payload: Payload, placeIds: string[]): Promise<{ chain: Map<string, string[]>; names: Map<string, string> }> {
  const names = new Map<string, string>()
  const parents = new Map<string, string | null>()
  let todo = [...new Set(placeIds)]
  for (let depth = 0; depth < 5 && todo.length; depth++) {
    const found = await payload.find({ collection: 'destinations', where: { id: { in: todo } }, limit: todo.length, pagination: false, depth: 0, draft: false, select: { name: true, parent: true } })
    for (const d of found.docs) {
      names.set(d.id, d.name)
      parents.set(d.id, rel(d.parent))
    }
    todo = found.docs.map((d) => rel(d.parent)).filter((id): id is string => Boolean(id) && !parents.has(id!))
  }
  const chain = new Map<string, string[]>()
  for (const id of placeIds) {
    const ids: string[] = []
    let cur: string | null = id
    while (cur && !ids.includes(cur) && ids.length < 5) {
      ids.push(cur)
      cur = parents.get(cur) ?? null
    }
    chain.set(id, ids)
  }
  return { chain, names }
}

/**
 * Load the price checks in use for a trip's places (and their regions and countries), and return a
 * finder that picks the closest one: the place's own price first, then its region, then its country.
 * Among equals, the most recently checked wins.
 */
export async function loadPriceFinder(payload: Payload, placeIds: string[]): Promise<{ find: PriceFinder; count: number; checks: PriceCheck[]; byId: (id: string) => PriceCheck | null }> {
  if (!placeIds.length) return { find: () => null, count: 0, checks: [], byId: () => null }
  const { chain, names } = await chains(payload, placeIds)
  const all = [...new Set([...chain.values()].flat())]
  const found = await payload.find({ collection: 'price-checks', where: { and: [{ destination: { in: all } }, { status: { equals: 'active' } }] }, limit: 2000, pagination: false, depth: 0, sort: '-checkedAt' })
  const rates = await freshRates(payload)
  const checks = found.docs.map((d) => toAud(toPriceCheck(d, names.get(rel(d.destination) ?? '') ?? ''), rates))
  const find: PriceFinder = (item, placeId, match) => {
    for (const id of chain.get(placeId) ?? [placeId]) {
      const hit = checks.find((c) => c.item === item && c.placeId === id
        && (!match?.toPlaceId || c.toPlaceId === match.toPlaceId)
        && (!match?.name || c.name.toLowerCase() === match.name.toLowerCase()))
      if (hit) return hit
    }
    return null
  }
  return { find, count: checks.length, checks, byId: (id) => checks.find((c) => c.id === id) ?? null }
}

/** Exchange rates older than this are not used. */
export const RATE_MAX_AGE_DAYS = 30

export type Rate = { currency: string; perAud: number; sourceName: string; sourceUrl: string; checkedAt: string }

export async function freshRates(payload: Payload, now = new Date()): Promise<Map<string, Rate>> {
  const since = new Date(now.getTime() - RATE_MAX_AGE_DAYS * 24 * 3600 * 1000).toISOString()
  const found = await payload.find({ collection: 'exchange-rates', where: { checkedAt: { greater_than_equal: since } }, limit: 200, pagination: false, depth: 0 })
  return new Map(found.docs.map((r) => [r.currency, { currency: r.currency, perAud: r.perAud, sourceName: r.sourceName, sourceUrl: r.sourceUrl, checkedAt: r.checkedAt }]))
}

/**
 * Show a price in another currency in A$, at a sourced rate. Without a fresh rate the price stays in
 * its own currency, and the budget shows it as "price unavailable" rather than guessing.
 */
export function toAud(p: PriceCheck, rates: Map<string, Rate>): PriceCheck {
  if (p.currency === 'AUD') return p
  const rate = rates.get(p.currency)
  if (!rate || !(rate.perAud > 0)) return p
  const conv = (minor: number | null) => (minor === null ? null : Math.round(minor / rate.perAud))
  return {
    ...p,
    currency: 'AUD',
    lowCents: conv(p.lowCents)!,
    highCents: conv(p.highCents)!,
    childLowCents: conv(p.childLowCents),
    childHighCents: conv(p.childHighCents),
    fx: { currency: p.currency, perAud: rate.perAud, lowMinor: p.lowCents, highMinor: p.highCents, sourceName: rate.sourceName, sourceUrl: rate.sourceUrl, checkedAt: rate.checkedAt },
  }
}
