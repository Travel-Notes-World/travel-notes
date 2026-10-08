import { contributionPath } from './contributions'
import { cms, inTransaction, relId, run, sql } from './db'
import { enqueueEmail } from './email/outbox'

const TYPE_LABEL: Record<string, string> = { question: 'Question', trip: 'Trip report', activity: 'Activity' }

/**
 * Weekly digest for members who switched it on: new approved posts in the destinations they follow.
 *
 * Off by default for every member. Runs from the daily job but only does anything on Mondays (UTC).
 * One digest per member per week, enforced by the email queue's idempotency key, so running the
 * job twice on a Monday cannot send two. A member with nothing new gets no email.
 */
export async function sendDigests(now = new Date()): Promise<{ considered: number; queued: number }> {
  if (now.getUTCDay() !== 1) return { considered: 0, queued: 0 }
  const payload = await cms()
  const week = now.toISOString().slice(0, 10)
  const subscribers = await payload.find({ collection: 'members', where: { and: [{ status: { equals: 'active' } }, { 'emailPrefs.digest': { equals: true } }, { _verified: { equals: true } }] }, limit: 5000, pagination: false, depth: 0, select: { lastDigestAt: true } })
  let queued = 0
  for (const member of subscribers.docs) {
    const since = member.lastDigestAt ? new Date(member.lastDigestAt) : new Date(now.getTime() - 7 * 86_400_000)
    const rows = await run(
      payload,
      sql`SELECT DISTINCT c."id", c."published_at" FROM "follows" f
          JOIN "contributions_rels" r ON r."destinations_id" = f."destination_id" AND r."path" = 'destinationTree'
          JOIN "contributions" c ON c."id" = r."parent_id" AND c."state" = 'published' AND c."published_at" > ${since.toISOString()}::timestamptz AND c."author_id" <> f."member_id"
          WHERE f."member_id" = ${member.id}::uuid ORDER BY c."published_at" DESC LIMIT 15`,
    )
    if (!rows.rows.length) continue
    const posts = await payload.find({ collection: 'contributions', where: { and: [{ id: { in: rows.rows.map((r) => String(r.id)) } }, { state: { equals: 'published' } }] }, sort: '-publishedAt', limit: 15, depth: 0, select: { title: true, slug: true, shortId: true, type: true } })
    if (!posts.docs.length) continue
    await inTransaction(async (tx) => {
      await enqueueEmail(tx, { template: 'destination_digest', recipient: member.id, data: { items: posts.docs.map((p) => ({ title: p.title, path: contributionPath(p), kind: TYPE_LABEL[p.type] ?? 'Post' })) }, idempotencyKey: `digest:${member.id}:${week}` })
      await tx.payload.update({ collection: 'members', id: member.id, data: { lastDigestAt: now.toISOString() }, req: tx.req })
    })
    queued++
  }
  return { considered: subscribers.docs.length, queued }
}

export { relId }
