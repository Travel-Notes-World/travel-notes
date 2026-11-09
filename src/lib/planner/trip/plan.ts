import { cleanLine, cleanText, safeHttpUrl } from '../../community/text'
import { addDays } from './form'

/**
 * The shape of a generated trip, and the checks every AI answer must pass before it is saved.
 *
 * The AI proposes a route and structured day items; it never writes a total. Prices come from a
 * separate research step (see research.ts) as "price facts", each with its source. The budget is
 * then worked out in code (calc.ts) from the selected items and those facts.
 */

export const SLOTS = ['morning', 'afternoon', 'evening'] as const
export type Slot = (typeof SLOTS)[number]
export const SLOT_LABEL: Record<Slot, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
/** Rough minutes available in each part of the day, for the timing warning when items are added. */
export const SLOT_MINUTES: Record<Slot, number> = { morning: 240, afternoon: 300, evening: 240 }

export const ITEM_KINDS = ['activity', 'break', 'transfer', 'travel', 'checkin', 'free_time'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const TRAVEL_MODES = ['walk', 'public_transport', 'taxi', 'car', 'train', 'bus', 'ferry', 'flight', 'none'] as const
export type TravelMode = (typeof TRAVEL_MODES)[number]
export const MODE_LABEL: Record<TravelMode, string> = { walk: 'Walk', public_transport: 'Public transport', taxi: 'Taxi or rideshare', car: 'Car', train: 'Train', bus: 'Bus or coach', ferry: 'Ferry', flight: 'Flight', none: '' }

export type DayKind = 'arrival' | 'full' | 'move' | 'departure' | 'arrival_departure'

export type Base = { name: string; region: string; nights: number; fromDay: number; toDay: number; reason: string; airport: string }

export type PlanItem = {
  id: string
  slot: Slot
  kind: ItemKind
  title: string
  /** The exact named place, for example "Bondi Beach" (not "Bondi"). */
  place: string
  /** Suburb, town or area, for the map link: "Bondi Beach, Sydney NSW". */
  area: string
  minutes: number
  travel: { mode: TravelMode; minutes: number } | null
  reason: string
  /** The price fact this item uses, or null when it costs nothing to do. */
  costKey: string | null
  /** Something to check before going (opening days, season, booking ahead). */
  note: string
  /** Suggested start time, "HH:MM" (24-hour), or "" when not given. */
  start?: string
  /** What the traveller will see or do there, in one or two sentences. */
  desc?: string
}

/** Item kinds that count as a substantive activity (not meals, rest, transport or check-in). */
export const isActivity = (i: Pick<PlanItem, 'kind'>) => i.kind === 'activity'

export type Alternative = PlanItem & { day: number; replaces: string | null; optional: boolean }

export type PlanDay = { day: number; date: string; base: string; overnight: string; kind: DayKind; title: string; items: PlanItem[]; pacingNote?: string }

export const PRICE_TYPES = ['quote', 'published', 'estimate', 'allowance', 'user', 'booking', 'unavailable'] as const
export type PriceType = (typeof PRICE_TYPES)[number]
export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  quote: 'Date-specific quote',
  published: 'Published price',
  estimate: 'Sourced estimate',
  allowance: 'Estimated allowance',
  user: 'Your allowance',
  booking: 'Your booking',
  unavailable: 'Price unavailable',
}

export const CATEGORIES = ['flights', 'intercity', 'transfers', 'accommodation', 'food', 'local_transport', 'activities', 'extras'] as const
export type Category = (typeof CATEGORIES)[number]
export const CATEGORY_LABEL: Record<Category, string> = {
  flights: 'Flights',
  intercity: 'Travel between cities',
  transfers: 'Airport transfers',
  accommodation: 'Accommodation',
  food: 'Meals, coffee and snacks',
  local_transport: 'Local transport',
  activities: 'Tickets and activities',
  extras: 'Optional extras',
}

export const UNITS = ['per_person', 'per_adult', 'per_room_night', 'per_group', 'per_vehicle', 'per_item'] as const
export type Unit = (typeof UNITS)[number]

