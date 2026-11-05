import { isLocalDate } from '../../community/time'
import { cleanLine, cleanText } from '../../community/text'

/**
 * The single Trip Planner form: what the traveller tells us once, before "Generate my trip".
 *
 * This file has no database or network access, so its rules are tested directly
 * (tests/trip/form.test.ts). The same parser runs on the server for every submission, so the
 * browser's own checks are a convenience only.
 *
 * Days and nights: a trip that arrives on 1 March and leaves on 4 March has 4 days (1, 2, 3 and 4
 * March are all days at the destination) and 3 nights of accommodation.
 */

export const TRIP_LIMITS = { minDays: 1, maxDays: 21, maxAdults: 9, maxChildren: 8, maxBudget: 10_000_000 } as const

export const TRAVELLER_TYPES = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
  { value: 'group', label: 'Group' },
] as const
export type TravellerType = (typeof TRAVELLER_TYPES)[number]['value']

export const INTERESTS = [
  { value: 'beaches', label: 'Beaches' },
  { value: 'food', label: 'Food' },
  { value: 'culture', label: 'Culture' },
  { value: 'nature', label: 'Nature' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'family', label: 'Family activities' },
] as const
export type Interest = (typeof INTERESTS)[number]['value']

export const TRIP_PACES = [
  { value: 'relaxed', label: 'Relaxed', hint: 'One or two main things a day, with plenty of rest.' },
  { value: 'balanced', label: 'Balanced', hint: 'Two or three main things a day.' },
  { value: 'full', label: 'Full days', hint: 'Early starts and more to see.' },
] as const
export type TripPace = (typeof TRIP_PACES)[number]['value']

export const STAY_LEVELS = [
  { value: 'budget', label: 'Budget (hostel or simple hotel)' },
  { value: 'mid', label: 'Mid-range (3 to 4 star)' },
  { value: 'premium', label: 'Premium (5 star)' },
] as const
export type StayLevel = (typeof STAY_LEVELS)[number]['value']

export const DAY_TIMES = [
  { value: '', label: 'Not sure yet' },
  { value: 'morning', label: 'Morning (before 11 am)' },
  { value: 'afternoon', label: 'Afternoon (11 am to 5 pm)' },
  { value: 'evening', label: 'Evening or night (after 5 pm)' },
] as const
export type DayTime = 'morning' | 'afternoon' | 'evening'

/** Currencies the budget can be shown in. Prices in any other currency are converted at a sourced rate. */
export const TRIP_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY', 'INR', 'LKR', 'THB', 'IDR', 'MYR', 'PHP', 'VND', 'CNY', 'HKD', 'KRW', 'AED'] as const
export type TripCurrency = (typeof TRIP_CURRENCIES)[number]

/** Digits after the decimal point for each currency (JPY, KRW, IDR, VND have none). */
export const minorDigits = (currency: string): number => (['JPY', 'KRW', 'IDR', 'VND'].includes(currency) ? 0 : 2)

export type TripForm = {
  origin: string
  destination: string
  /** Arrival date at the destination, YYYY-MM-DD. */
  arrive: string
  /** Departure date from the destination, YYYY-MM-DD. */
  depart: string
  /** Days at the destination, counting the arrival and departure days. */
  days: number
  /** Accommodation nights: days − 1. */
  nights: number
  travellerType: TravellerType
  adults: number
  childAges: number[]
  /** The traveller's total trip budget, in whole units of `currency` (null when not given). */
  budget: number | null
  currency: TripCurrency
  // Optional preferences ("Personalize my trip").
  interests: Interest[]
  pace: TripPace
  stay: StayLevel
  rooms: number | null
  roomNotes: string
  accessibility: string
  dietary: string
  mustSee: string
  /** Flights the traveller has already booked, with the amount paid when given. */
  flightBooked: boolean
  flightAmount: number | null
  flightPaid: boolean
  hotelBooked: boolean
  hotelName: string
  hotelAmount: number | null
  hotelPaid: boolean
  breakfastIncluded: boolean
  arrivalTime: DayTime | null
  departureTime: DayTime | null
}

export type TripFormErrors = Partial<Record<keyof TripForm | 'dates' | 'form', string>>

/** YYYY-MM-DD plus n days, in calendar terms. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Calendar days from one date to another (0 when they are the same day). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)))
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

/** Days at the destination for an arrival and departure date (both days count). */
export const tripDays = (arrive: string, depart: string): number => daysBetween(arrive, depart) + 1
/** Accommodation nights for a stay: one fewer than the days. */
export const tripNights = (days: number): number => Math.max(0, days - 1)
/** The departure date for an arrival date and a number of days. */
export const departureFor = (arrive: string, days: number): string => addDays(arrive, Math.max(1, days) - 1)

