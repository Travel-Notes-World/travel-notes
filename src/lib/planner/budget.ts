import { CATEGORY_LABEL, costItem, people, STAYS, type Basis, type CostCategory, type CostItem, type PriceKind, type TripSetup } from './costs'

/**
 * The trip budget, worked out in code. The AI never writes a number that is added up here.
 *
 * Every line is "quantity × unit price" with its source. A line is one of:
 * - booked: an amount the traveller entered for something already booked (counted once)
 * - priced: from a saved price check (an official price or a sourced local estimate)
 * - unavailable: we have no checked price, so it shows "price unavailable" and is NOT in the total
 *
 * All amounts are whole Australian cents. Price checks in other currencies are not used yet,
 * because Travel Notes has no licensed exchange-rate source; they count as unavailable.
 */

/** A saved, sourced price the budget can use. Amounts in whole cents of `currency`. */
export type PriceCheck = {
  id: string
  item: CostItem
  name: string
  /** The place the price was checked for. It may be a parent of the trip place (a country-wide range). */
  placeId: string
  placeName: string
  toPlaceId: string | null
  lowCents: number
  highCents: number
  childLowCents: number | null
  childHighCents: number | null
  /** Children up to and including this age pay the child price. */
  childMaxAge: number | null
  /** Children younger than this age are free. */
  freeUnderAge: number | null
  currency: string
  basis: Basis
  kind: PriceKind
  sourceName: string
  sourceUrl: string
  checkedAt: string
  includes: string
  excludes: string
  bookingUrl: string | null
}

/** Finds the best saved price for an item at a trip place (the loader falls back to parent places). */
export type PriceFinder = (item: CostItem, placeId: string, match?: { toPlaceId?: string; name?: string }) => PriceCheck | null

export type BudgetDay = { date: string | null; placeId: string }

export type BudgetLine = {
  id: string
  category: CostCategory
  label: string
  /** The day this cost belongs to (0-based), or null for a one-time cost. */
  day: number | null
  /** How the amount is made up, for example "2 adults × A$18–25". */
  quantity: string
  lowCents: number
  highCents: number
  status: 'booked' | 'priced' | 'unavailable'
  paid: boolean
  price: PriceCheck | null
  /** A price checked more than a year ago. Still shown, with a warning. */
  old: boolean
  note: string | null
}

export type Range = { lowCents: number; highCents: number }

export type Budget = {
  people: number
  nights: number
  lines: BudgetLine[]
  byCategory: { category: CostCategory; label: string; lowCents: number; highCents: number; missing: number }[]
  byDay: ({ day: number; date: string | null; placeId: string } & Range)[]
  oneTime: Range
  /** Everything with an amount: booked and priced lines. */
  subtotal: Range
  paid: number
  toPay: Range
  contingencyPercent: number
  contingency: Range
  total: Range
  perPerson: Range
  /** Lines without a checked price. They are listed, never added. */
  unavailable: BudgetLine[]
  budget: { amountCents: number; currency: string; remaining: Range | null } | null
}

const MS_YEAR = 365 * 24 * 3600 * 1000

