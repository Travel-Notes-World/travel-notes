import { isLocalDate } from '../community/time'
import { MONTHS, type Month } from '../content/destinationFacts'

/**
 * The Trip Planner's inputs, read from the page address (/trip-planner?to=…&start=…&days=…).
 *
 * Everything the planner needs is in the address, so a plan can be shared as a link, works without
 * an account and stores nothing. No personal details are ever put in the address: only destination
 * ids, dates, a day count and two simple preferences.
 *
 * This file has no database access, so its rules can be tested directly.
 */

export const PLANNER = {
  maxPlaces: 5,
  minDays: 1,
  maxDays: 30,
  defaultDays: 7,
} as const

export const PARTIES = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family with children' },
  { value: 'friends', label: 'Friends or group' },
] as const
export type Party = (typeof PARTIES)[number]['value']

/**
 * Pace is the traveller's own choice. The hint is Travel Notes' general planning suggestion, shown as
 * a suggestion, not a fact about any destination.
 */
export const PACES = [
  { value: 'relaxed', label: 'Relaxed', hint: 'One or two main things a day, with time to rest.' },
  { value: 'balanced', label: 'Balanced', hint: 'Two or three main things a day.' },
  { value: 'full', label: 'Full days', hint: 'Early starts and three or more things a day.' },
] as const
export type Pace = (typeof PACES)[number]['value']

export type PlannerInput = {
  placeIds: string[]
  /** First day of the trip, YYYY-MM-DD. */
  start: string | null
  /** Month of travel when there is no exact start date. */
  month: Month | null
  days: number
  /** Days in each place, in the order of `placeIds`. Always adds up to `days`. */
  split: number[]
  party: Party | null
  pace: Pace
}

export type PlannerErrors = Partial<Record<'to' | 'start' | 'days' | 'split', string>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: string) => UUID.test(v)

type Params = Record<string, string | string[] | undefined>

const all = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]).flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean)
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim()

/** Spread `total` days over `count` places as evenly as possible; earlier places get the spare days. */
export function evenSplit(total: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(total / count)
  return Array.from({ length: count }, (_, i) => base + (i < total % count ? 1 : 0))
}

/**
 * Days per place. A requested split is used when it is complete and every place has at least one
 * day; otherwise the days are spread evenly. A trip shorter than its number of places still gives
 * every place a day (and the total grows to match), because a place with no day cannot be planned.
 */
export function splitDays(total: number, count: number, requested: number[] = []): { split: number[]; days: number; error?: string } {
  if (count === 0) return { split: [], days: total }
  if (requested.length === count) {
    if (requested.every((n) => Number.isInteger(n) && n >= 1)) {
      const sum = requested.reduce((a, b) => a + b, 0)
      if (sum <= PLANNER.maxDays) return { split: requested, days: sum }
      return { split: evenSplit(Math.max(total, count), count), days: Math.max(total, count), error: `A trip can be up to ${PLANNER.maxDays} days. The days are shared out evenly instead.` }
    }
    return { split: evenSplit(Math.max(total, count), count), days: Math.max(total, count), error: 'Give each place at least one day.' }
  }
  const days = Math.max(total, count)
  return { split: evenSplit(days, count), days }
}

export function readPlannerInput(params: Params): { input: PlannerInput; errors: PlannerErrors; submitted: boolean } {
  const errors: PlannerErrors = {}
  const ids = [...new Set(all(params.to))]
  const placeIds = ids.filter(isUuid).slice(0, PLANNER.maxPlaces)
  if (ids.length > PLANNER.maxPlaces) errors.to = `Choose up to ${PLANNER.maxPlaces} places. Only the first ${PLANNER.maxPlaces} are planned.`

  const startRaw = one(params.start)
  const start = isLocalDate(startRaw) ? startRaw : null
  if (startRaw && !start) errors.start = 'Enter a valid start date.'

  const monthRaw = one(params.month).toLowerCase().slice(0, 3)
  const month = !start && (MONTHS as readonly string[]).includes(monthRaw) ? (monthRaw as Month) : null

  const daysRaw = one(params.days)
  let days: number = PLANNER.defaultDays
  if (daysRaw) {
    const n = Number(daysRaw)
    if (Number.isInteger(n) && n >= PLANNER.minDays && n <= PLANNER.maxDays) days = n
    else errors.days = `Choose between ${PLANNER.minDays} and ${PLANNER.maxDays} days.`
  }

  const requested = all(params.split).map(Number)
  const shared = splitDays(days, placeIds.length, requested)
  if (shared.error) errors.split = shared.error

  const partyRaw = one(params.with)
  const party = PARTIES.some((p) => p.value === partyRaw) ? (partyRaw as Party) : null
  const paceRaw = one(params.pace)
  const pace = PACES.some((p) => p.value === paceRaw) ? (paceRaw as Pace) : 'balanced'

  return { input: { placeIds, start, month, days: shared.days, split: shared.split, party, pace }, errors, submitted: ids.length > 0 }
}

/** The address of a plan. Only the parts that differ from the defaults are written, so links stay short. */
export function plannerHref(input: Partial<PlannerInput> & { placeIds: string[] }): string {
  const q = new URLSearchParams()
  for (const id of input.placeIds) q.append('to', id)
  if (input.start) q.set('start', input.start)
  else if (input.month) q.set('month', input.month)
  if (input.days && input.days !== PLANNER.defaultDays) q.set('days', String(input.days))
  if (input.split && input.split.length > 1) q.set('split', input.split.join(','))
  if (input.party) q.set('with', input.party)
  if (input.pace && input.pace !== 'balanced') q.set('pace', input.pace)
  const s = q.toString()
  return s ? `/trip-planner?${s}` : '/trip-planner'
}

/** YYYY-MM-DD plus a number of days, in calendar terms (no time zone involved). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export type PlannedDay = { number: number; date: string | null; placeIndex: number; firstInPlace: boolean; lastInPlace: boolean }

/** The trip's days in order, each assigned to a place. */
export function planDays(input: Pick<PlannerInput, 'start' | 'split'>): PlannedDay[] {
  const out: PlannedDay[] = []
  input.split.forEach((count, placeIndex) => {
    for (let i = 0; i < count; i++) {
      const number = out.length + 1
      out.push({ number, date: input.start ? addDays(input.start, number - 1) : null, placeIndex, firstInPlace: i === 0, lastInPlace: i === count - 1 })
    }
  })
  return out
}

/** The months the trip touches: from the dates, or the chosen month, or none. */
export function tripMonths(input: Pick<PlannerInput, 'start' | 'month' | 'days'>): Month[] {
  if (input.start) {
    const months: Month[] = []
    for (let i = 0; i < input.days; i++) {
      const m = MONTHS[Number(addDays(input.start, i).slice(5, 7)) - 1]
      if (!months.includes(m)) months.push(m)
    }
    return months
  }
  return input.month ? [input.month] : []
}

/** The trip's period as UTC instants, padded by a day each side so local time zones never cut an event off. */
export function tripWindow(input: Pick<PlannerInput, 'start' | 'days'>): { from: Date; to: Date } | null {
  if (!input.start) return null
  return { from: new Date(`${addDays(input.start, -1)}T00:00:00Z`), to: new Date(`${addDays(input.start, input.days + 1)}T00:00:00Z`) }
}
