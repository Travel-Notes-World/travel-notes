import { contributionPath } from './contributions'
import { cms, inTransaction, relId, run, sql } from './db'
import { destinationsByIds, isUuid, type DestinationRef } from './destinations'
import { fail } from './errors'
import { recountRsvps, requireActive } from './members'
import { track } from './metrics'
import { cardsByIds, type Card, type GuideLink } from './queries'
import { limit } from './ratelimit'
import { isUpcoming } from './time'
import type { MemberActor } from './types'

/**
 * Votes, bookmarks, follows and RSVPs.
 *
 * Each one is a row with a unique key made from the member and the target. Turning something on
 * uses "insert, and do nothing if it is already there", and turning it off deletes the row.
 * A double click, a retry or two tabs can therefore never create two rows, and counts are always
 * recounted from the real rows rather than added to.
 */

/** Mark an approved answer or post as helpful, or take the mark back. One vote per member; not on your own content. */
export async function setVote(actor: MemberActor, input: { targetType: unknown; targetId: unknown; on: boolean }): Promise<{ on: boolean; count: number }> {
  const member = await requireActive(actor)
  await limit('vote', member.id)
  const targetType = input.targetType === 'reply' || input.targetType === 'contribution' ? input.targetType : fail('validation', 'Unknown item.')
  if (!isUuid(input.targetId)) fail('not_found', 'That item could not be found.')
  const targetId = input.targetId as string
  const payload = await cms()
  const target = targetType === 'reply'
    ? await payload.findByID({ collection: 'replies', id: targetId, depth: 0, disableErrors: true })
    : await payload.findByID({ collection: 'contributions', id: targetId, depth: 0, disableErrors: true })
  if (!target || target.state !== 'published') return fail('not_found', 'That item could not be found.')
  if (relId(target.author) === member.id) fail('forbidden', 'You cannot mark your own post as helpful.')
  const key = `${member.id}:${targetType}:${targetId}`
  const table = targetType === 'reply' ? sql`"replies"` : sql`"contributions"`
  return inTransaction(async (tx) => {
    if (input.on) {
      await run(tx.payload, sql`INSERT INTO "votes" ("key", "member_id", "target_type", "target_id") VALUES (${key}, ${member.id}::uuid, ${targetType}::"enum_votes_target_type", ${targetId}) ON CONFLICT ("key") DO NOTHING`, tx.req)
    } else {
      await run(tx.payload, sql`DELETE FROM "votes" WHERE "key" = ${key}`, tx.req)
    }
    const counted = await run(
      tx.payload,
      sql`UPDATE ${table} SET "helpful_count" = (SELECT COUNT(*) FROM "votes" WHERE "target_type" = ${targetType}::"enum_votes_target_type" AND "target_id" = ${targetId}) WHERE "id" = ${targetId}::uuid RETURNING "helpful_count"`,
      tx.req,
    )
    return { on: input.on, count: Number(counted.rows[0]?.helpful_count ?? 0) }
  })
}

/** Save or unsave an approved community post or a published editorial guide. Bookmarks are private. */
export async function setBookmark(actor: MemberActor, input: { targetType: unknown; targetId: unknown; on: boolean }): Promise<{ on: boolean }> {
  // Bookmarks are private and harmless, so a suspended member keeps them; only an account is needed.
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  await limit('engagement', actor.id)
  const targetType = input.targetType === 'article' || input.targetType === 'contribution' ? input.targetType : fail('validation', 'Unknown item.')
  if (!isUuid(input.targetId)) fail('not_found', 'That item could not be found.')
  const targetId = input.targetId as string
  const payload = await cms()
  const key = `${actor.id}:${targetType}:${targetId}`
  if (!input.on) {
    await run(payload, sql`DELETE FROM "bookmarks" WHERE "key" = ${key}`)
    return { on: false }
  }
  const exists = targetType === 'contribution'
    ? await payload.count({ collection: 'contributions', where: { and: [{ id: { equals: targetId } }, { state: { equals: 'published' } }] } })
    : await payload.count({ collection: 'articles', where: { id: { equals: targetId } }, overrideAccess: false })
  if (!exists.totalDocs) fail('not_found', 'That item could not be found.')
  const inserted = await run(payload, sql`INSERT INTO "bookmarks" ("key", "member_id", "target_type", "target_id") VALUES (${key}, ${actor.id}::uuid, ${targetType}::"enum_bookmarks_target_type", ${targetId}) ON CONFLICT ("key") DO NOTHING RETURNING "id"`)
  if (inserted.rows.length) await track('bookmark_added', targetType)
  return { on: true }
}

