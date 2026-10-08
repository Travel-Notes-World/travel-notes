import { cms, run, sql } from './db'

/**
 * First-party counters for the owner dashboard.
 *
 * Only these events exist, and each stores nothing but its name, the day and one public id.
 * No member id, email, question text, search words, trip dates or notes are ever recorded.
 * There is no third-party analytics script and no tracking cookie in this release.
 */
export const EVENTS = [
  'destination_view', 'community_search', 'question_submitted', 'contribution_approved', 'answer_published', 'answer_accepted',
  'trip_report_published', 'activity_published', 'activity_rsvp', 'bookmark_added', 'plan_created', 'itinerary_copied',
  'destination_followed', 'report_submitted', 'affiliate_click', 'member_verified',
] as const
export type MetricEvent = (typeof EVENTS)[number]

/** Permitted dimension values: a content type, or a destination or public content id. Never free text. */
const SAFE_DIMENSION = /^[a-z0-9_:-]{1,60}$/i

/** Add one to today's total. Never throws: a counting problem must not break what the member was doing. */
export async function track(event: MetricEvent, dimension?: string | null): Promise<void> {
  try {
    const payload = await cms()
    const day = new Date().toISOString().slice(0, 10)
    const dim = dimension && SAFE_DIMENSION.test(dimension) ? dimension : ''
    const key = `${event}|${day}|${dim}`
    await run(
      payload,
      sql`INSERT INTO "metric_counters" ("key", "event", "day", "dimension", "count") VALUES (${key}, ${event}, ${day}, ${dim || null}, 1)
          ON CONFLICT ("key") DO UPDATE SET "count" = "metric_counters"."count" + 1`,
    )
  } catch {
    // Counting is best-effort.
  }
}

/** Totals per event since a day (inclusive). */
export async function totalsSince(day: string): Promise<Record<string, number>> {
  const payload = await cms()
  const result = await run(payload, sql`SELECT "event", SUM("count") AS total FROM "metric_counters" WHERE "day" >= ${day} GROUP BY "event"`)
  return Object.fromEntries(result.rows.map((r) => [String(r.event), Number(r.total)]))
}