/** The dates of every day of the trip, in order. */
export const tripDates = (arrive: string, days: number): string[] => Array.from({ length: days }, (_, i) => addDays(arrive, i))

type Source = FormData | Record<string, string | string[] | undefined>

function reader(src: Source) {
  const get = (k: string): string => {
    if (src instanceof FormData) {
      const v = src.get(k)
      return typeof v === 'string' ? v.trim() : ''
    }
    const v = src[k]
    return (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim()
  }
  const getAll = (k: string): string[] => {
    if (src instanceof FormData) return src.getAll(k).filter((v): v is string => typeof v === 'string').map((v) => v.trim())
    const v = src[k]
    return (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((s) => s.trim())
  }
  return { get, getAll }
}

const int = (v: string): number | null => (/^\d{1,9}$/.test(v) ? Number(v) : null)
/** A money amount typed by a person: "1,250", "1250.50", "$1250". Whole units only are kept for the budget. */
export function readAmount(v: string): number | null {
  const cleaned = v.replace(/[\s,$€£¥₹]/g, '').replace(/^[A-Z]{3}/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Read and check the form. Always returns the values the traveller typed (cleaned), so the form
 * can be shown again with them after an error; `ok` is true only when there are no errors.
 */
export function readTripForm(src: Source, today: string): { form: TripForm; errors: TripFormErrors; ok: boolean } {
  const { get, getAll } = reader(src)
  const errors: TripFormErrors = {}

  const origin = cleanLine(get('origin'), 120)
  const destination = cleanLine(get('destination'), 120)
  if (!origin) errors.origin = 'Enter the city or airport you are travelling from.'
  if (!destination) errors.destination = 'Enter a country or city, for example Australia or Sydney.'

  const arriveRaw = get('arrive')
  const departRaw = get('depart')
  const daysRaw = int(get('days'))
  // The traveller chooses either a departure date or a number of days; the other is worked out.
  const by = get('by') === 'days' ? 'days' : 'dates'
  let arrive = isLocalDate(arriveRaw) ? arriveRaw : ''
  let depart = ''
  let days = 0
  if (!arrive) errors.arrive = 'Enter the date you arrive at your destination.'
  else if (daysBetween(today, arrive) < 0) errors.arrive = 'The arrival date has already passed.'
  else if (daysBetween(today, arrive) > 550) errors.arrive = 'Choose an arrival date within the next 18 months.'
  if (arrive) {
    if (by === 'days') {
      if (daysRaw === null || daysRaw < TRIP_LIMITS.minDays || daysRaw > TRIP_LIMITS.maxDays) errors.days = `Choose between ${TRIP_LIMITS.minDays} and ${TRIP_LIMITS.maxDays} days.`
      else { days = daysRaw; depart = departureFor(arrive, days) }
    } else if (!isLocalDate(departRaw)) {
      errors.depart = 'Enter the date you leave your destination.'
    } else if (daysBetween(arrive, departRaw) < 0) {
      errors.depart = 'The departure date must be on or after the arrival date.'
    } else {
      depart = departRaw
      days = tripDays(arrive, depart)
      if (days > TRIP_LIMITS.maxDays) errors.depart = `The planner covers trips of up to ${TRIP_LIMITS.maxDays} days. Choose an earlier departure date.`
    }
  }
  if (!arrive) { arrive = arriveRaw.slice(0, 10); depart = departRaw.slice(0, 10) }

  const typeRaw = get('travellerType')
  const travellerType = (TRAVELLER_TYPES.some((t) => t.value === typeRaw) ? typeRaw : 'solo') as TravellerType
  const adults = int(get('adults')) ?? (travellerType === 'solo' ? 1 : 2)
  const childCount = int(get('children')) ?? 0
  const ages = getAll('childAge').map((a) => int(a))
  const childAges: number[] = []
  if (adults < 1 || adults > TRIP_LIMITS.maxAdults) errors.adults = `Enter between 1 and ${TRIP_LIMITS.maxAdults} adults.`
  if (childCount > TRIP_LIMITS.maxChildren) errors.childAges = `Enter up to ${TRIP_LIMITS.maxChildren} children.`
  for (let i = 0; i < Math.min(childCount, TRIP_LIMITS.maxChildren); i++) {
    const a = ages[i]
    if (a === null || a === undefined || a > 17) { errors.childAges = 'Enter the age of each child (0 to 17) on the arrival date.'; childAges.push(0) }
    else childAges.push(a)
  }
  if (travellerType === 'solo' && (adults !== 1 || childAges.length)) errors.adults = 'A solo trip is one adult. Choose Couple, Family or Group for more people.'
  if (travellerType === 'couple' && (adults !== 2 || childAges.length)) errors.adults = 'A couple is two adults. Choose Family for children, or Group.'
  if (travellerType === 'family' && !childAges.length) errors.childAges = 'Add the children and their ages, or choose Couple or Group.'

  const currencyRaw = get('currency').toUpperCase()
  const currency = ((TRIP_CURRENCIES as readonly string[]).includes(currencyRaw) ? currencyRaw : 'AUD') as TripCurrency
  const budgetRaw = get('budget')
  const budget = budgetRaw ? readAmount(budgetRaw) : null
  if (!budgetRaw) errors.budget = 'Enter your total budget for the trip, so we can compare the estimate with it.'
  else if (budget === null || budget <= 0 || budget > TRIP_LIMITS.maxBudget) errors.budget = 'Enter the budget as a number, for example 5000.'

  const interests = getAll('interests').filter((v): v is Interest => INTERESTS.some((i) => i.value === v))
  const paceRaw = get('pace')
  const pace = (TRIP_PACES.some((p) => p.value === paceRaw) ? paceRaw : 'balanced') as TripPace
  const stayRaw = get('stay')
  const stay = (STAY_LEVELS.some((s) => s.value === stayRaw) ? stayRaw : 'mid') as StayLevel
  const roomsRaw = int(get('rooms'))
  const rooms = roomsRaw !== null && roomsRaw >= 1 && roomsRaw <= 9 ? roomsRaw : null
  const time = (k: string): DayTime | null => (['morning', 'afternoon', 'evening'].includes(get(k)) ? (get(k) as DayTime) : null)
  const amount = (k: string): number | null => {
    const raw = get(k)
    if (!raw) return null
    const n = readAmount(raw)
    if (n === null || n < 0 || n > TRIP_LIMITS.maxBudget) { errors[k as keyof TripForm] = 'Enter the amount as a number, for example 1200.'; return null }
    return n
  }
  const flightBooked = get('flightBooked') === 'on' || get('flightBooked') === '1'
  const hotelBooked = get('hotelBooked') === 'on' || get('hotelBooked') === '1'

  const form: TripForm = {
    origin, destination, arrive, depart, days, nights: tripNights(days), travellerType, adults, childAges, budget, currency,
    interests: [...new Set(interests)], pace, stay, rooms,
    roomNotes: cleanLine(get('roomNotes'), 200),
    accessibility: cleanText(get('accessibility'), 400),
    dietary: cleanText(get('dietary'), 300),
    mustSee: cleanText(get('mustSee'), 500),
    flightBooked, flightAmount: flightBooked ? amount('flightAmount') : null, flightPaid: flightBooked && (get('flightPaid') === 'on' || get('flightPaid') === '1'),
    hotelBooked, hotelName: hotelBooked ? cleanLine(get('hotelName'), 140) : '', hotelAmount: hotelBooked ? amount('hotelAmount') : null, hotelPaid: hotelBooked && (get('hotelPaid') === 'on' || get('hotelPaid') === '1'),
    breakfastIncluded: get('breakfastIncluded') === 'on' || get('breakfastIncluded') === '1',
    arrivalTime: time('arrivalTime'), departureTime: time('departureTime'),
  }
  return { form, errors, ok: Object.keys(errors).length === 0 }
}

/** Everyone on the trip. */
export const travellers = (f: Pick<TripForm, 'adults' | 'childAges'>): number => f.adults + f.childAges.length

/** Rooms needed: the traveller's own number, or one per two adults (children share with adults). */
export const roomsFor = (f: Pick<TripForm, 'adults' | 'childAges' | 'rooms'>): number => f.rooms ?? Math.max(1, Math.ceil(f.adults / 2) + (f.childAges.length > 2 * Math.ceil(f.adults / 2) ? 1 : 0))

/** A short description of the party, for headings: "2 adults, 2 children (6, 9)". */
export function partyText(f: Pick<TripForm, 'adults' | 'childAges'>): string {
  const a = `${f.adults} ${f.adults === 1 ? 'adult' : 'adults'}`
  if (!f.childAges.length) return a
  return `${a}, ${f.childAges.length} ${f.childAges.length === 1 ? 'child' : 'children'} (${f.childAges.join(', ')})`
}
