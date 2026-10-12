import { REPORT_CATEGORIES, optionValues } from './constants'
import { audit } from './audit'
import { cms, inTransaction, relId, run, sql } from './db'
import { isUuid } from './destinations'
import { fail, invalid } from './errors'
import { recountMember, requireActive } from './members'
import { track } from './metrics'
import { notify } from './notify'
import { limit } from './ratelimit'
import { recountReplies } from './replies'
import { getSettings } from './settings'
import { cleanText } from './text'
import type { MemberActor } from './types'

/**
 * Report a public post, reply, photo or member to the moderators.
 * One report per member per item. The item must be something the reporter can actually see.
 */
export async function createReport(actor: MemberActor, input: { targetType: unknown; targetId: unknown; category: unknown; details?: unknown }): Promise<{ ok: true; alreadyReported: boolean }> {
  const member = await requireActive(actor)
  await limit('report', member.id)
  const targetType = ['contribution', 'reply', 'member', 'media'].includes(String(input.targetType)) ? (input.targetType as 'contribution' | 'reply' | 'member' | 'media') : fail('validation', 'Unknown item.')
  if (!isUuid(input.targetId)) fail('not_found', 'That item could not be found.')
  const targetId = input.targetId as string
  const category = optionValues(REPORT_CATEGORIES).includes(input.category as never) ? (input.category as (typeof REPORT_CATEGORIES)[number]['value']) : invalid({ category: 'Choose a reason.' })
  const details = cleanText(input.details, 1500)
  if ((category === 'other' || category === 'copyright' || category === 'privacy') && details.length < 10) invalid({ details: 'Please explain the problem in a sentence or two so a moderator can act on it.' })

  const payload = await cms()
  let contribution: string | null = null
  if (targetType === 'contribution') {
    const doc = await payload.findByID({ collection: 'contributions', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'published') fail('not_found', 'That item could not be found.')
    contribution = targetId
  } else if (targetType === 'reply') {
    const doc = await payload.findByID({ collection: 'replies', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'published') return fail('not_found', 'That item could not be found.')
    contribution = relId(doc.contribution)
  } else if (targetType === 'media') {
    const doc = await payload.findByID({ collection: 'media', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'approved') return fail('not_found', 'That item could not be found.')
    contribution = relId(doc.contribution)
  } else {
    const doc = await payload.findByID({ collection: 'members', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.status !== 'active') fail('not_found', 'That member could not be found.')
    if (targetId === member.id) fail('validation', 'You cannot report yourself.')
  }

  const key = `${member.id}:${targetType}:${targetId}`
  const existing = await payload.count({ collection: 'reports', where: { key: { equals: key } } })
  if (existing.totalDocs) return { ok: true, alreadyReported: true }
  try {
    await payload.create({ collection: 'reports', data: { key, reporter: member.id, targetType, targetId, contribution: contribution ?? undefined, category, details, status: 'open' } })
  } catch {
    // Two identical requests raced; the unique key kept one.
    return { ok: true, alreadyReported: true }
  }
  await track('report_submitted', category)
  if (targetType === 'contribution' || targetType === 'reply') await hideIfWidelyReported(targetType, targetId)
  return { ok: true, alreadyReported: false }
}

const AUTO_HIDE_REASON = 'Hidden automatically after reports from several members. A moderator will check it.'

/**
 * The safety net for smart publishing: a post or reply reported by enough different members is
 * hidden straight away, before a moderator has looked. A moderator can unhide it from the queue.
 */
async function hideIfWidelyReported(targetType: 'contribution' | 'reply', targetId: string): Promise<void> {
  const settings = await getSettings()
  const payload = await cms()
  const open = await payload.count({ collection: 'reports', where: { and: [{ targetType: { equals: targetType } }, { targetId: { equals: targetId } }, { status: { equals: 'open' } }] } })
  if (open.totalDocs < settings.autoHideReports) return
  await inTransaction(async (tx) => {
    if (targetType === 'contribution') {
      const doc = await tx.payload.findByID({ collection: 'contributions', id: targetId, depth: 0, disableErrors: true, req: tx.req })
      if (!doc || doc.state !== 'published') return
      await tx.payload.update({ collection: 'contributions', id: doc.id, req: tx.req, data: { state: 'hidden', moderation: { ...(doc.moderation ?? {}), note: AUTO_HIDE_REASON } } })
      await run(tx.payload, sql`UPDATE "media" SET "state" = 'withheld' WHERE "contribution_id" = ${doc.id}::uuid AND "state" = 'approved'`, tx.req)
      await audit(tx, { action: 'hide', actor: { kind: 'system' }, targetType: 'contribution', targetId: doc.id, contribution: doc.id, reason: AUTO_HIDE_REASON })
      const author = relId(doc.author)
      if (author) {
        await recountMember(tx.payload, author, tx.req)
        await notify(tx, { recipient: author, type: 'moderation_decision', message: `“${doc.title}” is hidden while a moderator checks reports about it.`, path: `/account/posts/${doc.id}`, dedupeKey: `auto-hide:${doc.id}` })
      }
      return
    }
    const reply = await tx.payload.findByID({ collection: 'replies', id: targetId, depth: 0, disableErrors: true, req: tx.req })
    if (!reply || reply.state !== 'published') return
    const contributionId = relId(reply.contribution)
    await tx.payload.update({ collection: 'replies', id: reply.id, data: { state: 'hidden', moderationNote: AUTO_HIDE_REASON }, req: tx.req })
    if (contributionId) {
      await run(tx.payload, sql`UPDATE "contributions" SET "question_accepted_answer_id" = NULL, "question_resolved" = false WHERE "id" = ${contributionId}::uuid AND "question_accepted_answer_id" = ${reply.id}::uuid`, tx.req)
      await recountReplies(tx.payload, contributionId, tx.req)
    }
    await audit(tx, { action: 'hide_reply', actor: { kind: 'system' }, targetType: 'reply', targetId: reply.id, contribution: contributionId, reason: AUTO_HIDE_REASON })
    const author = relId(reply.author)
    if (author) await recountMember(tx.payload, author, tx.req)
  })
}