/** One price, with where it came from. Amounts are in whole units of `currency` (dollars, not cents). */
export type PriceFact = {
  key: string
  label: string
  category: Category
  type: PriceType
  currency: string
  low: number
  high: number
  /** The amount used in the budget, between low and high. */
  working: number
  unit: Unit
  childLow: number | null
  childHigh: number | null
  childMaxAge: number | null
  freeUnderAge: number | null
  familyPass: { amount: number; adults: number; children: number } | null
  vehicleSeats: number | null
  /** How many comparable prices an average or range was worked out from (1 means a single price). */
  sampleSize: number | null
  method: string
  route: string
  inclusions: string
  searchDates: string
  sourceName: string
  sourceUrl: string | null
  checkedAt: string
  assumptions: string
  /** Verified pages for an activity (each one was returned by the web searches). */
  officialUrl?: string | null
  ticketsUrl?: string | null
  hoursUrl?: string | null
  /** For an allowance: the evidence it was derived from, in plain words. */
  basis?: string
}

export type Rate = { currency: string; perAud: number; sourceName: string; sourceUrl: string; checkedAt: string }

export type TripPlan = {
  summary: string
  why: string
  gateway: Gateway
  bases: Base[]
  days: PlanDay[]
  alternatives: Alternative[]
  assumptions: string[]
  checks: string[]
  prices: Record<string, PriceFact>
  rates: Record<string, Rate>
}

/**
 * What the traveller has changed: removed and replaced items, added alternatives, the contingency,
 * and their own allowances (amount per unit, in the trip currency) for costs with no sourced price.
 */
export type Selection = { removed: string[]; replaced: Record<string, string>; added: string[]; contingencyPct: number; allowances?: Record<string, number> }
export const DEFAULT_SELECTION: Selection = { removed: [], replaced: {}, added: [], contingencyPct: 10, allowances: {} }

// ---------------------------------------------------------------------------------------------
// Checking the AI's itinerary answer.

const str = (v: unknown, max: number) => cleanLine(typeof v === 'string' ? v : '', max)
const txt = (v: unknown, max: number) => cleanText(typeof v === 'string' ? v : '', max)
const intIn = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
const keyOf = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().toLowerCase().replace(/[^a-z0-9:@_\-]+/g, '-').slice(0, 80) : ''
  return s.length >= 3 ? s : null
}

function readItem(raw: Record<string, unknown>, id: string): PlanItem | null {
  const title = str(raw.title, 120)
  if (!title) return null
  const travel = raw.travel && typeof raw.travel === 'object' ? (raw.travel as Record<string, unknown>) : null
  const mode = oneOf(travel?.mode, TRAVEL_MODES, 'none')
  return {
    id,
    slot: oneOf(raw.slot, SLOTS, 'morning'),
    kind: oneOf(raw.kind, ITEM_KINDS, 'activity'),
    title,
    place: str(raw.place, 120),
    area: str(raw.area, 160),
    minutes: intIn(raw.minutes, 10, 600, 90),
    travel: mode === 'none' ? null : { mode, minutes: intIn(travel?.minutes, 0, 900, 0) },
    reason: txt(raw.reason, 300),
    costKey: keyOf(raw.costKey),
    note: txt(raw.note, 300),
    start: typeof raw.start === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.start.trim()) ? raw.start.trim() : '',
    desc: txt(raw.desc, 300),
  }
}

/**
 * Full sightseeing days with fewer than `min` substantive activities. Arrival, departure and move
 * days are not counted, and a relaxed trip needs two (it explains the lighter day instead).
 */
export function activityShortfall(days: { day: number; kind: DayKind; items: Pick<PlanItem, 'kind'>[] }[], pace: 'relaxed' | 'balanced' | 'full'): { day: number; count: number; min: number }[] {
  const min = pace === 'relaxed' ? 2 : 3
  return days.filter((d) => d.kind === 'full').map((d) => ({ day: d.day, count: d.items.filter(isActivity).length, min })).filter((d) => d.count < min)
}

