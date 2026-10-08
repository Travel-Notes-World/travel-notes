/**
 * Dates and time zones.
 *
 * Three different things are kept apart:
 * - an INSTANT (a UTC timestamp), used for event start and end;
 * - a LOCAL DATE ("2026-11-01", no time zone), used for all-day events and trip dates;
 * - a LOCAL DATE-TIME ("2026-11-01T18:30") in a named IANA zone, which is what an organiser types.
 */

export function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone || zone.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = LOCAL_DATE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return y >= 1900 && y <= 2200 && date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

export function isLocalDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = LOCAL_DATE_TIME.exec(value)
  return Boolean(m) && isLocalDate(value.slice(0, 10)) && Number(m![4]) < 24 && Number(m![5]) < 60
}

/** Add calendar days to a local date. No time zone is involved, so no daylight-saving surprises. */
export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Whole days from one local date to another, counting both ends: 1 May to 3 May is 3 days. */
export function inclusiveDays(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()
const partsFor = (zone: string) => {
  let f = partsFormatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    partsFormatters.set(zone, f)
  }
  return f
}

/** The wall-clock date-time ("2026-11-01T18:30") shown in `zone` at this instant. */
export function toLocalDateTime(instant: Date, zone: string): string {
  const p: Record<string, string> = {}
  for (const part of partsFor(zone).formatToParts(instant)) p[part.type] = part.value
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

export const toLocalDate = (instant: Date, zone: string): string => toLocalDateTime(instant, zone).slice(0, 10)

const asUtc = (local: string): number => {
  const m = LOCAL_DATE_TIME.exec(local)!
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
}

/** Minutes that `zone` is ahead of UTC at this instant. */
const offsetMinutes = (instantMs: number, zone: string): number => Math.round((asUtc(toLocalDateTime(new Date(instantMs), zone)) - instantMs) / 60_000)

/**
 * Convert a wall-clock date-time in a zone to the instant it means.
 *
 * Daylight saving creates two special cases, both handled deliberately:
 * - a time that happens twice (clocks go back): the FIRST occurrence is used;
 * - a time that does not exist (clocks go forward): it is moved forward by the size of the gap,
 *   the same rule calendars use. 02:30 on a night when 02:00 jumps to 03:00 becomes 03:30.
 */
export function zonedToUtc(local: string, zone: string): Date {
  const wall = asUtc(local)
  const first = wall - offsetMinutes(wall, zone) * 60_000
  const second = wall - offsetMinutes(first, zone) * 60_000
  const candidates = [...new Set([first, second])].sort((a, b) => a - b)
  for (const candidate of candidates) {
    if (toLocalDateTime(new Date(candidate), zone) === local) return new Date(candidate)
  }
  return new Date(candidates[candidates.length - 1])
}

export type EventTimes = { startsAt: Date; endsAt: Date | null }

/**
 * Instants for an event.
 * All-day: starts at local midnight of the first day and ends at local midnight after the last
 * day, so the event counts as running for the whole of each local day whatever the zone.
 */
export function eventInstants(input: { allDay: boolean; startLocal: string; endLocal?: string | null; timeZone: string }): EventTimes {
  if (input.allDay) {
    const start = input.startLocal.slice(0, 10)
    const end = (input.endLocal || input.startLocal).slice(0, 10)
    return { startsAt: zonedToUtc(`${start}T00:00`, input.timeZone), endsAt: zonedToUtc(`${addDays(end, 1)}T00:00`, input.timeZone) }
  }
  return { startsAt: zonedToUtc(input.startLocal, input.timeZone), endsAt: input.endLocal ? zonedToUtc(input.endLocal, input.timeZone) : null }
}

/** An event with no stated end is treated as lasting this long when deciding whether it is over. */
export const ASSUMED_EVENT_HOURS = 4

type EventLike = { eventStatus?: string | null; startsAt?: string | Date | null; endsAt?: string | Date | null }

/** When the event is over, as an instant. */
export function eventEnd(event: EventLike): Date | null {
  if (event.endsAt) return new Date(event.endsAt)
  if (event.startsAt) return new Date(new Date(event.startsAt).getTime() + ASSUMED_EVENT_HOURS * 3_600_000)
  return null
}

/**
 * The status to show right now. The stored status can lag behind if the scheduled job has not
 * run, so "ended" is always worked out from the clock at read time. Yesterday's event can never
 * appear as upcoming because a job failed.
 */
export function currentEventStatus(event: EventLike, now = new Date()): string {
  const status = event.eventStatus || 'scheduled'
  if (status === 'cancelled' || status === 'ended') return status
  const end = eventEnd(event)
  // A postponed event has no trustworthy date, so the clock does not end it.
  if (status !== 'postponed' && end && end.getTime() <= now.getTime()) return 'ended'
  return status
}

export const isUpcoming = (event: EventLike, now = new Date()): boolean => {
  const status = currentEventStatus(event, now)
  return status === 'scheduled' || status === 'rescheduled' || status === 'postponed'
}

/** True when two periods share at least one moment. Open-ended periods are allowed. */
export const overlaps = (aStart: Date, aEnd: Date | null, bStart: Date | null, bEnd: Date | null): boolean =>
  (!bEnd || aStart.getTime() < bEnd.getTime()) && (!bStart || (aEnd ?? aStart).getTime() >= bStart.getTime())

export function formatEventTime(event: { allDay?: boolean | null; startLocal?: string | null; endLocal?: string | null; timeZone?: string | null }): string {
  if (!event.startLocal) return ''
  const day = (local: string) => new Date(`${local.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const clock = (local: string) => local.slice(11, 16)
  const zone = event.timeZone ? ` (${event.timeZone.replace(/_/g, ' ')} time)` : ''
  if (event.allDay) {
    const end = event.endLocal && event.endLocal.slice(0, 10) !== event.startLocal.slice(0, 10) ? ` to ${day(event.endLocal)}` : ''
    return `${day(event.startLocal)}${end}, all day${zone}`
  }
  if (!event.endLocal) return `${day(event.startLocal)}, ${clock(event.startLocal)}${zone}`
  const sameDay = event.endLocal.slice(0, 10) === event.startLocal.slice(0, 10)
  return sameDay
    ? `${day(event.startLocal)}, ${clock(event.startLocal)} to ${clock(event.endLocal)}${zone}`
    : `${day(event.startLocal)}, ${clock(event.startLocal)} to ${day(event.endLocal)}, ${clock(event.endLocal)}${zone}`
}

export const formatDate = (value: string | Date | null | undefined): string =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

export const formatYearMonth = (value: string | null | undefined): string =>
  value && /^\d{4}-\d{2}$/.test(value) ? new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
