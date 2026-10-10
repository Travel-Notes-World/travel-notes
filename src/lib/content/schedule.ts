import type { CollectionBeforeChangeHook, Field, Payload } from 'payload'
import { ValidationError } from 'payload'

import { hasRole } from '../../access/roles'

/**
 * Scheduled publishing for guides and travel updates.
 *
 * A publisher saves a draft with "Publish at" set. The "publish" job (src/lib/community/jobs.ts),
 * run every 10 minutes by a GitHub Actions timer and once a day by Vercel Cron, publishes every
 * draft whose time has come. It publishes the latest draft, so a scheduled change to a page that is
 * already live works the same way.
 *
 * Rules:
 * - only publishers (and administrators) can set or change the time;
 * - when anyone below publisher saves the draft afterwards, the schedule is cancelled, so text a
 *   publisher has not seen can never go live by itself;
 * - publishing by hand clears the schedule;
 * - if a scheduled publish fails (for example a required field is empty), the schedule is cleared
 *   and the reason is shown on the document, instead of retrying forever.
 */

export const SCHEDULED_COLLECTIONS = ['articles', 'travel-updates'] as const
export type ScheduledCollection = (typeof SCHEDULED_COLLECTIONS)[number]

/** Times more than this far in the past are refused when a publisher sets them. */
const PAST_GRACE_MS = 2 * 60_000
/** At most this many documents are published per collection in one run; the rest wait for the next. */
const BATCH = 25

export const scheduleFields: Field[] = [
  {
    name: 'publishAt',
    label: 'Publish at',
    type: 'date',
    index: true,
    admin: {
      position: 'sidebar',
      date: { pickerAppearance: 'dayAndTime', timeIntervals: 15 },
      description:
        'Publishers only. Set a time and save as draft: it goes live by itself within about 15 minutes of this time. An editor saving the draft afterwards cancels the schedule.',
    },
  },
  {
    name: 'scheduleNote',
    type: 'text',
    admin: {
      position: 'sidebar',
      readOnly: true,
      condition: (data) => Boolean(data?.scheduleNote),
      description: 'Why the last scheduled publish did not happen.',
    },
  },
]

const sameTime = (a: unknown, b: unknown) => (!a && !b) || (Boolean(a) && Boolean(b) && new Date(a as string).getTime() === new Date(b as string).getTime())

/** Enforces the rules above on every save. Runs after the publish guards. */
export const scheduleGuard: CollectionBeforeChangeHook = ({ collection, data, originalDoc, req }) => {
  // Trusted server code (no signed-in user) and publishers may set the schedule.
  const mayPublish = !req.user || hasRole(req, 'publisher')

  if (data._status === 'published') {
    // Going live now, by hand or by the job: nothing is scheduled any more.
    data.publishAt = null
    data.scheduleNote = null
    return data
  }

  if (!mayPublish) {
    const asked = data.publishAt !== undefined && !sameTime(data.publishAt, originalDoc?.publishAt)
    if (asked && data.publishAt) {
      throw new ValidationError({ collection: collection.slug, errors: [{ path: 'publishAt', message: 'Only a publisher can schedule publishing.' }] })
    }
    // Any save below publisher cancels an existing schedule.
    data.publishAt = null
    return data
  }

  // A publisher set or changed the time. Draft saves skip field validation in Payload, so the
  // "not in the past" rule is checked here.
  if (data.publishAt && !sameTime(data.publishAt, originalDoc?.publishAt)) {
    const time = new Date(data.publishAt).getTime()
    if (Number.isNaN(time) || (req.user && time < Date.now() - PAST_GRACE_MS)) {
      throw new ValidationError({ collection: collection.slug, errors: [{ path: 'publishAt', message: 'Choose a time in the future.' }] })
    }
    data.scheduleNote = null
  }
  return data
}

export type PublishReport = { published: string[]; failed: string[] }

/** Publish every draft whose "Publish at" time has come. Safe to run any number of times. */
export async function publishDue(payload: Payload, now = new Date()): Promise<PublishReport> {
  const report: PublishReport = { published: [], failed: [] }
  for (const collection of SCHEDULED_COLLECTIONS) {
    // draft: true reads the latest version of each document, which is what the publisher scheduled.
    const due = await payload.find({
      collection,
      draft: true,
      where: { publishAt: { less_than_equal: now.toISOString() } },
      sort: 'publishAt',
      limit: BATCH,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of due.docs) {
      if (!doc.publishAt) continue
      const label = `${collection}/${doc.slug ?? doc.id}`
      try {
        await payload.update({ collection, id: doc.id, data: { _status: 'published', publishAt: null, scheduleNote: null }, depth: 0, overrideAccess: true })
        report.published.push(label)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        report.failed.push(label)
        payload.logger.error({ err: error, msg: `[schedule] could not publish ${label}` })
        // Stop retrying and say why on the document; a publisher can fix it and schedule again.
        const when = new Date(doc.publishAt).toISOString().slice(0, 16).replace('T', ' ')
        await payload
          .update({ collection, id: doc.id, draft: true, data: { publishAt: null, scheduleNote: `Not published at ${when} UTC: ${reason}`.slice(0, 300) }, depth: 0, overrideAccess: true })
          .catch((e) => payload.logger.error({ err: e, msg: `[schedule] could not record the failure for ${label}` }))
      }
    }
  }
  return report
}
