import { createHash } from 'node:crypto'

import { cms, run, sql } from './db'
import { fail } from './errors'

/**
 * Rate limits kept in the database, so they hold across serverless instances and restarts.
 * A fixed window per key: the first hit starts the window, the counter resets when it ends.
 */
const RULES = {
  signup_ip: { limit: 6, seconds: 3600, message: 'Too many sign-up attempts. Please try again in an hour.' },
  signin_ip: { limit: 30, seconds: 900, message: 'Too many sign-in attempts. Please wait 15 minutes.' },
  signin_account: { limit: 10, seconds: 900, message: 'Too many sign-in attempts. Please wait 15 minutes.' },
  signin_account_total: { limit: 100, seconds: 3600, message: 'Too many sign-in attempts. Please wait an hour, or reset your password.' },
  recovery_ip: { limit: 6, seconds: 3600, message: 'Too many requests. Please try again in an hour.' },
  recovery_account: { limit: 3, seconds: 3600, message: 'Too many requests. Please try again in an hour.' },
  submission: { limit: 12, seconds: 86_400, message: 'You have reached today’s limit for new submissions. Please try again tomorrow.' },
  draft_save: { limit: 600, seconds: 3600, message: 'Too many saves. Please wait a few minutes.' },
  reply: { limit: 30, seconds: 3600, message: 'You are replying very quickly. Please wait a while before posting again.' },
  vote: { limit: 200, seconds: 3600, message: 'Too many actions. Please wait a few minutes.' },
  engagement: { limit: 400, seconds: 3600, message: 'Too many actions. Please wait a few minutes.' },
  report: { limit: 20, seconds: 86_400, message: 'You have reached today’s limit for reports. Thank you; moderators will review what you sent.' },
  upload: { limit: 40, seconds: 86_400, message: 'You have reached today’s limit for photo uploads.' },
  suggestion: { limit: 10, seconds: 86_400, message: 'You have reached today’s limit for destination suggestions.' },
  search_ip: { limit: 90, seconds: 60, message: 'Too many searches. Please wait a minute.' },
  contact_ip: { limit: 5, seconds: 3600, message: 'You have sent several messages in a short time. Please wait an hour, or email us directly.' },
  contact_all: { limit: 300, seconds: 86_400, message: 'The contact form is very busy right now. Please try again tomorrow, or email us directly.' },
  newsletter_ip: { limit: 10, seconds: 3600, message: 'Too many sign-up attempts. Please try again in an hour.' },
  newsletter_email: { limit: 3, seconds: 86_400, message: 'We have already sent a confirmation email to this address today. Please check your inbox and spam folder.' },
  export: { limit: 5, seconds: 86_400, message: 'You can download your data a few times a day. Please try again tomorrow.' },
} as const

export type RateRule = keyof typeof RULES

/** Network addresses are hashed before they are used as a key, so no raw IP address is stored. */
export const hashSubject = (value: string): string => createHash('sha256').update(`tn-rate:${value}`).digest('hex').slice(0, 32)

/** Count one hit and report whether it is within the limit. */
/**
 * Automated tests post far more than a person would. They may raise the limits with
 * COMMUNITY_RATE_LIMIT_MULTIPLIER, which is ignored in a production build so it can never weaken a live site.
 */
const multiplier = (): number => {
  const value = Number(process.env.COMMUNITY_RATE_LIMIT_MULTIPLIER)
  return process.env.NODE_ENV !== 'production' && Number.isFinite(value) && value >= 1 ? value : 1
}

export async function hit(rule: RateRule, subject: string, override?: { limit: number; seconds: number }): Promise<{ allowed: boolean; count: number }> {
  const base = override ?? RULES[rule]
  const { seconds } = base
  const limit = override ? base.limit : base.limit * multiplier()
  const payload = await cms()
  const key = `${rule}:${subject}`
  const result = await run(
    payload,
    sql`INSERT INTO "rate_limits" ("key", "count", "expires_at")
        VALUES (${key}, 1, now() + make_interval(secs => ${seconds}))
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "rate_limits"."expires_at" <= now() THEN 1 ELSE "rate_limits"."count" + 1 END,
          "expires_at" = CASE WHEN "rate_limits"."expires_at" <= now() THEN EXCLUDED."expires_at" ELSE "rate_limits"."expires_at" END
        RETURNING "count"`,
  )
  const count = Number(result.rows[0]?.count ?? 0)
  return { allowed: count <= limit, count }
}

/** Count one hit and stop with a clear message when the limit is passed. */
export async function limit(rule: RateRule, subject: string | null | undefined): Promise<void> {
  if (!subject) return
  const { allowed } = await hit(rule, subject)
  if (!allowed) fail('rate_limited', RULES[rule].message)
}

/** Remove finished windows. Run by the daily job. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const payload = await cms()
  const result = await run(payload, sql`DELETE FROM "rate_limits" WHERE "expires_at" <= now()`)
  return Number(result.rowCount ?? 0)
}