/** The member's bookmarks. Posts that have since been hidden or removed are simply not listed. */
export async function listBookmarks(actor: MemberActor): Promise<{ posts: Card[]; guides: (GuideLink & { id: string })[] }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const found = await payload.find({ collection: 'bookmarks', where: { member: { equals: actor.id } }, sort: '-createdAt', limit: 500, pagination: false, depth: 0 })
  const postIds = found.docs.filter((b) => b.targetType === 'contribution').map((b) => b.targetId)
  const articleIds = found.docs.filter((b) => b.targetType === 'article').map((b) => b.targetId).filter(isUuid)
  const articles = articleIds.length
    ? await payload.find({ collection: 'articles', where: { id: { in: articleIds } }, limit: articleIds.length, pagination: false, depth: 0, draft: false, overrideAccess: false, select: { title: true, slug: true, excerpt: true } })
    : { docs: [] }
  return { posts: await cardsByIds(postIds), guides: articles.docs.map((a) => ({ id: a.id, title: a.title, path: `/stories/${a.slug}`, excerpt: a.excerpt })) }
}

/** Follow or unfollow a destination. */
export async function setFollow(actor: MemberActor, input: { destinationId: unknown; on: boolean }): Promise<{ on: boolean }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  await limit('engagement', actor.id)
  if (!isUuid(input.destinationId)) fail('not_found', 'That destination could not be found.')
  const destinationId = input.destinationId as string
  const payload = await cms()
  const key = `${actor.id}:${destinationId}`
  if (!input.on) {
    await run(payload, sql`DELETE FROM "follows" WHERE "key" = ${key}`)
    return { on: false }
  }
  if (!(await destinationsByIds([destinationId], payload)).length) fail('not_found', 'That destination could not be found.')
  const inserted = await run(payload, sql`INSERT INTO "follows" ("key", "member_id", "destination_id") VALUES (${key}, ${actor.id}::uuid, ${destinationId}::uuid) ON CONFLICT ("key") DO NOTHING RETURNING "id"`)
  if (inserted.rows.length) await track('destination_followed', destinationId)
  return { on: true }
}

export async function listFollows(actor: MemberActor): Promise<DestinationRef[]> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const found = await payload.find({ collection: 'follows', where: { member: { equals: actor.id } }, sort: '-createdAt', limit: 500, pagination: false, depth: 0 })
  return destinationsByIds(found.docs.map((f) => relId(f.destination)), payload)
}

/**
 * Say you are interested in or going to an activity, change it, or withdraw it.
 * This is not a ticket and does not guarantee entry. Your name is shown only if you choose that.
 */