export type CostNeed = { key: string; label: string; category: Category; unit: Unit; detail: string }

/** How the traveller reaches the destination: whether a flight is needed, and from and to which airports. */
export type Gateway = { needsFlight: boolean; arrivalAirport: string; departureAirport: string; note: string }

export type ItineraryAnswer = { summary: string; why: string; gateway: Gateway; bases: Base[]; days: PlanDay[]; alternatives: Alternative[]; assumptions: string[]; checks: string[]; costNeeds: CostNeed[] }

/**
 * Check the itinerary answer against the trip: one day per date, in order, each in a known base,
 * with nights per base adding up to the trip's nights. Anything malformed is dropped or repaired;
 * a structurally wrong answer throws so the run is marked failed and can be retried.
 */
/** The costs an answer asks to price, checked and without repeats. */
export function readCostNeeds(list: unknown): CostNeed[] {
  const out: CostNeed[] = []
  const seen = new Set<string>()
  for (const c of Array.isArray(list) ? (list as Record<string, unknown>[]) : []) {
    const key = keyOf(c.key)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, label: str(c.label, 120) || key, category: oneOf(c.category, CATEGORIES, 'activities'), unit: oneOf(c.unit, UNITS, 'per_person'), detail: txt(c.detail, 300) })
  }
  return out
}

/** Items in day order: by part of the day, then by start time when given. */
export const byTime = (a: PlanItem, b: PlanItem) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || (a.start || '99').localeCompare(b.start || '99')

export function readItinerary(text: string, trip: { arrive: string; days: number }): ItineraryAnswer {
  let raw: Record<string, unknown>
  try { raw = JSON.parse(text) as Record<string, unknown> } catch { throw new Error('The itinerary answer was not valid JSON.') }
  if (!raw || !Array.isArray(raw.days) || !Array.isArray(raw.bases)) throw new Error('The itinerary answer had no days or route.')

  const bases: Base[] = (raw.bases as Record<string, unknown>[]).slice(0, 8).map((b) => ({
    name: str(b.name, 80), region: str(b.region, 80), nights: intIn(b.nights, 0, 30, 0), fromDay: intIn(b.fromDay, 1, 60, 1), toDay: intIn(b.toDay, 1, 60, 1), reason: txt(b.reason, 300), airport: str(b.airport, 80),
  })).filter((b) => b.name)
  if (!bases.length) throw new Error('The itinerary answer had no bases.')
  const nights = bases.reduce((a, b) => a + b.nights, 0)
  if (nights !== Math.max(0, trip.days - 1)) throw new Error(`The route's nights (${nights}) do not match the trip (${trip.days - 1}).`)

  const byDay = new Map<number, Record<string, unknown>>()
  for (const d of raw.days as Record<string, unknown>[]) {
    const n = intIn(d.day, 0, 99, 0)
    if (n >= 1 && n <= trip.days && !byDay.has(n)) byDay.set(n, d)
  }
  if (byDay.size !== trip.days) throw new Error(`The itinerary answer covered ${byDay.size} of ${trip.days} days.`)
  const baseNames = new Set(bases.map((b) => b.name.toLowerCase()))
  const days: PlanDay[] = []
  for (let n = 1; n <= trip.days; n++) {
    const d = byDay.get(n)!
    const items = (Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : []).slice(0, 12).map((it, i) => readItem(it, `d${n}-${i + 1}`)).filter((x): x is PlanItem => Boolean(x))
    const base = str(d.base, 80)
    const known = [...baseNames].includes(base.toLowerCase()) ? bases.find((b) => b.name.toLowerCase() === base.toLowerCase())!.name : bases[0].name
    const kind: DayKind = trip.days === 1 ? 'arrival_departure' : n === 1 ? 'arrival' : n === trip.days ? 'departure' : oneOf(d.kind, ['full', 'move'] as const, 'full')
    days.push({ day: n, date: addDays(trip.arrive, n - 1), base: known, overnight: n === trip.days ? '' : str(d.overnight, 80) || known, kind, title: str(d.title, 80), items: items.sort(byTime), pacingNote: txt(d.pacingNote, 240) })
  }

  const ids = new Set(days.flatMap((d) => d.items.map((i) => i.id)))
  const alternatives: Alternative[] = (Array.isArray(raw.alternatives) ? (raw.alternatives as Record<string, unknown>[]) : []).slice(0, trip.days * 4).flatMap((a, i) => {
    const item = readItem(a, `alt-${i + 1}`)
    const day = intIn(a.day, 0, 99, 0)
    if (!item || day < 1 || day > trip.days) return []
    const replaces = typeof a.replaces === 'string' && ids.has(a.replaces) ? a.replaces : null
    return [{ ...item, day, replaces, optional: a.optional === true }]
  })

  const costNeeds = readCostNeeds(raw.costNeeds)

  const g = raw.gateway && typeof raw.gateway === 'object' ? (raw.gateway as Record<string, unknown>) : {}
  return {
    summary: txt(raw.summary, 600),
    why: txt(raw.why, 800),
    gateway: { needsFlight: g.needsFlight !== false, arrivalAirport: str(g.arrivalAirport, 80), departureAirport: str(g.departureAirport, 80), note: txt(g.note, 240) },
    bases,
    days,
    alternatives,
    assumptions: (Array.isArray(raw.assumptions) ? raw.assumptions : []).slice(0, 10).map((s) => txt(s, 240)).filter(Boolean),
    checks: (Array.isArray(raw.checks) ? raw.checks : []).slice(0, 8).map((s) => txt(s, 240)).filter(Boolean),
    costNeeds,
  }
}

