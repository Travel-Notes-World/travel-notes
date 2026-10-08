import type { EmailTemplate, NotificationType } from './constants'
import type { Tx } from './db'
import { run, sql } from './db'
import { enqueueEmail } from './email/outbox'

export type Notice = {
  recipient: string
  type: NotificationType
  /** Short plain sentence shown in the notification list. Built by the site, never copied from another member's text. */
  message: string
  /** A site path the RECIPIENT is allowed to open. */
  path: string
  /** The same key is ignored the second time, so a retry or a repeated job cannot notify twice. */
  dedupeKey: string
  email?: { template: EmailTemplate; data: Record<string, unknown> }
}

/**
 * Tell a member something, in the app and optionally by email, as part of the current transaction.
 * Call it only after the thing it describes is approved and visible to the recipient.
 */
export async function notify(tx: Tx, notice: Notice): Promise<boolean> {
  const inserted = await run(
    tx.payload,
    sql`INSERT INTO "notifications" ("dedupe_key", "recipient_id", "type", "message", "path")
        VALUES (${notice.dedupeKey}, ${notice.recipient}::uuid, ${notice.type}::"enum_notifications_type", ${notice.message.slice(0, 300)}, ${notice.path.slice(0, 300)})
        ON CONFLICT ("dedupe_key") DO NOTHING RETURNING "id"`,
    tx.req,
  )
  if (!inserted.rows.length) return false
  if (notice.email) {
    await enqueueEmail(tx, { template: notice.email.template, recipient: notice.recipient, data: { ...notice.email.data, path: notice.path }, idempotencyKey: `n:${notice.dedupeKey}` })
  }
  return true
}
