import { minorDigits, roomsFor, travellers, type TripForm } from './form'
import { byTime, CATEGORIES, SLOT_MINUTES, SLOTS, type Alternative, type Category, type CostNeed, type PlanDay, type PlanItem, type PriceFact, type PriceType, type Rate, type Selection, type Slot, type TripPlan } from './plan'

/**
 * The trip budget, worked out in code. The AI proposes items; every number here comes from a price
 * fact (with its source), the traveller's own booking amounts, or arithmetic on those.
 *
 * Money is kept in whole minor units (cents) of the traveller's chosen currency, so totals never
 * drift; it is rounded only for display. Every line is counted once:
 * - one-time costs (flights, travel between cities, airport transfers, accommodation) have day null
 * - daily spending (meals, coffee and snacks, local transport, tickets) belongs to one day
 * The day lines plus the one-time lines plus the contingency always equal the trip total.
 *
 * A required cost with no reliable price is shown as missing and never counts as zero: the total
 * is then marked incomplete and the missing items are listed.
 */

export type LineStatus = 'priced' | 'booking' | 'included' | 'free' | 'unavailable'

export type BudgetLine = {
  id: string
  category: Category
  label: string
  /** Day number (1-based) for daily spending, or null for a one-time cost. */
  day: number | null
  /** How the amount is made up, for example "2 adults × A$45 + 1 child (6) × A$20". */
  quantity: string
  low: number
  high: number
  working: number
  status: LineStatus
  priceType: PriceType | null
  factKey: string | null
  paid: boolean
  optional: boolean
  note: string
  /** For an itinerary item's cost: the day of the item (also set for one-time costs such as a transfer). */
  itemDay?: number
}

export type Budget = {
  currency: string
  lines: BudgetLine[]
  /** Sum of lines with a price (minor units). */
  known: { low: number; high: number; working: number }
  contingencyPct: number
  contingency: { low: number; high: number; working: number }
  total: { low: number; high: number; working: number }
  perPerson: number
  travellers: number
  byCategory: { category: Category; working: number; low: number; high: number; missing: number; unresolved: { key: string | null; label: string; count: number }[]; userAllowance: boolean; allowance: boolean }[]
  byDay: { day: number; working: number; low: number; high: number; missing: number }[]
  oneTime: { working: number; low: number; high: number }
  budget: number | null
  /** Budget minus the working total: positive = left over, negative = over budget. */
  remaining: number | null
  paid: number
  toPay: number
  incomplete: boolean
  missing: { label: string; category: Category; day: number | null; factKey: string | null }[]
  /** True when any line uses an amount the traveller entered as their own allowance. */
  usesUserAllowance: boolean
}

// ---------------------------------------------------------------------------------------------
// Currency.

export function toMinor(amountMajor: number, currency: string): number {
  return Math.round(amountMajor * 10 ** minorDigits(currency))
}

/**
 * Convert an amount between currencies through the Australian dollar, at sourced rates
 * (units of each currency per A$1). Returns null when a rate is missing, so the line is shown as
 * missing rather than guessed.
 */
export function convert(amountMajor: number, from: string, to: string, rates: Record<string, Rate>): number | null {
  if (from === to) return amountMajor
  const perFrom = from === 'AUD' ? 1 : rates[from]?.perAud
  const perTo = to === 'AUD' ? 1 : rates[to]?.perAud
  if (!perFrom || !perTo) return null
  return (amountMajor / perFrom) * perTo
}

/** An amount rounded the way it is displayed (to the dollar, or to $10 from $1,000), in minor units. */
export function displayRound(minor: number, currency: string): number {
  const unit = 10 ** minorDigits(currency)
  const major = minor / unit
  return (Math.abs(major) >= 1000 ? Math.round(major / 10) * 10 : Math.round(major)) * unit
}

export function formatMoney(minor: number, currency: string, options: { round?: boolean } = {}): string {
  const digits = minorDigits(currency)
  const major = minor / 10 ** digits
  const rounded = options.round ? (Math.abs(major) >= 1000 ? Math.round(major / 10) * 10 : Math.round(major)) : major
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: options.round ? 0 : digits, maximumFractionDigits: options.round ? 0 : digits }).format(rounded)
}