// ---------------------------------------------------------------------------------------------
// Checking the price research answer.

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null)
const normUrl = (u: string) => u.trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()

/**
 * Turn the research answer into price facts. A fact is kept only when:
 * - its source address is one of the pages the web searches actually returned,
 * - its numbers are sensible (low ≤ working ≤ high, high at most eight times low),
 * - an "average" names how many comparable prices it came from; one price is labelled as one price.
 * Anything else becomes "unavailable" for that key, so the budget shows it as missing.
 */
export function readPrices(raw: unknown, allowedSources: { url: string; title: string }[], needs: CostNeed[], checkedAt: string): { prices: Record<string, PriceFact>; rates: Record<string, Rate> } {
  const allowed = new Map(allowedSources.map((s) => [normUrl(s.url), s]))
  const source = (u: unknown): { url: string; title: string } | null => {
    const url = safeHttpUrl(u)
    if (!url || !url.startsWith('https://')) return null
    const hit = allowed.get(normUrl(url))
    return hit ? { url, title: hit.title } : null
  }
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(obj.prices) ? (obj.prices as Record<string, unknown>[]) : []
  const prices: Record<string, PriceFact> = {}
  for (const need of needs) {
    const f = list.find((p) => keyOf(p.key) === need.key)
    const base: PriceFact = {
      key: need.key, label: need.label, category: need.category, type: 'unavailable', currency: 'AUD', low: 0, high: 0, working: 0, unit: need.unit,
      childLow: null, childHigh: null, childMaxAge: null, freeUnderAge: null, familyPass: null, vehicleSeats: null, sampleSize: null,
      method: '', route: need.detail, inclusions: '', searchDates: '', sourceName: '', sourceUrl: null, checkedAt, assumptions: '',
    }
    if (!f) { prices[need.key] = base; continue }
    const src = source(f.sourceUrl)
    const currency = typeof f.currency === 'string' && /^[A-Z]{3}$/.test(f.currency) ? f.currency : null
    const free = f.free === true
    const low = free ? 0 : num(f.low)
    const high = free ? 0 : num(f.high) ?? low
    const working = free ? 0 : num(f.working) ?? (low !== null && high !== null ? (low + high) / 2 : null)
    const type = oneOf(f.type, ['quote', 'published', 'estimate'] as const, 'estimate')
    const sample = num(f.sampleSize)
    const sane = low !== null && high !== null && working !== null && low >= 0 && low <= working && working <= high && (low === 0 || high <= low * 8) && high < 10_000_000
    if (!src || !currency || !sane) { prices[need.key] = { ...base, assumptions: src ? 'The price found did not pass our checks.' : '' }; continue }
    const fp = f.familyPass && typeof f.familyPass === 'object' ? (f.familyPass as Record<string, unknown>) : null
    const childLow = num(f.childLow)
    prices[need.key] = {
      ...base,
      type: free ? 'published' : type,
      currency,
      low: low!, high: high!, working: working!,
      unit: oneOf(f.unit, UNITS, need.unit),
      childLow: childLow !== null && childLow >= 0 && childLow <= high! ? childLow : null,
      childHigh: childLow !== null ? Math.max(childLow, num(f.childHigh) ?? childLow) : null,
      childMaxAge: num(f.childMaxAge) !== null && num(f.childMaxAge)! <= 17 ? Math.round(num(f.childMaxAge)!) : null,
      freeUnderAge: num(f.freeUnderAge) !== null && num(f.freeUnderAge)! <= 18 ? Math.round(num(f.freeUnderAge)!) : null,
      familyPass: fp && num(fp.amount) !== null && num(fp.amount)! > 0 ? { amount: num(fp.amount)!, adults: intIn(fp.adults, 1, 4, 2), children: intIn(fp.children, 0, 6, 2) } : null,
      vehicleSeats: num(f.vehicleSeats) !== null ? intIn(f.vehicleSeats, 1, 12, 4) : null,
      sampleSize: sample !== null && sample >= 1 ? Math.round(sample) : 1,
      method: txt(f.method, 300),
      route: txt(f.route, 200) || need.detail,
      inclusions: txt(f.inclusions, 240),
      searchDates: str(f.searchDates, 80),
      sourceName: str(f.sourceName, 120) || src.title.slice(0, 120) || new URL(src.url).hostname,
      sourceUrl: src.url,
      assumptions: txt(f.assumptions, 300),
      // Activity pages are kept only when the searches returned them, like the price source.
      officialUrl: source(f.officialUrl)?.url ?? null,
      ticketsUrl: source(f.ticketsUrl)?.url ?? null,
      hoursUrl: source(f.hoursUrl)?.url ?? null,
    }
  }
  const rates: Record<string, Rate> = {}
  for (const r of Array.isArray(obj.rates) ? (obj.rates as Record<string, unknown>[]) : []) {
    const currency = typeof r.currency === 'string' && /^[A-Z]{3}$/.test(r.currency) ? r.currency : null
    const perAud = num(r.perAud)
    const src = source(r.sourceUrl)
    if (!currency || currency === 'AUD' || !src || perAud === null || perAud <= 0.0001 || perAud > 1_000_000) continue
    rates[currency] = { currency, perAud, sourceName: str(r.sourceName, 120) || src.title.slice(0, 120), sourceUrl: src.url, checkedAt }
  }
  return { prices, rates }
}

/** How a price fact is described to the traveller, so a single fare is never called an average. */
export function priceBasisText(f: PriceFact): string {
  if (f.type === 'unavailable') return 'No reliable price found'
  if (f.type === 'booking') return 'Amount you entered'
  if (f.type === 'user') return 'Allowance you entered'
  if (f.type === 'allowance') return f.basis || 'Allowance derived from sourced local prices'
  if (f.type === 'quote') return 'Quote for your dates'
  if (f.type === 'published') return 'Published price'
  if ((f.sampleSize ?? 1) <= 1) return 'Single price found (not an average)'
  return `Range from ${f.sampleSize} comparable prices`
}

/** The price warning shown at the end of every trip plan (page and PDF). */
export const PRICE_WARNING = {
  title: 'Please check prices before you decide',
  text: 'The prices in this plan come from online sources on several websites, such as official attraction pages, booking platforms, menus and travel cost guides. They may not be accurate: prices change, and what you pay can be different. Please check each price with the provider yourself before you book or make a decision. Nothing in this plan has been booked or reserved.',
} as const
