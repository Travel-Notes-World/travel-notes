import type { Payload } from 'payload'

import type { Contribution, Reply } from '../../payload-types'
import { audit } from './audit'
import { LIMITS } from './constants'
import { contributionPath } from './contributions'
import { cms, inTransaction, relId, run, sql, type Tx } from './db'
import { isUuid } from './destinations'
import { fail, invalid } from './errors'
import { authorsById, recountMember, requireActive } from './members'
import { track } from './metrics'
import { notify } from './notify'
import { limit } from './ratelimit'
import { assertSubmissionsOpen } from './settings'
import { bodyTooManyLinks, cleanText } from './text'
import type { Actor, MemberActor, Page, PublicAuthor } from './types'

export async function recountReplies(payload: Payload, contributionId: string, req?: Tx['req']): Promise<void> {
  await run(
    payload,
    sql`UPDATE "contributions" SET "reply_count" = (SELECT COUNT(*) FROM "replies" WHERE "contribution_id" = ${contributionId}::uuid AND "state" = 'published') WHERE "id" = ${contributionId}::uuid`,
    req,
  )
}

/**
 * Make a reply public. Used by a moderator's approval and by the optional lighter review for
 * members a moderator marked as trusted. People are told only now, never while a reply is pending.
 */
export async function publishReply(tx: Tx, reply: Reply, contribution: Contribution, by: Actor): Promise<void> {
  await tx.payload.update({ collection: 'replies', id: reply.id, req: tx.req, data: { state: 'published', publishedAt: reply.publishedAt ?? new Date().toISOString(), moderationNote: '', reviewedBy: by.kind === 'staff' ? by.id : undefined } })
  await recountReplies(tx.payload, contribution.id, tx.req)
  const authorId = relId(reply.author)
  if (authorId) await recountMember(tx.payload, authorId, tx.req)
  await audit(tx, { action: by.kind === 'system' ? 'auto_approve_reply' : 'approve_reply', actor: by, targetType: 'reply', targetId: reply.id, contribution: contribution.id })

  const path = `${contributionPath(contribution)}#reply-${reply.id}`
  const authors = await authorsById([authorId])
  const authorName = (authorId && authors.get(authorId)?.displayName) || 'A member'
  const recipients = new Set<string>()
  const owner = relId(contribution.author)
  if (owner) recipients.add(owner)
  const parentId = relId(reply.parent)
  if (parentId) {
    const parent = await tx.payload.findByID({ collection: 'replies', id: parentId, depth: 0, disableErrors: true, req: tx.req })
    const parentAuthor = relId(parent?.author)
    if (parentAuthor) recipients.add(parentAuthor)
  }
  if (authorId) {
    recipients.delete(authorId)
    await notify(tx, { recipient: authorId, type: 'moderation_decision', message: `Your reply on “${contribution.title}” is now published.`, path, dedupeKey: `reply-approved:${reply.id}` })
  }
  for (const recipient of recipients) {
    await notify(tx, {
      recipient,
      type: 'reply_published',
      message: `${authorName} replied on “${contribution.title}”.`,
      path,
      dedupeKey: `reply:${reply.id}:${recipient}`,
      email: { template: 'reply_published', data: { title: contribution.title, authorName } },
    })
  }
  tx.afterCommit(() => track('answer_published', contribution.type))
}