// ---------------------------------------------------------------------------------------------
// The selected items (the plan as the traveller has changed it).

export type SelectedItem = (PlanItem | Alternative) & { day: number; added?: boolean; replacedFrom?: string }

/** The items in each day after the traveller's removals, replacements and additions. */
export function selectedItems(plan: Pick<TripPlan, 'days' | 'alternatives'>, sel: Selection): Map<number, SelectedItem[]> {
  const alts = new Map(plan.alternatives.map((a) => [a.id, a]))
  const out = new Map<number, SelectedItem[]>()
  for (const d of plan.days) {
    const items: SelectedItem[] = []
    for (const item of d.items) {
      if (sel.removed.includes(item.id)) continue
      const alt = sel.replaced[item.id] ? alts.get(sel.replaced[item.id]) : undefined
      items.push(alt && alt.day === d.day ? { ...alt, day: d.day, slot: item.slot, replacedFrom: item.id } : { ...item, day: d.day })
    }
    for (const id of sel.added) {
      const a = alts.get(id)
      if (a && a.day === d.day && !Object.values(sel.replaced).includes(id)) items.push({ ...a, added: true })
    }
    items.sort(byTime)
    out.set(d.day, items)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Price facts the budget needs that the app itself defines (the AI adds item-specific ones).

/** The short form of a base's name used in price keys: "Surfers Paradise" → "surfers-paradise". */
export const baseSlug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'base'
export const stayKey = (base: string) => `stay@${baseSlug(base)}`
/** A budget-level room in the same base, looked up only to show what cheaper accommodation would save. */
export const budgetStayKey = (base: string) => `stay-budget@${baseSlug(base)}`
export const foodKey = (meal: Meal | 'coffee' | 'snacks' | 'water', base: string) => `${meal}@${baseSlug(base)}`
export const localKey = (base: string) => `local@${baseSlug(base)}`
export const FLIGHT_OUT = 'flight:outbound'
export const FLIGHT_BACK = 'flight:return'

export type Meal = 'breakfast' | 'lunch' | 'dinner'
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner']

/** The routine daily costs every base needs: meals, coffee, snacks and local transport. */
export const ROUTINE_KINDS = ['breakfast', 'lunch', 'dinner', 'coffee', 'snacks', 'local'] as const
export type RoutineKind = (typeof ROUTINE_KINDS)[number]
/** Which routine cost a key is for, and its base slug: "lunch@torquay" → ["lunch", "torquay"]. */
export function routineOf(key: string): { kind: RoutineKind; base: string } | null {
  const m = /^(breakfast|lunch|dinner|coffee|snacks|local)@(.+)$/.exec(key)
  return m ? { kind: m[1] as RoutineKind, base: m[2] } : null
}

/** Everything the budget needs a price for, beyond the itinerary items' own cost keys. */
export function structuralNeeds(form: TripForm, plan: Pick<TripPlan, 'bases' | 'gateway'>): CostNeed[] {
  const out: CostNeed[] = []
  const party = `${form.adults} adult(s)${form.childAges.length ? ` and ${form.childAges.length} child(ren) aged ${form.childAges.join(', ')}` : ''}`
  if (plan.gateway.needsFlight && !form.flightBooked) {
    const first = plan.bases[0]
    const last = plan.bases.at(-1)!
    out.push({ key: FLIGHT_OUT, label: `Flight ${form.origin} to ${plan.gateway.arrivalAirport || first.name}`, category: 'flights', unit: 'per_person', detail: `One-way economy fare from ${form.origin} to ${plan.gateway.arrivalAirport || first.name} on ${form.arrive}, for ${party}, with one checked bag each. Give the adult fare, and the child fare if different.` })
    out.push({ key: FLIGHT_BACK, label: `Flight ${plan.gateway.departureAirport || last.name} to ${form.origin}`, category: 'flights', unit: 'per_person', detail: `One-way economy fare from ${plan.gateway.departureAirport || last.name} to ${form.origin} on ${form.depart}, for ${party}, with one checked bag each.` })
  }
  const level = form.stay === 'budget' ? 'budget (hostel private room or simple hotel)' : form.stay === 'premium' ? 'premium (5 star)' : 'mid-range (3 to 4 star)'
  const rooms = roomsFor(form)
  plan.bases.forEach((b, i) => {
    if (b.nights > 0 && !(i === 0 && form.hotelBooked)) {
      out.push({ key: stayKey(b.name), label: `Accommodation in ${b.name}`, category: 'accommodation', unit: 'per_room_night', detail: `A ${level} room in ${b.name}${b.region ? `, ${b.region}` : ''} for ${b.nights} nights from day ${b.fromDay}, ${rooms} room(s) for ${party}${form.roomNotes ? `; ${form.roomNotes}` : ''}. Per room per night.` })
      // With a budget given, also price a budget room, so the savings of cheaper accommodation are sourced.
      if (form.budget !== null && form.stay !== 'budget') out.push({ key: budgetStayKey(b.name), label: `Budget accommodation in ${b.name}`, category: 'accommodation', unit: 'per_room_night', detail: `A budget room (simple hotel, motel or hostel private room) in ${b.name}${b.region ? `, ${b.region}` : ''} for the same dates, ${rooms} room(s) for ${party}. Per room per night.` })
    }
    for (const m of MEALS) out.push({ key: foodKey(m, b.name), label: `${m[0].toUpperCase()}${m.slice(1)} in ${b.name}`, category: 'food', unit: 'per_person', detail: `Typical ${m} at a casual ${m === 'dinner' ? 'mid-range restaurant' : 'café'} in ${b.name}, per person${m === 'dinner' ? ', without alcohol' : ''}.` })
    out.push({ key: foodKey('coffee', b.name), label: `Coffee in ${b.name}`, category: 'food', unit: 'per_item', detail: `One café coffee or tea in ${b.name}.` })
    out.push({ key: foodKey('snacks', b.name), label: `Snacks and water in ${b.name}`, category: 'food', unit: 'per_person', detail: `Snacks and bottled water for one person for a day in ${b.name} (for example a piece of fruit or pastry and 1.5 litres of water).` })
    out.push({ key: localKey(b.name), label: `Local transport in ${b.name}`, category: 'local_transport', unit: 'per_person', detail: `Public transport for one person for a day in ${b.name} (day pass or two to four trips).` })
  })
  return out
}

// ---------------------------------------------------------------------------------------------
// Quantities.

type Party = { adults: number; childAges: number[] }

/** People priced at the adult and child rate for a fact, with children under the free age left out. */
function priceParty(f: PriceFact, p: Party): { adults: number; children: number[]; free: number[] } {
  const children: number[] = []
  const free: number[] = []
  let adults = p.adults
  for (const age of p.childAges) {
    if (f.freeUnderAge !== null && age < f.freeUnderAge) free.push(age)
    else if (f.childLow !== null && (f.childMaxAge === null || age <= f.childMaxAge)) children.push(age)
    else adults++
  }
  return { adults, children, free }
}

type Amount = { low: number; high: number; working: number; quantity: string } | null

const fmt = (major: number, currency: string) => formatMoney(toMinor(major, currency), currency)

/**
 * The amount for one fact, in minor units of the trip currency. `count` multiplies per-item and
 * per-person-day facts (for example meals on that day). Returns null when the price cannot be used.
 */
export function amountFor(f: PriceFact, party: Party, trip: { currency: string; rates: Record<string, Rate>; rooms: number; nights?: number; count?: number }): Amount {
  if (f.type === 'unavailable') return null
  const c = (v: number) => convert(v, f.currency, trip.currency, trip.rates)
  const lo = c(f.low), hi = c(f.high), wk = c(f.working)
  if (lo === null || hi === null || wk === null) return null
  const cur = trip.currency
  const n = trip.count ?? 1
  const times = n > 1 ? ` × ${n}` : ''
  const people = party.adults + party.childAges.length
  switch (f.unit) {
    case 'per_room_night': {
      const nights = trip.nights ?? 1
      const q = trip.rooms * nights
      return { low: toMinor(lo * q, cur), high: toMinor(hi * q, cur), working: toMinor(wk * q, cur), quantity: `${fmt(wk, cur)} per room per night × ${trip.rooms} ${trip.rooms === 1 ? 'room' : 'rooms'} × ${nights} ${nights === 1 ? 'night' : 'nights'}` }
    }
    case 'per_group':
      return { low: toMinor(lo * n, cur), high: toMinor(hi * n, cur), working: toMinor(wk * n, cur), quantity: `${fmt(wk, cur)} for the group${times}` }
    case 'per_vehicle': {
      const seats = f.vehicleSeats ?? 4
      const vehicles = Math.max(1, Math.ceil(people / seats))
      return { low: toMinor(lo * vehicles * n, cur), high: toMinor(hi * vehicles * n, cur), working: toMinor(wk * vehicles * n, cur), quantity: `${fmt(wk, cur)} × ${vehicles} ${vehicles === 1 ? 'vehicle' : 'vehicles'} (up to ${seats} people each)${times}` }
    }
    case 'per_item':
      return { low: toMinor(lo * n, cur), high: toMinor(hi * n, cur), working: toMinor(wk * n, cur), quantity: `${fmt(wk, cur)} × ${n}` }
    case 'per_adult':
      return { low: toMinor(lo * party.adults * n, cur), high: toMinor(hi * party.adults * n, cur), working: toMinor(wk * party.adults * n, cur), quantity: `${party.adults} ${party.adults === 1 ? 'adult' : 'adults'} × ${fmt(wk, cur)}${times}` }
    case 'per_person':
    default: {
      const pp = priceParty(f, party)
      const clo = f.childLow !== null ? c(f.childLow) : null
      const chi = f.childHigh !== null ? c(f.childHigh) : clo
      const cwk = clo !== null && chi !== null ? (clo + chi) / 2 : null
      if (pp.children.length && (clo === null || chi === null || cwk === null)) return null
      const kids = pp.children.length
      let low = lo * pp.adults + (clo ?? 0) * kids
      let high = hi * pp.adults + (chi ?? 0) * kids
      let working = wk * pp.adults + (cwk ?? 0) * kids
      const parts = [`${pp.adults} ${pp.adults === 1 ? 'adult' : 'adults'} × ${fmt(wk, cur)}`]
      if (kids) parts.push(`${kids} ${kids === 1 ? 'child' : 'children'} (${pp.children.join(', ')}) × ${fmt(cwk!, cur)}`)
      if (pp.free.length) parts.push(`${pp.free.length} free (under ${f.freeUnderAge})`)
      // A family pass is used when the party fits it and it is cheaper.
      if (f.familyPass) {
        const pass = c(f.familyPass.amount)
        if (pass !== null && pp.adults <= f.familyPass.adults && kids <= f.familyPass.children && kids > 0 && pass < working) {
          return { low: toMinor(pass * n, cur), high: toMinor(pass * n, cur), working: toMinor(pass * n, cur), quantity: `Family pass ${fmt(pass, cur)} (${f.familyPass.adults} adults, ${f.familyPass.children} children)${times}` }
        }
      }
      low *= n; high *= n; working *= n
      return { low: toMinor(low, cur), high: toMinor(high, cur), working: toMinor(working, cur), quantity: parts.join(' + ') + times }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Meals per day.

/** The meals eaten at the destination on a day, given arrival and departure times. */
export function mealsOn(day: PlanDay, form: Pick<TripForm, 'arrivalTime' | 'departureTime' | 'breakfastIncluded'>): { paid: Meal[]; included: Meal[] } {
  let meals = [...MEALS]
  if (day.kind === 'arrival' || day.kind === 'arrival_departure') {
    meals = form.arrivalTime === 'evening' ? [] : form.arrivalTime === 'afternoon' ? ['dinner'] : form.arrivalTime === 'morning' ? ['lunch', 'dinner'] : ['lunch', 'dinner']
  }
  if (day.kind === 'departure' || day.kind === 'arrival_departure') {
    const before: Meal[] = form.departureTime === 'morning' ? ['breakfast'] : form.departureTime === 'evening' ? ['breakfast', 'lunch', 'dinner'] : ['breakfast', 'lunch']
    meals = meals.filter((m) => before.includes(m))
  }
  // Breakfast is included only on mornings after a night at the accommodation.
  const included: Meal[] = form.breakfastIncluded && day.day > 1 && meals.includes('breakfast') ? ['breakfast'] : []
  return { paid: meals.filter((m) => !included.includes(m)), included }
}

// ---------------------------------------------------------------------------------------------
// The budget.

export function calculateBudget(form: TripForm, plan: TripPlan, sel: Selection): Budget {
  const currency = form.currency
  const party: Party = { adults: form.adults, childAges: form.childAges }
  const rooms = roomsFor(form)
  const people = travellers(form)
  const lines: BudgetLine[] = []
  const allowances = sel.allowances ?? {}
  // A sourced price is used first; the traveller's own allowance fills a cost with no sourced price.
  const fact = (key: string | null): PriceFact | null => {
    if (!key) return null
    const f = plan.prices[key] ?? null
    const own = allowances[key]
    if (f && f.type === 'unavailable' && typeof own === 'number' && own >= 0) {
      return { ...f, type: 'user', currency, low: own, high: own, working: own, childLow: null, childHigh: null, childMaxAge: null, freeUnderAge: null, familyPass: null, sampleSize: null, sourceName: '', sourceUrl: null, basis: 'Allowance you entered' }
    }
    return f
  }
  const trip = { currency, rates: plan.rates, rooms }

  const push = (base: Omit<BudgetLine, 'low' | 'high' | 'working' | 'status' | 'quantity' | 'priceType' | 'paid' | 'optional' | 'note'> & { note?: string; optional?: boolean }, f: PriceFact | null, opts: { nights?: number; count?: number } = {}) => {
    const amount = f ? amountFor(f, party, { ...trip, ...opts }) : null
    if (!f || !amount) {
      lines.push({ ...base, low: 0, high: 0, working: 0, status: 'unavailable', priceType: f?.type ?? 'unavailable', quantity: f && f.type !== 'unavailable' ? 'No exchange rate or child price was found for this price' : 'No reliable price found', paid: false, optional: base.optional ?? false, note: base.note ?? '' })
      return
    }
    lines.push({ ...base, ...amount, status: amount.working === 0 ? 'free' : 'priced', priceType: f.type, paid: false, optional: base.optional ?? false, note: base.note ?? '' })
  }

  // Flights: the traveller's booking, or the two one-way fares.
  if (form.flightBooked) {
    if (form.flightAmount !== null) lines.push({ id: 'flights-booked', category: 'flights', label: 'Flights (your booking)', day: null, quantity: 'Amount you entered', low: toMinor(form.flightAmount, currency), high: toMinor(form.flightAmount, currency), working: toMinor(form.flightAmount, currency), status: 'booking', priceType: 'booking', factKey: null, paid: form.flightPaid, optional: false, note: '' })
    else lines.push({ id: 'flights-booked', category: 'flights', label: 'Flights (already booked, amount not entered)', day: null, quantity: 'Add the amount in "Edit trip" to include it', low: 0, high: 0, working: 0, status: 'unavailable', priceType: 'booking', factKey: null, paid: false, optional: false, note: '' })
  } else if (plan.gateway.needsFlight) {
    for (const key of [FLIGHT_OUT, FLIGHT_BACK]) {
      const f = fact(key)
      push({ id: key, category: 'flights', label: f?.label ?? (key === FLIGHT_OUT ? 'Flight there' : 'Flight home'), day: null, factKey: key }, f)
    }
  }

  // Accommodation: room rate × rooms × nights in each base (a booking replaces the first base).
  plan.bases.forEach((b, i) => {
    if (b.nights <= 0) return
    if (i === 0 && form.hotelBooked) {
      const label = `Accommodation in ${b.name}${form.hotelName ? ` (${form.hotelName})` : ''}, your booking`
      if (form.hotelAmount !== null) lines.push({ id: `stay-${i}`, category: 'accommodation', label, day: null, quantity: `Amount you entered for ${b.nights} ${b.nights === 1 ? 'night' : 'nights'}`, low: toMinor(form.hotelAmount, currency), high: toMinor(form.hotelAmount, currency), working: toMinor(form.hotelAmount, currency), status: 'booking', priceType: 'booking', factKey: null, paid: form.hotelPaid, optional: false, note: '' })
      else lines.push({ id: `stay-${i}`, category: 'accommodation', label, day: null, quantity: 'Add the amount in "Edit trip" to include it', low: 0, high: 0, working: 0, status: 'unavailable', priceType: 'booking', factKey: null, paid: false, optional: false, note: '' })
      return
    }
    const key = stayKey(b.name)
    push({ id: `stay-${i}`, category: 'accommodation', label: `Accommodation in ${b.name}`, day: null, factKey: key }, fact(key), { nights: b.nights })
  })

  // Day by day: meals, coffee, snacks, water, local transport, then the selected items.
  const items = selectedItems(plan, sel)
  for (const d of plan.days) {
    const base = d.base
    const meals = mealsOn(d, form)
    for (const m of meals.paid) push({ id: `d${d.day}-${m}`, category: 'food', label: `${m[0].toUpperCase()}${m.slice(1)}`, day: d.day, factKey: foodKey(m, base) }, fact(foodKey(m, base)))
    for (const m of meals.included) lines.push({ id: `d${d.day}-${m}`, category: 'food', label: `${m[0].toUpperCase()}${m.slice(1)} (included with accommodation)`, day: d.day, quantity: 'Included', low: 0, high: 0, working: 0, status: 'included', priceType: null, factKey: null, paid: false, optional: false, note: '' })
    // One coffee per adult on a day with a morning at the destination; snacks and water for everyone.
    if (form.adults > 0 && (d.kind !== 'arrival' || form.arrivalTime !== 'evening')) push({ id: `d${d.day}-coffee`, category: 'food', label: 'Coffee or tea', day: d.day, factKey: foodKey('coffee', base) }, fact(foodKey('coffee', base)), { count: form.adults })
    push({ id: `d${d.day}-snacks`, category: 'food', label: plan.prices[foodKey('water', base)] ? 'Snacks' : 'Snacks and water', day: d.day, factKey: foodKey('snacks', base) }, fact(foodKey('snacks', base)))
    // Trips planned before snacks and water were priced together keep their separate water line.
    if (plan.prices[foodKey('water', base)]) push({ id: `d${d.day}-water`, category: 'food', label: 'Drinking water', day: d.day, factKey: foodKey('water', base) }, fact(foodKey('water', base)))
    // Local transport on every day spent at the destination; airport and intercity journeys are separate lines.
    push({ id: `d${d.day}-local`, category: 'local_transport', label: 'Local transport', day: d.day, factKey: localKey(base) }, fact(localKey(base)))

    for (const it of items.get(d.day) ?? []) {
      if (!it.costKey) continue
      const f = fact(it.costKey)
      // Transfers and travel between cities are one-time trip costs; tickets belong to their day.
      const category: Category = f?.category ?? (it.kind === 'transfer' ? 'transfers' : it.kind === 'travel' ? 'intercity' : 'activities')
      const oneTime = category === 'transfers' || category === 'intercity' || category === 'flights'
      push({ id: `item-${it.id}`, category: 'optional' in it && it.optional ? 'extras' : category, label: it.title, day: oneTime ? null : d.day, factKey: it.costKey, optional: 'optional' in it ? it.optional : false, note: oneTime ? `Day ${d.day}` : '', itemDay: d.day }, f)
    }
  }

  const priced = lines.filter((l) => l.status !== 'unavailable')
  const sum = (ls: BudgetLine[]) => ls.reduce((a, l) => ({ low: a.low + l.low, high: a.high + l.high, working: a.working + l.working }), { low: 0, high: 0, working: 0 })
  const known = sum(priced)
  const pct = Math.max(0, Math.min(30, Math.round(sel.contingencyPct)))
  const contingency = { low: Math.round((known.low * pct) / 100), high: Math.round((known.high * pct) / 100), working: Math.round((known.working * pct) / 100) }
  const total = { low: known.low + contingency.low, high: known.high + contingency.high, working: known.working + contingency.working }
  const missing = lines.filter((l) => l.status === 'unavailable').map((l) => ({ label: l.label, category: l.category, day: l.day, factKey: l.factKey }))
  // Unpriced lines grouped by what they are (for example "Lunch (Torquay) × 5"), per category.
  const unresolvedIn = (c: Category) => {
    const counts = new Map<string, { key: string | null; label: string; count: number }>()
    for (const l of lines) if (l.category === c && l.status === 'unavailable') {
      const f = l.factKey ? plan.prices[l.factKey] : null
      const id = l.factKey ?? l.id
      const g = counts.get(id) ?? { key: l.factKey, label: f?.label ?? l.label, count: 0 }
      g.count++
      counts.set(id, g)
    }
    return [...counts.values()]
  }
  const budget = form.budget !== null ? toMinor(form.budget, currency) : null
  const paid = priced.filter((l) => l.paid).reduce((a, l) => a + l.working, 0)

  return {
    currency,
    lines,
    known,
    contingencyPct: pct,
    contingency,
    total,
    perPerson: people ? Math.round(total.working / people) : total.working,
    travellers: people,
    byCategory: CATEGORIES.map((c) => ({
      category: c,
      ...sum(priced.filter((l) => l.category === c)),
      missing: lines.filter((l) => l.category === c && l.status === 'unavailable').length,
      unresolved: unresolvedIn(c),
      userAllowance: priced.some((l) => l.category === c && l.priceType === 'user'),
      allowance: priced.some((l) => l.category === c && l.priceType === 'allowance'),
    })).filter((c) => c.working > 0 || c.missing > 0 || c.low > 0 || c.unresolved.length > 0),
    byDay: plan.days.map((d) => ({ day: d.day, ...sum(priced.filter((l) => l.day === d.day)), missing: lines.filter((l) => l.day === d.day && l.status === 'unavailable').length })),
    oneTime: sum(priced.filter((l) => l.day === null)),
    budget,
    remaining: budget !== null ? budget - total.working : null,
    paid,
    toPay: total.working - paid,
    incomplete: missing.length > 0,
    missing,
    usesUserAllowance: priced.some((l) => l.priceType === 'user'),
  }
}

// ---------------------------------------------------------------------------------------------
// Warnings after a change.

/** Timing and budget problems with the current selection, in plain words. */
export function warningsFor(plan: TripPlan, sel: Selection, budget: Budget): string[] {
  const out: string[] = []
  const items = selectedItems(plan, sel)
  for (const d of plan.days) {
    for (const slot of SLOTS) {
      const list = (items.get(d.day) ?? []).filter((i) => i.slot === slot)
      const minutes = list.reduce((a, i) => a + i.minutes + (i.travel?.minutes ?? 0), 0)
      if (minutes > SLOT_MINUTES[slot as Slot] + 30) out.push(`Day ${d.day} ${slot}: about ${Math.round(minutes / 6) / 10} hours of activities and travel, more than fits comfortably. Consider removing one.`)
    }
  }
  if (budget.remaining !== null && budget.remaining < 0) out.push(`The estimate is ${formatMoney(-budget.remaining, budget.currency, { round: true })} over your budget.`)
  return out
}

// ---------------------------------------------------------------------------------------------
// Over budget: what drives the cost, and sourced ways to spend less.

export type Saving = { id: string; label: string; detail: string; saving: number }
export type BudgetAdvice = {
  over: number
  drivers: { category: Category; working: number; share: number }[]
  options: Saving[]
  /** What the options other than shortening the trip save together (minor units, with contingency). */
  combined: number
  /** Whether the budget is met after those savings. */
  fits: boolean
  /** Nights to cut, on top of the other savings, to meet the budget (null when no shorter trip fits). */
  nightsToCut: number | null
}

/**
 * When the estimate is over the traveller's budget: the biggest cost categories, and ways to spend
 * less, each worked out from the same sourced prices (a budget room's own price, the low end of the
 * meal ranges, free alternatives already in the plan). Nothing here changes the trip.
 */
export function budgetAdvice(form: TripForm, plan: TripPlan, sel: Selection, b: Budget): BudgetAdvice | null {
  if (b.remaining === null || b.remaining >= 0) return null
  const over = -b.remaining
  const withContingency = (minor: number) => Math.round(minor * (1 + b.contingencyPct / 100))
  const party: Party = { adults: form.adults, childAges: form.childAges }
  const trip = { currency: b.currency, rates: plan.rates, rooms: roomsFor(form) }
  const options: Saving[] = []
  const priced = b.lines.filter((l) => l.status === 'priced' || l.status === 'free')

  // 1. Budget accommodation, from the budget-room price found for each base.
  let rooms = 0
  const where: string[] = []
  plan.bases.forEach((base, i) => {
    if (base.nights <= 0 || (i === 0 && form.hotelBooked)) return
    const mid = plan.prices[stayKey(base.name)]
    const cheap = plan.prices[budgetStayKey(base.name)]
    if (!mid || !cheap) return
    const a = amountFor(mid, party, { ...trip, nights: base.nights })
    const c = amountFor(cheap, party, { ...trip, nights: base.nights })
    if (a && c && a.working > c.working) { rooms += a.working - c.working; where.push(base.name) }
  })
  if (rooms > 0) options.push({ id: 'stay', label: 'Choose budget accommodation', detail: `Simple hotels, motels or hostel private rooms in ${where.join(' and ')}, at the budget room prices found for your dates.`, saving: withContingency(rooms) })

  // 2. Free alternatives already suggested for paid activities, and leaving out optional extras.
  const items = selectedItems(plan, sel)
  let swaps = 0, swapCount = 0
  for (const d of plan.days) {
    for (const it of items.get(d.day) ?? []) {
      const line = b.lines.find((l) => l.id === `item-${it.id}`)
      if (!line || line.status !== 'priced' || line.working <= 0 || line.category === 'extras') continue
      const free = plan.alternatives.find((a) => a.day === d.day && a.replaces === it.id && (!a.costKey || plan.prices[a.costKey]?.working === 0))
      if (free) { swaps += line.working; swapCount++ }
    }
  }
  if (swaps > 0) options.push({ id: 'free', label: 'Swap paid activities for free ones', detail: `${swapCount} paid ${swapCount === 1 ? 'activity has' : 'activities have'} a free alternative in the daily plan.`, saving: withContingency(swaps) })
  const extras = priced.filter((l) => l.category === 'extras').reduce((a, l) => a + l.working, 0)
  if (extras > 0) options.push({ id: 'extras', label: 'Leave out the optional extras', detail: 'Tours and add-ons marked optional.', saving: withContingency(extras) })

  // 3. Meals and local transport at the low end of their sourced ranges.
  const lowEnd = (c: Category) => priced.filter((l) => l.category === c).reduce((a, l) => a + (l.working - l.low), 0)
  const meals = lowEnd('food')
  if (meals > 0) options.push({ id: 'meals', label: 'Eat more simply', detail: 'Cafés, bakeries and supermarket meals: the low end of the sourced meal prices.', saving: withContingency(meals) })
  const local = lowEnd('local_transport')
  if (local > 0) options.push({ id: 'local', label: 'Use cheaper local transport', detail: 'Daily fare caps and walking where practical: the low end of the sourced fares.', saving: withContingency(local) })

  const combined = options.reduce((a, o) => a + o.saving, 0)

  // 4. A shorter trip: one night in the last base, with that day's routine costs.
  const last = plan.bases.at(-1)
  let perNight = 0
  if (last && last.nights > 1) {
    const stay = plan.prices[stayKey(last.name)]
    const room = stay ? amountFor(stay, party, { ...trip, nights: 1 }) : null
    const lastDays = plan.days.filter((d) => d.base === last.name && d.kind === 'full').map((d) => d.day)
    const daily = lastDays.length ? b.byDay.filter((x) => lastDays.includes(x.day)).reduce((a, x) => a + x.working, 0) / lastDays.length : 0
    perNight = withContingency(Math.round((room?.working ?? 0) + daily))
    if (perNight > 0) options.push({ id: 'night', label: `One night fewer in ${last.name}`, detail: 'The room and a typical day’s meals, transport and activities there.', saving: perNight })
  }
  const stillOver = over - combined
  const maxCut = last ? last.nights - 1 : 0
  const nightsToCut = stillOver <= 0 ? 0 : perNight > 0 && Math.ceil(stillOver / perNight) <= maxCut ? Math.ceil(stillOver / perNight) : null

  const total = b.known.working || 1
  const drivers = b.byCategory.filter((c) => c.working > 0).sort((x, y) => y.working - x.working).slice(0, 3).map((c) => ({ category: c.category, working: c.working, share: Math.round((c.working / total) * 100) }))
  return { over, drivers, options, combined, fits: combined >= over, nightsToCut }
}
