/**
 * The words of the trip budget: the kinds of cost Travel Notes prices, how each is counted, and
 * the traveller's own trip set-up (who is going, the room count, the kind of stay and what is
 * already booked). Shared by the CMS collection, the forms and the budget engine.
 *
 * Nothing in this file is a price. Prices come only from:
 * - the traveller's own bookings (the amount they typed), or
 * - a "price check" an editor (or, later, checked web research) saved with a source and a date.
 * Anything else is shown as "price unavailable" and is never added to the total.
 */

export type CostCategory = 'flights' | 'accommodation' | 'food' | 'transport' | 'activities' | 'extras'

export const CATEGORY_LABEL: Record<CostCategory, string> = {
  flights: 'Flights',
  accommodation: 'Accommodation',
  food: 'Food and drink',
  transport: 'Getting around',
  activities: 'Tickets and tours',
  extras: 'Optional extras',
}

/**
 * How a price is counted.
 * - person: each traveller (child price where one is given)
 * - room_night: each room, each night
 * - item: one of the thing (a coffee, a SIM card)
 * - journey: each traveller, each journey (a train ticket)
 * - group: the whole party once (a taxi, a private tour)
 */
export const BASES = [
  { value: 'person', label: 'Per person' },
  { value: 'room_night', label: 'Per room, per night' },
  { value: 'item', label: 'Per item' },
  { value: 'journey', label: 'Per person, per journey' },
  { value: 'group', label: 'For the whole group' },
] as const
export type Basis = (typeof BASES)[number]['value']

export const PRICE_KINDS = [
  { value: 'published', label: 'Published price (the official price list)' },
  { value: 'quote', label: 'Quote for specific dates' },
  { value: 'estimate', label: 'Estimate (a typical local price range)' },
] as const
export type PriceKind = (typeof PRICE_KINDS)[number]['value']

/** The everyday costs the budget counts. `daily` items are counted per day of the trip. */
export const COST_ITEMS = [
  { value: 'breakfast', label: 'Breakfast', category: 'food', basis: 'person', daily: true },
  { value: 'lunch', label: 'Lunch', category: 'food', basis: 'person', daily: true },
  { value: 'dinner', label: 'Dinner', category: 'food', basis: 'person', daily: true },
  { value: 'coffee', label: 'Coffee or tea', category: 'food', basis: 'item', daily: true },
  { value: 'snacks', label: 'Snacks', category: 'food', basis: 'person', daily: true },
  { value: 'water', label: 'Drinking water', category: 'food', basis: 'person', daily: true },
  { value: 'local_transport', label: 'Local transport for a day', category: 'transport', basis: 'person', daily: true },
  { value: 'airport_transfer', label: 'Airport transfer (one way)', category: 'transport', basis: 'person', daily: false },
  { value: 'intercity', label: 'Travel to another city', category: 'transport', basis: 'journey', daily: false },
  { value: 'stay_budget', label: 'Budget accommodation', category: 'accommodation', basis: 'room_night', daily: false },
  { value: 'stay_mid', label: 'Mid-range accommodation', category: 'accommodation', basis: 'room_night', daily: false },
  { value: 'stay_premium', label: 'Premium accommodation', category: 'accommodation', basis: 'room_night', daily: false },
  { value: 'attraction', label: 'Attraction ticket', category: 'activities', basis: 'person', daily: false },
  { value: 'tour', label: 'Tour', category: 'activities', basis: 'person', daily: false },
  { value: 'mobile_data', label: 'Mobile data (SIM or eSIM)', category: 'extras', basis: 'item', daily: false },
] as const satisfies readonly { value: string; label: string; category: CostCategory; basis: Basis; daily: boolean }[]
export type CostItem = (typeof COST_ITEMS)[number]['value']
export const costItem = (value: string) => COST_ITEMS.find((i) => i.value === value)

export const STAYS = [
  { value: 'budget', label: 'Budget (hostel, simple hotel)', item: 'stay_budget' },
  { value: 'mid', label: 'Mid-range hotel or apartment', item: 'stay_mid' },
  { value: 'premium', label: 'Premium hotel', item: 'stay_premium' },
] as const
export type Stay = (typeof STAYS)[number]['value']

export const ARRIVALS = [
  { value: 'morning', label: 'Morning (before 11 am)' },
  { value: 'afternoon', label: 'Afternoon (11 am to 5 pm)' },
  { value: 'evening', label: 'Evening or night (after 5 pm)' },
] as const
export type DayPart = (typeof ARRIVALS)[number]['value']