export async function setRsvp(actor: MemberActor, input: { activityId: unknown; status: unknown; showPublicly?: boolean }): Promise<{ status: 'interested' | 'going' | null; interested: number; going: number }> {
  const member = await requireActive(actor)
  await limit('engagement', member.id)
  if (!isUuid(input.activityId)) fail('not_found', 'That activity could not be found.')
  const activityId = input.activityId as string
  const status = input.status === 'interested' || input.status === 'going' ? input.status : null
  const payload = await cms()
  const activity = await payload.findByID({ collection: 'contributions', id: activityId, depth: 0, disableErrors: true })
  if (!activity || activity.type !== 'activity' || activity.state !== 'published') return fail('not_found', 'That activity could not be found.')
  if (status && !isUpcoming(activity.activity ?? {})) fail('conflict', 'This activity is over or cancelled, so responses are closed.')
  const key = `${member.id}:${activityId}`
  return inTransaction(async (tx) => {
    let added = false
    if (status === 'going' && activity.activity?.capacity) {
      // Lock the activity row so two people cannot take the last place at the same moment.
      const row = await run(tx.payload, sql`SELECT "activity_going_count" AS g FROM "contributions" WHERE "id" = ${activityId}::uuid FOR UPDATE`, tx.req)
      const mine = await run(tx.payload, sql`SELECT 1 FROM "rsvps" WHERE "key" = ${key} AND "status" = 'going'`, tx.req)
      if (!mine.rows.length && Number(row.rows[0]?.g ?? 0) >= activity.activity.capacity) {
        fail('conflict', 'This activity is full. You can still mark yourself as interested.')
      }
    }
    if (status) {
      const result = await run(
        tx.payload,
        sql`INSERT INTO "rsvps" ("key", "member_id", "activity_id", "status", "show_publicly") VALUES (${key}, ${member.id}::uuid, ${activityId}::uuid, ${status}::"enum_rsvps_status", ${Boolean(input.showPublicly)})
            ON CONFLICT ("key") DO UPDATE SET "status" = EXCLUDED."status", "show_publicly" = EXCLUDED."show_publicly", "updated_at" = now() RETURNING (xmax = 0) AS inserted`,
        tx.req,
      )
      added = Boolean(result.rows[0]?.inserted)
    } else {
      await run(tx.payload, sql`DELETE FROM "rsvps" WHERE "key" = ${key}`, tx.req)
    }
    await recountRsvps(tx.payload, activityId, tx.req)
    const counts = await run(tx.payload, sql`SELECT "activity_interested_count" AS i, "activity_going_count" AS g FROM "contributions" WHERE "id" = ${activityId}::uuid`, tx.req)
    if (added) tx.afterCommit(() => track('activity_rsvp', status))
    return { status, interested: Number(counts.rows[0]?.i ?? 0), going: Number(counts.rows[0]?.g ?? 0) }
  })
}

/** Names of people going or interested who chose to be listed. Everyone else stays private. */
export async function publicAttendees(activityId: string): Promise<{ handle: string; displayName: string; status: string }[]> {
  const payload = await cms()
  const result = await run(
    payload,
    sql`SELECT m."handle", m."display_name", r."status" FROM "rsvps" r JOIN "members" m ON m."id" = r."member_id"
        WHERE r."activity_id" = ${activityId}::uuid AND r."show_publicly" = true AND m."status" = 'active' ORDER BY r."created_at" LIMIT 100`,
  )
  return result.rows.map((r) => ({ handle: String(r.handle), displayName: String(r.display_name), status: String(r.status) }))
}

export type MemberState = { bookmarked: boolean; voted: boolean; votedReplies: string[]; rsvp: { status: string; showPublicly: boolean } | null; isAuthor: boolean }

/** What the signed-in member has done on one post, for showing the right buttons. Their own data only. */
export async function memberStateFor(actor: MemberActor, post: { id: string; authorId: string | null }, replyIds: string[]): Promise<MemberState> {
  const payload = await cms()
  const [bookmark, votes, rsvp] = await Promise.all([
    payload.count({ collection: 'bookmarks', where: { key: { equals: `${actor.id}:contribution:${post.id}` } } }),
    payload.find({ collection: 'votes', where: { and: [{ member: { equals: actor.id } }, { targetId: { in: [post.id, ...replyIds] } }] }, limit: 500, pagination: false, depth: 0 }),
    payload.find({ collection: 'rsvps', where: { key: { equals: `${actor.id}:${post.id}` } }, limit: 1, depth: 0 }),
  ])
  return {
    bookmarked: bookmark.totalDocs > 0,
    voted: votes.docs.some((v) => v.targetType === 'contribution' && v.targetId === post.id),
    votedReplies: votes.docs.filter((v) => v.targetType === 'reply').map((v) => v.targetId),
    rsvp: rsvp.docs[0] ? { status: rsvp.docs[0].status, showPublicly: Boolean(rsvp.docs[0].showPublicly) } : null,
    isAuthor: post.authorId === actor.id,
  }
}

export async function isFollowing(actor: MemberActor, destinationId: string): Promise<boolean> {
  const payload = await cms()
  return (await payload.count({ collection: 'follows', where: { key: { equals: `${actor.id}:${destinationId}` } } })).totalDocs > 0
}

export async function isArticleBookmarked(actor: MemberActor, articleId: string): Promise<boolean> {
  const payload = await cms()
  return (await payload.count({ collection: 'bookmarks', where: { key: { equals: `${actor.id}:article:${articleId}` } } })).totalDocs > 0
}

export { contributionPath }
