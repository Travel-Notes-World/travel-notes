import { cms, run, sql } from './db'
import { outboxHealth } from './email/outbox'
import { emailMode, emailProblem } from './email/transport'
import { fail } from './errors'
import { totalsSince } from './metrics'
import { getSettings, type Settings } from './settings'
import { uploadsAvailable } from './storage'
import type { StaffActor } from './types'

export type Dashboard = {
  settings: Settings
  backlog: { submissions: number; edits: number; replies: number; reports: number; suggestions: number; oldestWaitingHours: number | null }
  content: { published: { question: number; trip: number; activity: number }; unansweredQuestions: number; members: number; suspended: number }
  /** Null when there is not enough real data to give an honest figure. */
  medianHoursToFirstAnswer: number | null
  answersMeasured: number
  activeContributors30d: number
  acceptedAnswers30d: number
  topDestinations: { name: string; posts: number }[]
  email: { mode: string; problem: string; pending: number; failed: number; oldestPendingMinutes: number | null }
  uploads: boolean
  jobs: { job: string; ok: boolean; summary: string; at: string }[]
  cronConfigured: boolean
  events30d: Record<string, number>
}

/**
 * Numbers for the owner dashboard, all counted from real rows at the moment the page is opened.
 * A figure that needs data the site does not have yet is returned as null and shown as "no data yet".
 */
export async function getDashboard(staff: StaffActor): Promise<Dashboard> {
  if (!staff || !staff.canModerate) fail('forbidden', 'Only moderators can see this.')
  const payload = await cms()
  const one = async (query: ReturnType<typeof sql>) => (await run(payload, query)).rows[0] ?? {}
  const [backlog, content, answer, active, top, health, jobs, settings, events] = await Promise.all([
    one(sql`SELECT
        (SELECT COUNT(*) FROM "contributions" WHERE "state" = 'pending') AS submissions,
        (SELECT COUNT(*) FROM "contributions" WHERE "state" = 'published' AND "pending_revision_id" IS NOT NULL) AS edits,
        (SELECT COUNT(*) FROM "replies" WHERE "state" = 'pending') AS replies,
        (SELECT COUNT(*) FROM "reports" WHERE "status" = 'open') AS reports,
        (SELECT COUNT(*) FROM "destination_suggestions" WHERE "status" = 'pending') AS suggestions,
        (SELECT EXTRACT(EPOCH FROM (now() - MIN(t))) / 3600 FROM (
           SELECT MIN("submitted_at") AS t FROM "contributions" WHERE "pending_revision_id" IS NOT NULL AND "state" IN ('pending', 'published')
           UNION ALL SELECT MIN("created_at") FROM "replies" WHERE "state" = 'pending'
           UNION ALL SELECT MIN("created_at") FROM "reports" WHERE "status" = 'open') w) AS oldest`),
    one(sql`SELECT
        COUNT(*) FILTER (WHERE "type" = 'question' AND "state" = 'published') AS question,
        COUNT(*) FILTER (WHERE "type" = 'trip' AND "state" = 'published') AS trip,
        COUNT(*) FILTER (WHERE "type" = 'activity' AND "state" = 'published') AS activity,
        COUNT(*) FILTER (WHERE "type" = 'question' AND "state" = 'published' AND COALESCE("reply_count", 0) = 0) AS unanswered,
        (SELECT COUNT(*) FROM "members" WHERE "status" = 'active' AND "_verified" = true) AS members,
        (SELECT COUNT(*) FROM "members" WHERE "status" = 'suspended') AS suspended
      FROM "contributions"`),
    // Time from a question being approved to its first approved answer, for questions approved in the last 90 days.
    one(sql`SELECT COUNT(*) AS n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_answer - published_at)) / 3600) AS median FROM (
        SELECT c."published_at", (SELECT MIN(r."published_at") FROM "replies" r WHERE r."contribution_id" = c."id" AND r."state" = 'published' AND r."parent_id" IS NULL) AS first_answer
        FROM "contributions" c WHERE c."type" = 'question' AND c."state" = 'published' AND c."published_at" >= now() - interval '90 days') q WHERE first_answer IS NOT NULL AND first_answer >= published_at`),
    one(sql`SELECT COUNT(DISTINCT author) AS n,
        (SELECT COUNT(*) FROM "moderation_actions" WHERE "action" = 'accept_answer' AND "created_at" >= now() - interval '30 days') AS accepted FROM (
        SELECT "author_id" AS author FROM "contributions" WHERE "state" = 'published' AND "published_at" >= now() - interval '30 days'
        UNION SELECT "author_id" FROM "replies" WHERE "state" = 'published' AND "published_at" >= now() - interval '30 days') a`),
    run(payload, sql`SELECT d."name", COUNT(DISTINCT c."id") AS posts FROM "contributions_rels" r
        JOIN "contributions" c ON c."id" = r."parent_id" AND c."state" = 'published'
        JOIN "destinations" d ON d."id" = r."destinations_id" WHERE r."path" = 'destinations' GROUP BY d."name" ORDER BY posts DESC, d."name" LIMIT 10`),
    outboxHealth(),
    payload.find({ collection: 'job-runs', sort: '-createdAt', limit: 10, depth: 0 }),
    getSettings(),
    totalsSince(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ])
  const n = (v: unknown) => Number(v ?? 0)
  const measured = n(answer.n)
  return {
    settings,
    backlog: { submissions: n(backlog.submissions), edits: n(backlog.edits), replies: n(backlog.replies), reports: n(backlog.reports), suggestions: n(backlog.suggestions), oldestWaitingHours: backlog.oldest == null ? null : Math.round(n(backlog.oldest)) },
    content: { published: { question: n(content.question), trip: n(content.trip), activity: n(content.activity) }, unansweredQuestions: n(content.unanswered), members: n(content.members), suspended: n(content.suspended) },
    // With fewer than five answered questions a "median" would be noise presented as a statistic.
    medianHoursToFirstAnswer: measured >= 5 && answer.median != null ? Math.round(n(answer.median) * 10) / 10 : null,
    answersMeasured: measured,
    activeContributors30d: n(active.n),
    acceptedAnswers30d: n(active.accepted),
    topDestinations: top.rows.map((r) => ({ name: String(r.name), posts: n(r.posts) })),
    email: { mode: emailMode(), problem: emailProblem(), ...health },
    uploads: uploadsAvailable(),
    jobs: jobs.docs.map((j) => ({ job: j.job, ok: Boolean(j.ok), summary: j.summary ?? '', at: j.createdAt })),
    cronConfigured: Boolean(process.env.CRON_SECRET),
    events30d: events,
  }
}
