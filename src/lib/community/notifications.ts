import { cms, run, sql } from './db'
import { isUuid } from './destinations'
import { fail } from './errors'
import type { MemberActor, Page } from './types'

export type NotificationView = { id: string; type: string; message: string; path: string; readAt: string | null; createdAt: string }

/** The member's own notifications, newest first. */
export async function listNotifications(actor: MemberActor, page = 1): Promise<Page<NotificationView> & { unread: number }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const [found, unread] = await Promise.all([
    payload.find({ collection: 'notifications', where: { recipient: { equals: actor.id } }, sort: ['-createdAt', 'id'], limit: 30, page: Math.max(1, page), depth: 0 }),
    unreadCount(actor.id),
  ])
  return {
    items: found.docs.map((n) => ({ id: n.id, type: n.type, message: n.message, path: n.path?.startsWith('/') ? n.path : '/account', readAt: n.readAt ?? null, createdAt: n.createdAt })),
    page: found.page ?? 1, totalPages: found.totalPages, total: found.totalDocs, unread,
  }
}

export async function unreadCount(memberId: string): Promise<number> {
  const payload = await cms()
  return (await payload.count({ collection: 'notifications', where: { and: [{ recipient: { equals: memberId } }, { readAt: { exists: false } }] } })).totalDocs
}

/** Mark one of the member's own notifications as read. Someone else's notification is simply not touched. */
export async function markRead(actor: MemberActor, id: unknown): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  if (!isUuid(id)) return { ok: true }
  const payload = await cms()
  await run(payload, sql`UPDATE "notifications" SET "read_at" = now() WHERE "id" = ${id}::uuid AND "recipient_id" = ${actor.id}::uuid AND "read_at" IS NULL`)
  return { ok: true }
}

export async function markAllRead(actor: MemberActor): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  await run(payload, sql`UPDATE "notifications" SET "read_at" = now() WHERE "recipient_id" = ${actor.id}::uuid AND "read_at" IS NULL`)
  return { ok: true }
}
