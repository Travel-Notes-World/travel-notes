import type { EmailCategory, EmailTemplate } from '../constants'
import type { Tx } from '../db'
import { cms, run, sql } from '../db'
import { renderEmail, TEMPLATE_CATEGORY } from './templates'
import { emailMode, sendEmail } from './transport'

/** Minutes to wait before attempt 2, 3, 4, 5, 6. After the sixth failure the email is marked failed. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720]
const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1

/**
 * Queue an email inside the current transaction. It is delivered only after the transaction
 * commits, so nobody is ever emailed about a change that was rolled back.
 * The same `idempotencyKey` can be queued any number of times: only the first is kept.
 */
export async function enqueueEmail(tx: Tx, input: { template: EmailTemplate; recipient: string; data: Record<string, unknown>; idempotencyKey: string }): Promise<void> {
  const result = await run(
    tx.payload,
    sql`INSERT INTO "email_outbox" ("idempotency_key", "template", "recipient_id", "data", "status", "attempts", "next_attempt_at")
        VALUES (${input.idempotencyKey}, ${input.template}::"enum_email_outbox_template", ${input.recipient}::uuid, ${JSON.stringify(input.data)}::jsonb, 'pending', 0, now())
        ON CONFLICT ("idempotency_key") DO NOTHING RETURNING "id"`,
    tx.req,
  )
  const id = result.rows[0]?.id as string | undefined
  if (id) tx.afterCommit(() => deliverOutbox({ ids: [id] }))
}

export type DeliveryReport = { attempted: number; sent: number; captured: number; suppressed: number; retrying: number; failed: number }

/**
 * Deliver queued email that is due. Safe to run at any time and from several places at once:
 * each row is claimed with a single UPDATE, so two workers can never send the same email.
 */
export async function deliverOutbox(options: { ids?: string[]; limit?: number } = {}): Promise<DeliveryReport> {
  const payload = await cms()
  const report: DeliveryReport = { attempted: 0, sent: 0, captured: 0, suppressed: 0, retrying: 0, failed: 0 }
  // Without a transport there is nothing to attempt: rows stay pending and visible, and attempts are not used up.
  if (emailMode() === 'off') return report

  const limit = Math.min(options.limit ?? 25, 100)
  const idFilter = options.ids?.length ? sql`AND "id" IN (${sql.join(options.ids.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``
  const claimed = await run(
    payload,
    sql`UPDATE "email_outbox" SET "attempts" = "attempts" + 1, "next_attempt_at" = now() + interval '10 minutes', "updated_at" = now()
        WHERE "id" IN (
          SELECT "id" FROM "email_outbox"
          WHERE "status" = 'pending' AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= now()) ${idFilter}
          ORDER BY "created_at" LIMIT ${limit} FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "template", "recipient_id", "data", "attempts", "idempotency_key"`,
  )

  for (const row of claimed.rows) {
    report.attempted++
    const id = String(row.id)
    const template = String(row.template) as EmailTemplate
    const attempts = Number(row.attempts)
    const finish = (status: string, extra: { error?: string | null; transport?: string | null; providerId?: string | null; retryInMinutes?: number } = {}) =>
      run(
        payload,
        sql`UPDATE "email_outbox" SET "status" = ${status}::"enum_email_outbox_status", "last_error" = ${extra.error ?? null}, "transport" = ${extra.transport ?? null},
            "provider_id" = ${extra.providerId ?? null}, "sent_at" = ${status === 'sent' || status === 'captured' ? sql`now()` : sql`NULL`},
            "next_attempt_at" = ${extra.retryInMinutes ? sql`now() + make_interval(mins => ${extra.retryInMinutes})` : sql`NULL`}, "updated_at" = now()
            WHERE "id" = ${id}::uuid`,
      )

    const member = row.recipient_id
      ? await payload.findByID({ collection: 'members', id: String(row.recipient_id), depth: 0, disableErrors: true }).catch(() => null)
      : null
    const category: EmailCategory | null = TEMPLATE_CATEGORY[template]
    // Checked at send time, not only when queued: a member who has since unsubscribed, been suspended or deleted gets nothing.
    const optedOut = category ? member?.emailPrefs?.[category] === false : false
    if (!member || member.status === 'deleted' || !member.email || optedOut || (category && member.status !== 'active')) {
      await finish('suppressed', { error: !member || member.status === 'deleted' ? 'recipient no longer exists' : optedOut ? 'recipient opted out' : 'recipient not active' })
      report.suppressed++
      continue
    }

    const rendered = renderEmail(template, (row.data ?? {}) as Record<string, unknown>, { id: member.id, displayName: member.displayName })
    const result = await sendEmail({ to: member.email, subject: rendered.subject, text: rendered.text, html: rendered.html, idempotencyKey: String(row.idempotency_key), unsubscribeUrl: rendered.unsubscribeUrl })
    if (result.ok) {
      await finish(result.transport === 'capture' ? 'captured' : 'sent', { transport: result.transport, providerId: result.providerId })
      if (result.transport === 'capture') report.captured++
      else report.sent++
    } else if (result.retry && attempts < MAX_ATTEMPTS) {
      await run(payload, sql`UPDATE "email_outbox" SET "last_error" = ${result.error.slice(0, 500)}, "next_attempt_at" = now() + make_interval(mins => ${BACKOFF_MINUTES[attempts - 1] ?? 720}), "updated_at" = now() WHERE "id" = ${id}::uuid`)
      report.retrying++
    } else {
      await finish('failed', { error: result.error.slice(0, 500) })
      report.failed++
    }
  }
  return report
}

/** Counts for the owner dashboard, so a delivery problem is visible. */
export async function outboxHealth(): Promise<{ pending: number; failed: number; oldestPendingMinutes: number | null }> {
  const payload = await cms()
  const result = await run(
    payload,
    sql`SELECT COUNT(*) FILTER (WHERE "status" = 'pending') AS pending, COUNT(*) FILTER (WHERE "status" = 'failed') AS failed,
        EXTRACT(EPOCH FROM (now() - MIN("created_at") FILTER (WHERE "status" = 'pending'))) / 60 AS oldest FROM "email_outbox"`,
  )
  const row = result.rows[0] ?? {}
  return { pending: Number(row.pending ?? 0), failed: Number(row.failed ?? 0), oldestPendingMinutes: row.oldest == null ? null : Math.round(Number(row.oldest)) }
}
