import type { Where } from 'payload'

import { ACTIVITY_CATEGORIES, ACTIVITY_FORMATS, LIMITS, optionValues } from './constants'
import { cms } from './db'
import { isUuid } from './destinations'
import { cardsByIds, upcomingWhere, type Card } from './queries'
import { addDays, isLocalDate } from './time'
import type { Page } from './types'

/**
 * The public activity directory: the same rules as `listPublished` for activities (approved only,
 * upcoming worked out from the clock), plus filters that list does not have: category, format,
 * and a date range matched against each event's OWN local dates.
 *
 * Local dates are compared as text ("2026-11-01T18:30" against "2026-11-01"). The stored values
 * always have the same fixed shape, so text order is date order, and "events on 1 November" means
 * 1 November where the event happens, whatever the reader's time zone.
 */
export type ActivityListFilters = {
  destinationId?: string | null
  category?: string | null
  format?: string | null
  /** upcoming (default): not over, not cancelled. past: over, not cancelled. all: everything approved. */
  show?: 'upcoming' | 'past' | 'all'
  /** Local dates (YYYY-MM-DD), both inclusive. */
  fromDate?: string | null
  toDate?: string | null
  page?: number
  pageSize?: number
  now?: Date
}

export async function listActivities(filters: ActivityListFilters = {}): Promise<Page<Card>> {
  const payload = await cms()
  const now = filters.now ?? new Date()
  const and: Where[] = [{ state: { equals: 'published' } }, { type: { equals: 'activity' } }]
  if (filters.destinationId && isUuid(filters.destinationId)) and.push({ destinationTree: { equals: filters.destinationId } })
  if (filters.category && ACTIVITY_CATEGORIES.some((c) => c.value === filters.category)) and.push({ 'activity.category': { equals: filters.category } })
  if (filters.format && (optionValues(ACTIVITY_FORMATS) as string[]).includes(filters.format)) and.push({ 'activity.format': { equals: filters.format } })

  let sort: string[] = ['activity.startsAt', 'id']
  if (filters.show === 'past') {
    and.push({ 'activity.eventStatus': { not_equals: 'cancelled' } }, { or: [{ 'activity.endsAt': { less_than_equal: now.toISOString() } }, { 'activity.eventStatus': { equals: 'ended' } }] })
    sort = ['-activity.startsAt', 'id']
  } else if (filters.show !== 'all') {
    and.push(upcomingWhere(now))
  }

  const from = filters.fromDate && isLocalDate(filters.fromDate) ? filters.fromDate : null
  const to = filters.toDate && isLocalDate(filters.toDate) ? filters.toDate : null
  // Starts on or before the last day of the range...
  if (to) and.push({ 'activity.startLocal': { less_than: addDays(to, 1) } })
  // ...and is still running on or after the first day.
  if (from) and.push({ or: [{ 'activity.endLocal': { greater_than_equal: from } }, { and: [{ 'activity.endLocal': { exists: false } }, { 'activity.startLocal': { greater_than_equal: from } }] }] })

  const pageSize = Math.min(Math.max(filters.pageSize ?? LIMITS.pageSize, 1), 50)
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const found = await payload.find({ collection: 'contributions', where: { and }, sort, limit: pageSize, page, depth: 0, overrideAccess: false, select: { shortId: true } })
  return { items: await cardsByIds(found.docs.map((d) => d.id)), page: found.page ?? page, totalPages: found.totalPages, total: found.totalDocs }
}
