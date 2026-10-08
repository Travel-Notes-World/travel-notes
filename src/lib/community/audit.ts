import type { ModerationAction } from './constants'
import type { Tx } from './db'
import type { Actor } from './types'

export type AuditEntry = {
  action: ModerationAction
  actor: Actor
  targetType: 'contribution' | 'reply' | 'revision' | 'member' | 'media' | 'report' | 'suggestion'
  targetId: string
  contribution?: string | null
  reason?: string | null
  details?: Record<string, unknown>
}

/**
 * Write one audit record inside the same transaction as the change it describes.
 * If the change is rolled back, so is the record: the log can never claim something that did not happen.
 */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.payload.create({
    collection: 'moderation-actions',
    req: tx.req,
    data: {
      action: entry.action,
      actorType: entry.actor.kind,
      staff: entry.actor.kind === 'staff' ? entry.actor.id : undefined,
      member: entry.actor.kind === 'member' ? entry.actor.id : undefined,
      targetType: entry.targetType,
      targetId: entry.targetId,
      contribution: entry.contribution ?? undefined,
      reason: entry.reason?.trim() || undefined,
      details: entry.details,
    },
  })
}
