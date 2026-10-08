import type { Contribution } from '../../payload-types'
import { audit } from './audit'
import { EVENT_STATUSES, labelOf, type EventStatus } from './constants'
import { contributionPath } from './contributions'
import { cms, relId, run, sql, type Tx } from './db'
import { notify } from './notify'
import type { Actor } from './types'

/** Tell everyone who said they are interested or going that the activity changed. One notice per person per change. */
export async function notifyEventChange(tx: Tx, doc: Contribution, summary: string, changeKey: string): Promise<number> {
  const rsvps = await tx.payload.find({ collection: 'rsvps', where: { activity: { equals: doc.id } }, limit: 5000, pagination: false, depth: 0, select: { member: true }, req: tx.req })
  let sent = 0
  for (const rsvp of rsvps.docs) {
    const recipient = relId(rsvp.member)
    if (!recipient || recipient === relId(doc.author)) continue
    const created = await notify(tx, {
      recipient,
      type: 'event_changed',
      message: `${summary}: “${doc.title}”`,
      path: contributionPath(doc),
      dedupeKey: `event:${doc.id}:${changeKey}:${recipient}`,
      email: { template: 'event_changed', data: { title: doc.title, summary: `${summary}: “${doc.title}”.` } },
    })
    if (created) sent++
  }
  return sent
}

/**
 * Change the status of a published activity, record who did it and why, and tell people who
 * responded. Used by the organiser (cancel or postpone) and by moderators (any status).
 */
export async function changeEventStatus(tx: Tx, doc: Contribution, change: { status: EventStatus; note: string; actor: Actor }): Promise<void> {
  const at = new Date().toISOString()
  const previous = doc.activity?.eventStatus ?? 'scheduled'
  await tx.payload.update({
    collection: 'contributions',
    id: doc.id,
    req: tx.req,
    data: { activity: { ...(doc.activity ?? {}), eventStatus: change.status, statusNote: change.note, statusChangedAt: at } },
  })
  await audit(tx, { action: 'event_status', actor: change.actor, targetType: 'contribution', targetId: doc.id, contribution: doc.id, reason: change.note, details: { from: previous, to: change.status } })
  if (change.status !== 'ended') {
    const summary = change.status === 'cancelled' ? 'Cancelled' : change.status === 'postponed' ? 'Postponed' : `Now ${labelOf(EVENT_STATUSES, change.status).toLowerCase()}`
    await notifyEventChange(tx, doc, summary, `${change.status}:${at}`)
  }
}

/**
 * Scheduled job: store "ended" on activities whose time has passed.
 * Pages never depend on this. They work out "ended" from the clock themselves, so a missed run
 * cannot make a finished event look upcoming. Running it twice changes nothing the second time.
 */
export async function markEndedEvents(): Promise<number> {
  const payload = await cms()
  const result = await run(
    payload,
    sql`UPDATE "contributions" SET "activity_event_status" = 'ended', "activity_status_changed_at" = now()
        WHERE "type" = 'activity' AND "activity_event_status" IN ('scheduled', 'rescheduled')
          AND COALESCE("activity_ends_at", "activity_starts_at" + interval '4 hours') <= now()`,
  )
  return Number(result.rowCount ?? 0)
}