/** Post an answer or a reply. It waits for review unless lighter review is switched on for trusted members. */
export async function postReply(actor: MemberActor, input: { contributionId: unknown; parentId?: unknown; body: unknown }): Promise<{ id: string; state: string }> {
  const member = await requireActive(actor)
  const settings = await assertSubmissionsOpen()
  await limit('reply', member.id)
  const body = cleanText(input.body, LIMITS.replyMax)
  if (body.length < LIMITS.replyMin) invalid({ body: 'Write a reply of at least a sentence.' })
  if (bodyTooManyLinks(body)) invalid({ body: `Please use ${LIMITS.maxLinksInBody} links or fewer.` })
  if (!isUuid(input.contributionId)) fail('not_found', 'That post could not be found.')
  const payload = await cms()
  const contribution = await payload.findByID({ collection: 'contributions', id: input.contributionId as string, depth: 0, disableErrors: true })
  if (!contribution || contribution.state !== 'published') return fail('not_found', 'That post could not be found.')
  let parent: Reply | null = null
  if (input.parentId) {
    if (!isUuid(input.parentId)) fail('not_found', 'That reply could not be found.')
    parent = await payload.findByID({ collection: 'replies', id: input.parentId as string, depth: 0, disableErrors: true })
    if (!parent || parent.state !== 'published' || relId(parent.contribution) !== contribution.id) return fail('not_found', 'That reply could not be found.')
    // One level of threading: a reply to a reply attaches to the same top-level answer.
    if (relId(parent.parent)) fail('validation', 'Replies can be one level deep. Reply to the main answer instead.')
  }
  // The same text sent twice in a row (a double click, a retry) is one reply.
  const duplicate = await payload.find({ collection: 'replies', where: { and: [{ author: { equals: member.id } }, { contribution: { equals: contribution.id } }, { state: { in: ['pending', 'published'] } }, { body: { equals: body } }] }, limit: 1, depth: 0 })
  if (duplicate.docs[0]) return { id: duplicate.docs[0].id, state: duplicate.docs[0].state }

  const auto = settings.autoApproveTrustedReplies && member.trusted
  return inTransaction(async (tx) => {
    const reply = await tx.payload.create({ collection: 'replies', req: tx.req, data: { contribution: contribution.id, parent: parent?.id, author: member.id, body, state: 'pending' } })
    if (auto) {
      await publishReply(tx, reply, contribution, { kind: 'system' })
      return { id: reply.id, state: 'published' }
    }
    return { id: reply.id, state: 'pending' }
  })
}

/** The author takes their own reply down. */
export async function removeOwnReply(actor: MemberActor, replyId: unknown): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  if (!isUuid(replyId)) fail('not_found', 'That reply could not be found.')
  const payload = await cms()
  const reply = await payload.findByID({ collection: 'replies', id: replyId as string, depth: 0, disableErrors: true })
  if (!reply || relId(reply.author) !== actor.id) return fail('not_found', 'That reply could not be found.')
  if (reply.state === 'removed') return { ok: true }
  const contributionId = relId(reply.contribution)!
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'replies', id: reply.id, data: { state: 'removed' }, req: tx.req })
    // If it was the accepted answer, the question no longer has one.
    await run(tx.payload, sql`UPDATE "contributions" SET "question_accepted_answer_id" = NULL, "question_resolved" = false WHERE "id" = ${contributionId}::uuid AND "question_accepted_answer_id" = ${reply.id}::uuid`, tx.req)
    await recountReplies(tx.payload, contributionId, tx.req)
    await recountMember(tx.payload, actor.id, tx.req)
    await audit(tx, { action: 'remove_reply', actor, targetType: 'reply', targetId: reply.id, contribution: contributionId, reason: 'Removed by its author' })
  })
  return { ok: true }
}

/**
 * The person who asked accepts (or un-accepts) an approved answer.
 * Acceptance means "this helped me". It is not a statement that the answer is factually correct.
 */
export async function setAcceptedAnswer(actor: MemberActor, input: { contributionId: unknown; replyId: unknown | null }): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  if (!isUuid(input.contributionId)) fail('not_found', 'That question could not be found.')
  const payload = await cms()
  const question = await payload.findByID({ collection: 'contributions', id: input.contributionId as string, depth: 0, disableErrors: true })
  if (!question || question.type !== 'question' || question.state !== 'published') return fail('not_found', 'That question could not be found.')
  if (relId(question.author) !== member.id) fail('forbidden', 'Only the person who asked can accept an answer.')
  const current = relId(question.question?.acceptedAnswer)

  if (!input.replyId) {
    if (!current) return { ok: true }
    await inTransaction(async (tx) => {
      await tx.payload.update({ collection: 'contributions', id: question.id, req: tx.req, data: { question: { ...(question.question ?? {}), acceptedAnswer: null, resolved: false } } })
      await audit(tx, { action: 'unaccept_answer', actor: member, targetType: 'reply', targetId: current, contribution: question.id })
    })
    return { ok: true }
  }
  if (!isUuid(input.replyId)) fail('not_found', 'That answer could not be found.')
  if (current === input.replyId) return { ok: true }
  const reply = await payload.findByID({ collection: 'replies', id: input.replyId as string, depth: 0, disableErrors: true })
  if (!reply || reply.state !== 'published' || relId(reply.contribution) !== question.id || relId(reply.parent)) return fail('not_found', 'That answer could not be found.')
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'contributions', id: question.id, req: tx.req, data: { question: { ...(question.question ?? {}), acceptedAnswer: reply.id, resolved: true } } })
    await audit(tx, { action: 'accept_answer', actor: member, targetType: 'reply', targetId: reply.id, contribution: question.id })
    const answerAuthor = relId(reply.author)
    if (answerAuthor && answerAuthor !== member.id) {
      await notify(tx, {
        recipient: answerAuthor,
        type: 'answer_accepted',
        message: `Your answer on “${question.title}” was accepted.`,
        path: `${contributionPath(question)}#reply-${reply.id}`,
        dedupeKey: `accepted:${question.id}:${reply.id}`,
        email: { template: 'answer_accepted', data: { title: question.title } },
      })
    }
    tx.afterCommit(() => track('answer_accepted'))
  })
  return { ok: true }
}