export const aud = (cents: number) =>
  `A$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
export const audRange = (r: Range) => (r.lowCents === r.highCents ? aud(r.lowCents) : `${aud(r.lowCents)}–${aud(r.highCents)}`)
const unit = (low: number, high: number) => (low === high ? aud(low) : `${aud(low)}–${aud(high)}`)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Split the party into who pays the adult price, the child price and nothing, for a per-person price.
 * Without a child price, children pay the adult price, and the line says so.
 */
function personCost(setup: TripSetup, p: PriceCheck, times = 1): { low: number; high: number; quantity: string; note: string | null } {
  let low = setup.adults * p.lowCents
  let high = setup.adults * p.highCents
  const parts = [`${plural(setup.adults, 'adult')} × ${unit(p.lowCents, p.highCents)}`]
  const free: number[] = []
  const child: number[] = []
  const asAdult: number[] = []
  for (const age of setup.childAges) {
    if (p.freeUnderAge !== null && age < p.freeUnderAge) free.push(age)
    else if (p.childLowCents !== null && (p.childMaxAge === null || age <= p.childMaxAge)) child.push(age)
    else asAdult.push(age)
  }
  if (child.length) {
    low += child.length * p.childLowCents!
    high += child.length * (p.childHighCents ?? p.childLowCents!)
    parts.push(`${plural(child.length, 'child', 'children')} × ${unit(p.childLowCents!, p.childHighCents ?? p.childLowCents!)}`)
  }
  if (asAdult.length) {
    low += asAdult.length * p.lowCents
    high += asAdult.length * p.highCents
    parts.push(`${plural(asAdult.length, 'child', 'children')} (age ${asAdult.join(', ')}) at the adult price`)
  }
  if (free.length) parts.push(`${plural(free.length, 'child', 'children')} free (under ${p.freeUnderAge})`)
  const note = asAdult.length && p.childLowCents === null && setup.childAges.length ? 'No child price was found, so children are counted at the adult price.' : null
  return { low: low * times, high: high * times, quantity: parts.join(' + ') + (times > 1 ? ` × ${times}` : ''), note }
}

/** The meals to count on a day, from arrival and departure times. */
export function mealsFor(setup: TripSetup, day: number, days: number): ('breakfast' | 'lunch' | 'dinner')[] {
  const all = ['breakfast', 'lunch', 'dinner'] as const
  let meals: ('breakfast' | 'lunch' | 'dinner')[] = [...all]
  if (day === 0) meals = setup.arrival === 'morning' ? ['lunch', 'dinner'] : ['dinner']
  if (day === days - 1 && days > 1) meals = setup.departure === 'morning' ? ['breakfast'] : setup.departure === 'afternoon' ? ['breakfast', 'lunch'] : [...all]
  // Breakfast with the room only applies after a night at the accommodation.
  if (setup.breakfastIncluded && day > 0) meals = meals.filter((m) => m !== 'breakfast')
  return meals
}

export function computeBudget(input: {
  setup: TripSetup
  days: BudgetDay[]
  places: { id: string; name: string }[]
  find: PriceFinder
  departFrom?: string
  budget?: { amountCents: number; currency: string } | null
  now?: Date
}): Budget {
  const { setup, days, find } = input
  const now = input.now ?? new Date()
  const n = days.length
  const nights = Math.max(0, n - 1)
  const party = people(setup)
  const nameOf = (id: string) => input.places.find((p) => p.id === id)?.name ?? 'this place'
  const lines: BudgetLine[] = []

  const usable = (p: PriceCheck | null): p is PriceCheck => Boolean(p && p.currency === 'AUD')
  const isOld = (p: PriceCheck) => now.getTime() - new Date(p.checkedAt).getTime() > MS_YEAR
  const priced = (base: Omit<BudgetLine, 'status' | 'paid' | 'old' | 'price' | 'lowCents' | 'highCents' | 'quantity' | 'note'>, p: PriceCheck, cost: { low: number; high: number; quantity: string; note?: string | null }): BudgetLine => ({
    ...base, status: 'priced', paid: false, price: p, lowCents: cost.low, highCents: cost.high, quantity: cost.quantity, note: cost.note ?? null, old: isOld(p),
  })
  const missing = (base: Omit<BudgetLine, 'status' | 'paid' | 'old' | 'price' | 'lowCents' | 'highCents' | 'quantity' | 'note'>, quantity: string, note: string): BudgetLine => ({
    ...base, status: 'unavailable', paid: false, price: null, lowCents: 0, highCents: 0, quantity, note, old: false,
  })
  const noPriceNote = (p: PriceCheck | null) => (p && p.currency !== 'AUD' ? `We only have a price in ${p.currency}. Currency conversion is not available yet.` : 'Travel Notes has no checked price for this yet.')

  // Flights: only the traveller's own booking. Live flight prices are not connected yet.
  if (setup.flights.status === 'booked' && setup.flights.amountCents !== null) {
    lines.push({ id: 'flights', category: 'flights', label: 'Flights (booked)', day: null, quantity: 'Your booking, as you entered it', lowCents: setup.flights.amountCents, highCents: setup.flights.amountCents, status: 'booked', paid: setup.flights.paid, price: null, old: false, note: null })
  } else if (setup.flights.status !== 'not_needed') {
    lines.push(missing({ id: 'flights', category: 'flights', label: `Return flights${input.departFrom ? ` from ${input.departFrom}` : ''}`, day: null }, `${plural(party, 'traveller')}, return`, setup.flights.status === 'booked' ? 'Enter what you paid to add it to the total.' : 'Live flight prices are not connected yet. Add your fare when you book.'))
  }

  // Accommodation: a booked amount once, or each night × rooms from a checked price.
  if (setup.accommodation.status === 'booked' && setup.accommodation.amountCents !== null) {
    lines.push({ id: 'stay', category: 'accommodation', label: 'Accommodation (booked)', day: null, quantity: `Your booking for ${plural(nights, 'night')}, as you entered it`, lowCents: setup.accommodation.amountCents, highCents: setup.accommodation.amountCents, status: 'booked', paid: setup.accommodation.paid, price: null, old: false, note: null })
  } else if (setup.accommodation.status === 'booked') {
    lines.push(missing({ id: 'stay', category: 'accommodation', label: 'Accommodation (booked)', day: null }, plural(nights, 'night'), 'Enter what you paid to add it to the total.'))
  } else if (setup.accommodation.status === 'not_booked') {
    const stay = STAYS.find((s) => s.value === setup.stay)!
    for (let d = 0; d < nights; d++) {
      const p = find(stay.item, days[d].placeId)
      const base = { id: `stay-${d}`, category: 'accommodation' as const, label: `${stay.label.split(' (')[0]}, ${nameOf(days[d].placeId)}`, day: d }
      const quantity = `${plural(setup.rooms, 'room')} × 1 night`
      lines.push(usable(p) ? priced(base, p, { low: setup.rooms * p.lowCents, high: setup.rooms * p.highCents, quantity: `${quantity} × ${unit(p.lowCents, p.highCents)}` }) : missing(base, quantity, noPriceNote(p)))
    }
  }

  // Daily spending.
  for (let d = 0; d < n; d++) {
    const placeId = days[d].placeId
    const items: CostItem[] = [...mealsFor(setup, d, n), 'coffee', 'snacks', 'water', 'local_transport']
    for (const item of items) {
      if (item === 'coffee' && setup.coffees === 0) continue
      const info = costItem(item)!
      const p = find(item, placeId)
      const base = { id: `${item}-${d}`, category: info.category, label: info.label, day: d }
      if (item === 'coffee') {
        const count = setup.adults * setup.coffees
        const quantity = `${plural(count, 'coffee')} (${setup.coffees} a day for each adult)`
        lines.push(usable(p) ? priced(base, p, { low: count * p.lowCents, high: count * p.highCents, quantity: `${quantity} × ${unit(p.lowCents, p.highCents)}` }) : missing(base, quantity, noPriceNote(p)))
        continue
      }
      lines.push(usable(p) ? priced(base, p, personCost(setup, p)) : missing(base, plural(party, 'person', 'people'), noPriceNote(p)))
    }
  }

  // Airport transfers at the start and the end, when the trip includes flights.
  if (setup.flights.status !== 'not_needed' && n > 0) {
    const ends = [{ id: 'transfer-in', placeId: days[0].placeId, label: 'Airport to your accommodation' }, { id: 'transfer-out', placeId: days[n - 1].placeId, label: 'Accommodation to the airport' }]
    for (const end of ends) {
      const p = find('airport_transfer', end.placeId)
      const base = { id: end.id, category: 'transport' as const, label: `${end.label}, ${nameOf(end.placeId)}`, day: null }
      if (!usable(p)) { lines.push(missing(base, plural(party, 'person', 'people'), noPriceNote(p))); continue }
      lines.push(priced(base, p, p.basis === 'group' ? { low: p.lowCents, high: p.highCents, quantity: `1 trip for the group × ${unit(p.lowCents, p.highCents)}` } : personCost(setup, p)))
    }
  }

  // Travel between the places on the trip.
  for (let d = 1; d < n; d++) {
    const from = days[d - 1].placeId
    const to = days[d].placeId
    if (from === to) continue
    const p = find('intercity', from, { toPlaceId: to })
    const base = { id: `intercity-${d}`, category: 'transport' as const, label: `${nameOf(from)} to ${nameOf(to)}`, day: null }
    if (!usable(p)) { lines.push(missing(base, `${plural(party, 'person', 'people')}, one way`, noPriceNote(p))); continue }
    lines.push(priced(base, p, p.basis === 'group' ? { low: p.lowCents, high: p.highCents, quantity: `1 journey for the group × ${unit(p.lowCents, p.highCents)}` } : personCost(setup, p)))
  }

  if (setup.mobileData && n > 0) {
    const p = find('mobile_data', days[0].placeId)
    const base = { id: 'mobile-data', category: 'extras' as const, label: 'Mobile data (SIM or eSIM)', day: null }
    lines.push(usable(p) ? priced(base, p, { low: setup.adults * p.lowCents, high: setup.adults * p.highCents, quantity: `${plural(setup.adults, 'adult')} × ${unit(p.lowCents, p.highCents)}` }) : missing(base, plural(setup.adults, 'adult'), noPriceNote(p)))
  }

  // Totals. Unavailable lines carry 0 and are listed separately, never added.
  const counted = lines.filter((l) => l.status !== 'unavailable')
  const sum = (ls: BudgetLine[]): Range => ({ lowCents: ls.reduce((a, l) => a + l.lowCents, 0), highCents: ls.reduce((a, l) => a + l.highCents, 0) })
  const subtotal = sum(counted)
  const paid = counted.filter((l) => l.paid).reduce((a, l) => a + l.lowCents, 0)
  const toPay = { lowCents: subtotal.lowCents - paid, highCents: subtotal.highCents - paid }
  const pct = setup.contingency
  const contingency = { lowCents: Math.round((toPay.lowCents * pct) / 100), highCents: Math.round((toPay.highCents * pct) / 100) }
  const total = { lowCents: subtotal.lowCents + contingency.lowCents, highCents: subtotal.highCents + contingency.highCents }
  const perPerson = { lowCents: Math.round(total.lowCents / Math.max(1, party)), highCents: Math.round(total.highCents / Math.max(1, party)) }

  const categories = Object.keys(CATEGORY_LABEL) as CostCategory[]
  const byCategory = categories
    .map((category) => ({ category, label: CATEGORY_LABEL[category], ...sum(counted.filter((l) => l.category === category)), missing: lines.filter((l) => l.category === category && l.status === 'unavailable').length }))
    .filter((c) => c.lowCents || c.highCents || c.missing)

  const budget = input.budget
    ? { ...input.budget, remaining: input.budget.currency === 'AUD' ? { lowCents: input.budget.amountCents - total.highCents, highCents: input.budget.amountCents - total.lowCents } : null }
    : null

  return {
    people: party,
    nights,
    lines,
    byCategory,
    byDay: days.map((d, i) => ({ day: i, date: d.date, placeId: d.placeId, ...sum(counted.filter((l) => l.day === i)) })),
    oneTime: sum(counted.filter((l) => l.day === null)),
    subtotal,
    paid,
    toPay,
    contingencyPercent: pct,
    contingency,
    total,
    perPerson,
    unavailable: lines.filter((l) => l.status === 'unavailable'),
    budget,
  }
}
