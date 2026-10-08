import { cms, run, sql } from './db'
import { deliverOutbox } from './email/outbox'
import { markEndedEvents } from './events'
import { cleanupPhotos } from './media'
import { purgeExpiredRateLimits } from './ratelimit'
import { sendDigests } from './digest'

/**
 * Scheduled jobs. Every job can be run at any time, any number of times: each one only acts on
 * what is due and leaves the rest alone. A database advisory lock stops two runs of the same job
 * from overlapping. Every run is recorded, so a failure shows on the owner dashboard.
 *
 * Nothing here runs in memory between requests: on serverless hosting a job is one request.
 */
export const JOBS = {
  outbox: async () => { const r = await deliverOutbox({ limit: 100 }); return `attempted ${r.attempted}, sent ${r.sent}, captured ${r.captured}, suppressed ${r.suppressed}, retrying ${r.retrying}, failed ${r.failed}` },
  events: async () => `marked ${await markEndedEvents()} activities as ended`,
  photos: async () => `deleted ${await cleanupPhotos()} unused photos`,
  'rate-limits': async () => `removed ${await purgeExpiredRateLimits()} finished rate-limit windows`,
  digest: async () => { const r = await sendDigests(); return `queued ${r.queued} digests for ${r.considered} subscribers` },
} as const
export type JobName = keyof typeof JOBS

const lockKey = (job: string): number => [...`tn-job:${job}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

export type JobResult = { job: string; ok: boolean; summary: string; skipped?: boolean }

export async function runJob(job: JobName): Promise<JobResult> {
  const payload = await cms()
  const started = Date.now()
  const key = lockKey(job)
  const locked = await run(payload, sql`SELECT pg_try_advisory_lock(${key}) AS locked`)
  if (!locked.rows[0]?.locked) return { job, ok: true, summary: 'already running elsewhere', skipped: true }
  let result: JobResult
  try {
    result = { job, ok: true, summary: await JOBS[job]() }
  } catch (error) {
    result = { job, ok: false, summary: (error instanceof Error ? error.message : String(error)).slice(0, 300) }
    payload.logger.error({ err: error }, `[community] job ${job} failed`)
  } finally {
    await run(payload, sql`SELECT pg_advisory_unlock(${key})`).catch(() => undefined)
  }
  await payload.create({ collection: 'job-runs', data: { job, ok: result.ok, summary: result.summary, durationMs: Date.now() - started } }).catch(() => undefined)
  return result
}

/** Everything that should happen once a day. One failing job does not stop the others. */
export async function runDaily(): Promise<JobResult[]> {
  const results: JobResult[] = []
  for (const job of ['outbox', 'events', 'photos', 'rate-limits', 'digest'] as JobName[]) results.push(await runJob(job))
  // Keep three months of run history.
  const payload = await cms()
  await run(payload, sql`DELETE FROM "job_runs" WHERE "created_at" < now() - interval '90 days'`).catch(() => undefined)
  return results
}