export const BOOKING_STATUS = [
  { value: 'not_booked', label: 'Not booked yet' },
  { value: 'booked', label: 'Booked' },
  { value: 'not_needed', label: 'Not needed' },
] as const
export type BookingStatus = (typeof BOOKING_STATUS)[number]['value']

/** A cost the traveller already knows: what they paid or will pay, in Australian cents. */
export type Booking = { status: BookingStatus; amountCents: number | null; paid: boolean }

export const CONTINGENCY_CHOICES = [0, 5, 10, 15, 20] as const
export const MAX_ADULTS = 12
export const MAX_CHILDREN = 8

/**
 * The traveller's own set-up for the budget. Stored on the plan as JSON (field `trip`), so it can
 * grow in later phases (selected activities, locks) without a database change each time.
 */
export type TripSetup = {
  adults: number
  /** Each child's age on the trip, 0 to 17. */
  childAges: number[]
  rooms: number
  stay: Stay
  breakfastIncluded: boolean
  /** Coffees or teas a day for each adult (0 to 3). */
  coffees: number
  arrival: DayPart
  departure: DayPart
  flights: Booking
  accommodation: Booking
  mobileData: boolean
  /** A separate safety margin, as a percentage of the costs still to pay. */
  contingency: number
}

export const DEFAULT_SETUP: TripSetup = {
  adults: 2,
  childAges: [],
  rooms: 1,
  stay: 'mid',
  breakfastIncluded: false,
  coffees: 1,
  arrival: 'afternoon',
  departure: 'afternoon',
  flights: { status: 'not_booked', amountCents: null, paid: false },
  accommodation: { status: 'not_booked', amountCents: null, paid: false },
  mobileData: false,
  contingency: 10,
}

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
const pick = <T extends string>(v: unknown, values: readonly { value: T }[], fallback: T): T => (values.some((x) => x.value === v) ? (v as T) : fallback)

function readBooking(v: unknown): Booking {
  const b = obj(v)
  const status = pick(b.status, BOOKING_STATUS, 'not_booked')
  const amount = typeof b.amountCents === 'number' && Number.isInteger(b.amountCents) && b.amountCents >= 0 && b.amountCents <= 100_000_000_00 ? b.amountCents : null
  return { status, amountCents: status === 'booked' ? amount : null, paid: status === 'booked' && b.paid === true }
}

/** Read the stored set-up safely: anything missing or invalid falls back to the default. */
export function readTripSetup(stored: unknown, fallback: { travellers?: number | null; party?: string | null } = {}): TripSetup {
  const s = obj(stored)
  const hasStored = Object.keys(s).length > 0
  // Before the traveller fills this in, start from what the planner already knows.
  const startAdults = fallback.party === 'solo' ? 1 : fallback.travellers && fallback.travellers <= MAX_ADULTS ? fallback.travellers : DEFAULT_SETUP.adults
  const adults = int(s.adults, 1, MAX_ADULTS, hasStored ? DEFAULT_SETUP.adults : startAdults)
  const childAges = (Array.isArray(s.childAges) ? s.childAges : []).map((a) => int(a, 0, 17, -1)).filter((a) => a >= 0).slice(0, MAX_CHILDREN)
  return {
    adults,
    childAges,
    rooms: int(s.rooms, 1, 10, 1),
    stay: pick(s.stay, STAYS, DEFAULT_SETUP.stay),
    breakfastIncluded: s.breakfastIncluded === true,
    coffees: int(s.coffees, 0, 3, DEFAULT_SETUP.coffees),
    arrival: pick(s.arrival, ARRIVALS, DEFAULT_SETUP.arrival),
    departure: pick(s.departure, ARRIVALS, DEFAULT_SETUP.departure),
    flights: readBooking(s.flights),
    accommodation: readBooking(s.accommodation),
    mobileData: s.mobileData === true,
    contingency: CONTINGENCY_CHOICES.includes(s.contingency as never) ? (s.contingency as number) : DEFAULT_SETUP.contingency,
  }
}

/** Children's ages as typed: "4, 9" or "4 and 9". Returns null when something is not an age. */
export function parseChildAges(text: string): number[] | null {
  const parts = text.split(/[,;\s]+|and/i).map((p) => p.trim()).filter(Boolean)
  const ages = parts.map((p) => (/^\d{1,2}$/.test(p) ? Number(p) : NaN))
  if (ages.some((a) => !(a >= 0 && a <= 17))) return null
  return ages.slice(0, MAX_CHILDREN + 1)
}

export const people = (s: Pick<TripSetup, 'adults' | 'childAges'>) => s.adults + s.childAges.length
