import { createHash, timingSafeEqual } from "node:crypto";

import { JOBS, runDaily, runJob, type JobName, type JobResult } from "@/lib/community/jobs";

/**
 * Scheduled jobs, called by Vercel Cron (see vercel.json) or by hand with the same secret:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/cron/daily
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/cron/outbox
 *
 * "daily" runs every job in order; any key of JOBS runs that one job. Each job is idempotent and
 * protected by a database lock (src/lib/community/jobs.ts), so a duplicate or overlapping call is safe.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Hobby with Fluid compute (the default) allows up to 300 seconds.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

/** Compare in constant time. Hashing first gives equal lengths, so the length is not leaked either. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const isJobName = (value: string): value is JobName => Object.prototype.hasOwnProperty.call(JOBS, value);

export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET is not set, so scheduled jobs are switched off." }, { status: 503, headers: NO_STORE });
  const header = request.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${secret}`)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { job } = await params;
  if (job !== "daily" && !isJobName(job)) {
    return Response.json({ ok: false, error: "Unknown job.", jobs: ["daily", ...Object.keys(JOBS)] }, { status: 404, headers: NO_STORE });
  }
  const started = Date.now();
  const results: JobResult[] = job === "daily" ? await runDaily() : [await runJob(job)];
  const ok = results.every((r) => r.ok);
  // 500 when a job failed, so the failure shows in Vercel's cron logs; the details are in the body and the owner dashboard.
  return Response.json({ ok, job, durationMs: Date.now() - started, results }, { status: ok ? 200 : 500, headers: NO_STORE });
}