/** The person who asked marks their question resolved or open again, without choosing an answer. */
export async function setResolved(actor: MemberActor, input: { contributionId: unknown; resolved: boolean }): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  if (!isUuid(input.contributionId)) fail('not_found', 'That question could not be found.')
  const payload = await cms()
  const question = await payload.findByID({ collection: 'contributions', id: input.contributionId as string, depth: 0, disableErrors: true })
  if (!question || question.type !== 'question' || question.state !== 'published') return fail('not_found', 'That question could not be found.')
  if (relId(question.author) !== member.id) fail('forbidden', 'Only the person who asked can change this.')
  await payload.update({ collection: 'contributions', id: question.id, data: { question: { ...(question.question ?? {}), resolved: input.resolved } } })
  return { ok: true }
}

export type ReplyView = { id: string; body: string; author: PublicAuthor; authorId: string | null; publishedAt: string | null; helpfulCount: number; accepted: boolean; children: ReplyView[] }

/** Approved answers for a post, a page at a time, each with its approved replies. The accepted answer comes first. */
export async function listReplies(contributionId: string, options: { page?: number; acceptedId?: string | null } = {}): Promise<Page<ReplyView>> {
  const payload = await cms()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const top = await payload.find({
    collection: 'replies',
    where: { and: [{ contribution: { equals: contributionId } }, { state: { equals: 'published' } }, { parent: { exists: false } }] },
    sort: ['publishedAt', 'id'], limit: LIMITS.replyPageSize, page, depth: 0, overrideAccess: false,
  })
  const ids = top.docs.map((r) => r.id)
  const children = ids.length
    ? await payload.find({ collection: 'replies', where: { and: [{ parent: { in: ids } }, { state: { equals: 'published' } }] }, sort: ['publishedAt', 'id'], limit: 500, pagination: false, depth: 0, overrideAccess: false })
    : { docs: [] as Reply[] }
  const authors = await authorsById([...top.docs, ...children.docs].map((r) => relId(r.author)))
  const view = (r: Reply): ReplyView => {
    const authorId = relId(r.author)
    const author = (authorId && authors.get(authorId)) || { handle: null, displayName: 'Deleted member', hasProfile: false }
    return { id: r.id, body: r.body, author, authorId: author.hasProfile ? authorId : null, publishedAt: r.publishedAt ?? null, helpfulCount: r.helpfulCount ?? 0, accepted: r.id === options.acceptedId, children: [] }
  }
  const items = top.docs.map(view)
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const child of children.docs) byId.get(relId(child.parent) ?? '')?.children.push(view(child))
  // The accepted answer leads on the first page; the rest stay in the order they were approved.
  if (page === 1 && options.acceptedId) items.sort((a, b) => Number(b.accepted) - Number(a.accepted))
  return { items, page: top.page ?? page, totalPages: top.totalPages, total: top.totalDocs }
}

/** The member's own replies on a post that are not public yet, so they can see what happened to them. */
export async function ownUnpublishedReplies(actor: MemberActor, contributionId: string): Promise<{ id: string; body: string; state: string; note: string; parentId: string | null }[]> {
  const payload = await cms()
  const found = await payload.find({ collection: 'replies', where: { and: [{ contribution: { equals: contributionId } }, { author: { equals: actor.id } }, { state: { in: ['pending', 'rejected'] } }] }, sort: '-createdAt', limit: 20, depth: 0 })
  return found.docs.map((r) => ({ id: r.id, body: r.body, state: r.state, note: r.moderationNote ?? '', parentId: relId(r.parent) }))
}
