import type { Contribution, Reply } from '../../payload-types'
import { audit } from './audit'
import { INDEXING_CHOICES, optionValues, type ContributionType, type EventStatus } from './constants'
import type { Content } from './content'
import { applyApprovedContent, contributionPath, docToContent } from './contributions'
import { cms, inTransaction, relId, run, sql, type Tx } from './db'
import { destinationsByIds, isUuid } from './destinations'
import { fail, invalid } from './errors'
import { changeEventStatus, notifyEventChange } from './events'
import { recountMember } from './members'
import { track } from './metrics'
import { notify } from './notify'
import { publishReply, recountReplies } from './replies'
import { cleanLine, cleanText } from './text'
import type { StaffActor } from './types'

/**
 * Moderation. Every function takes the acting staff member and checks their permission first.
 * Each decision updates the content, writes an audit record and queues the author's notice in one
 * transaction, so the three can never disagree.
 */

function requireModerator(staff: StaffActor | null | undefined): StaffActor {
  if (!staff || staff.kind !== 'staff' || !staff.canModerate) return fail('forbidden', 'Only moderators can do this.')
  return staff
}
function requireAdministrator(staff: StaffActor | null | undefined): StaffActor {
  const s = requireModerator(staff)
  if (!s.isAdministrator) fail('forbidden', 'Only an administrator can do this.')
  return s
}

const reasonFrom = (value: unknown, required: boolean, field = 'reason'): string => {
  const reason = cleanText(value, 1000)
  if (required && reason.length < 5) invalid({ [field]: 'Write a short reason. The author will see it.' })
  return reason
}

async function loadContribution(id: unknown): Promise<Contribution> {
  if (!isUuid(id)) fail('not_found', 'That post could not be found.')
  const payload = await cms()
  return (await payload.findByID({ collection: 'contributions', id: id as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That post could not be found.')
}

async function tellAuthor(tx: Tx, doc: Contribution, key: string, summary: string, reason: string, path: string): Promise<void> {
  const author = relId(doc.author)
  if (!author) return
  await notify(tx, {
    recipient: author,
    type: 'moderation_decision',
    message: summary,
    path,
    dedupeKey: `mod:${doc.id}:${key}`,
    email: { template: 'moderation_decision', data: { title: doc.title, summary, reason } },
  })
}

export type Decision = 'approve' | 'request_changes' | 'reject'

/**
 * Decide a new submission, or an edit to something already published.
 * Approving makes the reviewed snapshot the public content. It does not decide search-engine
 * indexing; that is a separate setting.
 */
export async function decideContribution(staffIn: StaffActor, id: unknown, input: { decision: Decision; reason?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  const doc = await loadContribution(id)
  const revisionId = relId(doc.pendingRevision)
  const isEdit = doc.state === 'published'
  if (!revisionId || (doc.state !== 'pending' && !isEdit)) fail('conflict', 'Nothing is waiting for review on this post. It may have been withdrawn or already decided.')
  if (!['approve', 'request_changes', 'reject'].includes(input.decision)) fail('validation', 'Unknown decision.')
  if (isEdit && input.decision === 'request_changes') fail('validation', 'For an edit to a published post, approve it or reject it with a reason.')
  const reason = reasonFrom(input.reason, input.decision !== 'approve')
  const now = new Date().toISOString()

  await inTransaction(async (tx) => {
    const revision = await tx.payload.findByID({ collection: 'revisions', id: revisionId!, depth: 0, disableErrors: true, req: tx.req })
    if (!revision || revision.reviewState !== 'pending') fail('conflict', 'This submission was already decided.')
    const moderation = { ...(doc.moderation ?? {}), note: reason, reviewedBy: staff.id, reviewedAt: now }
    const reviewed = { reviewedBy: staff.id, reviewedAt: now, reason }

    if (input.decision === 'approve') {
      const content = revision!.snapshot as unknown as Content
      const updated = await applyApprovedContent(tx, doc, content, {
        state: 'published',
        publishedAt: doc.publishedAt ?? now,
        contentUpdatedAt: now,
        publishedRevision: revision!.id,
        pendingRevision: null,
        moderation: { ...moderation, note: '' },
      })
      await tx.payload.update({ collection: 'revisions', id: revision!.id, data: { reviewState: 'approved', ...reviewed }, req: tx.req })
      await audit(tx, { action: isEdit ? 'approve_revision' : 'approve', actor: staff, targetType: isEdit ? 'revision' : 'contribution', targetId: isEdit ? revision!.id : doc.id, contribution: doc.id, reason })
      const author = relId(doc.author)
      if (author) await recountMember(tx.payload, author, tx.req)
      await tellAuthor(tx, updated, `approved:${revision!.id}`, isEdit ? `Your changes to “${updated.title}” were approved.` : `“${updated.title}” was approved and is now published.`, reason, contributionPath(updated))
      if (isEdit && updated.type === 'activity' && updated.activity?.eventStatus === 'rescheduled' && doc.activity?.startLocal !== updated.activity?.startLocal) {
        await notifyEventChange(tx, updated, 'New date', `rescheduled:${revision!.id}`)
      }
      if (!isEdit) {
        tx.afterCommit(async () => {
          await track('contribution_approved', doc.type)
          if (doc.type === 'trip') await track('trip_report_published')
          if (doc.type === 'activity') await track('activity_published')
        })
      }
      return
    }

    const rejected = input.decision === 'reject'
    await tx.payload.update({ collection: 'revisions', id: revision!.id, data: { reviewState: rejected ? 'rejected' : 'changes_requested', ...reviewed }, req: tx.req })
    if (isEdit) {
      // The approved version stays public and unchanged. Only the proposed edit is turned down.
      await tx.payload.update({ collection: 'contributions', id: doc.id, data: { pendingRevision: null, moderation }, req: tx.req })
      await audit(tx, { action: 'reject_revision', actor: staff, targetType: 'revision', targetId: revision!.id, contribution: doc.id, reason })
      await tellAuthor(tx, doc, `edit-rejected:${revision!.id}`, `Your changes to “${doc.title}” were not accepted. The published version is unchanged.`, reason, `/account/posts/${doc.id}`)
    } else {
      await tx.payload.update({ collection: 'contributions', id: doc.id, data: { state: rejected ? 'rejected' : 'changes_requested', pendingRevision: null, moderation }, req: tx.req })
      await audit(tx, { action: rejected ? 'reject' : 'request_changes', actor: staff, targetType: 'contribution', targetId: doc.id, contribution: doc.id, reason })
      await tellAuthor(tx, doc, `${input.decision}:${revision!.id}`, rejected ? `“${doc.title}” was not accepted.` : `A moderator asked for changes to “${doc.title}”.`, reason, `/account/posts/${doc.id}`)
    }
  })
  return { ok: true }
}

/**
 * Hide, unhide or remove a published post. Used for reports and for urgent removals: it takes
 * effect on the next page view, with no waiting for a job or a cache.
 */
export async function setVisibility(staffIn: StaffActor, id: unknown, input: { action: 'hide' | 'unhide' | 'remove'; reason?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  const doc = await loadContribution(id)
  const { action } = input
  if (action === 'hide' && doc.state !== 'published') fail('conflict', 'Only a published post can be hidden.')
  if (action === 'unhide' && doc.state !== 'hidden') fail('conflict', 'This post is not hidden.')
  if (action === 'remove' && !['published', 'hidden'].includes(doc.state)) fail('conflict', 'Only a published or hidden post can be removed.')
  const reason = reasonFrom(input.reason, action !== 'unhide')
  const state = action === 'hide' ? 'hidden' : action === 'unhide' ? 'published' : 'removed'
  await inTransaction(async (tx) => {
    const pending = relId(doc.pendingRevision)
    if (pending && action !== 'unhide') await tx.payload.update({ collection: 'revisions', id: pending, data: { reviewState: 'superseded' }, req: tx.req })
    await tx.payload.update({
      collection: 'contributions', id: doc.id, req: tx.req,
      data: { state, moderation: { ...(doc.moderation ?? {}), note: reason, reviewedBy: staff.id, reviewedAt: new Date().toISOString() }, ...(action !== 'unhide' ? { pendingRevision: null } : {}) },
    })
    // Photos follow the post: withheld while hidden, public again when unhidden, gone when removed.
    const mediaState = action === 'hide' ? 'withheld' : action === 'unhide' ? 'approved' : 'removed'
    const from = action === 'hide' ? sql`'approved'` : action === 'unhide' ? sql`'withheld'` : sql`"state"`
    await run(tx.payload, sql`UPDATE "media" SET "state" = ${mediaState}::"enum_media_state" WHERE "contribution_id" = ${doc.id}::uuid AND "state" = ${from} AND "state" <> 'removed'`, tx.req)
    await audit(tx, { action, actor: staff, targetType: 'contribution', targetId: doc.id, contribution: doc.id, reason })
    const author = relId(doc.author)
    if (author) await recountMember(tx.payload, author, tx.req)
    const summary = action === 'hide' ? `“${doc.title}” was hidden by a moderator.` : action === 'unhide' ? `“${doc.title}” is visible again.` : `“${doc.title}” was removed by a moderator.`
    await tellAuthor(tx, doc, `${action}:${Date.now()}`, summary, reason, action === 'unhide' ? contributionPath(doc) : `/account/posts/${doc.id}`)
  })
  return { ok: true }
}

export type ReplyDecision = 'approve' | 'reject' | 'hide' | 'unhide' | 'remove'

export async function decideReply(staffIn: StaffActor, replyId: unknown, input: { decision: ReplyDecision; reason?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  if (!isUuid(replyId)) fail('not_found', 'That reply could not be found.')
  const payload = await cms()
  const reply: Reply = (await payload.findByID({ collection: 'replies', id: replyId as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That reply could not be found.')
  const contribution = await loadContribution(relId(reply.contribution))
  const allowed: Record<ReplyDecision, string[]> = { approve: ['pending'], reject: ['pending'], hide: ['published'], unhide: ['hidden'], remove: ['published', 'hidden'] }
  if (!allowed[input.decision]) fail('validation', 'Unknown decision.')
  if (!allowed[input.decision].includes(reply.state)) fail('conflict', 'This reply was already decided.')
  const reason = reasonFrom(input.reason, input.decision !== 'approve' && input.decision !== 'unhide')

  await inTransaction(async (tx) => {
    if (input.decision === 'approve' || input.decision === 'unhide') {
      // A reply is only made public under a post that is public.
      if (contribution.state !== 'published') fail('conflict', 'The post this reply belongs to is not published.')
      if (input.decision === 'approve') return publishReply(tx, reply, contribution, staff)
      await tx.payload.update({ collection: 'replies', id: reply.id, data: { state: 'published', moderationNote: '', reviewedBy: staff.id }, req: tx.req })
      await audit(tx, { action: 'approve_reply', actor: staff, targetType: 'reply', targetId: reply.id, contribution: contribution.id, reason: reason || 'Unhidden' })
    } else {
      const state = input.decision === 'reject' ? 'rejected' : input.decision === 'hide' ? 'hidden' : 'removed'
      await tx.payload.update({ collection: 'replies', id: reply.id, data: { state, moderationNote: reason, reviewedBy: staff.id }, req: tx.req })
      // An answer that is no longer public cannot stay the accepted answer.
      await run(tx.payload, sql`UPDATE "contributions" SET "question_accepted_answer_id" = NULL, "question_resolved" = false WHERE "id" = ${contribution.id}::uuid AND "question_accepted_answer_id" = ${reply.id}::uuid`, tx.req)
      await audit(tx, { action: input.decision === 'reject' ? 'reject_reply' : input.decision === 'hide' ? 'hide_reply' : 'remove_reply', actor: staff, targetType: 'reply', targetId: reply.id, contribution: contribution.id, reason })
      const author = relId(reply.author)
      if (author) {
        const what = input.decision === 'reject' ? 'was not accepted' : input.decision === 'hide' ? 'was hidden by a moderator' : 'was removed by a moderator'
        await notify(tx, { recipient: author, type: 'moderation_decision', message: `Your reply on “${contribution.title}” ${what}.`, path: contribution.state === 'published' ? contributionPath(contribution) : '/account', dedupeKey: `reply-${input.decision}:${reply.id}`, email: { template: 'moderation_decision', data: { title: contribution.title, summary: `Your reply on “${contribution.title}” ${what}.`, reason } } })
      }
    }
    await recountReplies(tx.payload, contribution.id, tx.req)
    const author = relId(reply.author)
    if (author) await recountMember(tx.payload, author, tx.req)
  })
  return { ok: true }
}

/** Search-engine indexing for one post: follow the quality policy, always allow, or always block. Administrators only. */
export async function setIndexing(staffIn: StaffActor, id: unknown, choice: unknown): Promise<{ ok: true }> {
  const staff = requireAdministrator(staffIn)
  const doc = await loadContribution(id)
  const indexing = optionValues(INDEXING_CHOICES).includes(choice as never) ? (choice as (typeof INDEXING_CHOICES)[number]['value']) : fail('validation', 'Unknown choice.')
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'contributions', id: doc.id, data: { indexing }, req: tx.req })
    await audit(tx, { action: 'set_indexing', actor: staff, targetType: 'contribution', targetId: doc.id, contribution: doc.id, details: { from: doc.indexing, to: indexing } })
  })
  return { ok: true }
}

/** Link a question to an earlier thread that already answers it, or remove the link. The newer thread stays readable. */
export async function markDuplicate(staffIn: StaffActor, id: unknown, otherShortId: unknown): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  const doc = await loadContribution(id)
  if (doc.type !== 'question') fail('validation', 'Only questions can be linked as duplicates.')
  const payload = await cms()
  let other: Contribution | null = null
  const wanted = cleanLine(otherShortId, 200).split('/').pop()?.split('-')[0] ?? ''
  if (wanted) {
    const found = await payload.find({ collection: 'contributions', where: { and: [{ shortId: { equals: wanted } }, { type: { equals: 'question' } }, { state: { equals: 'published' } }] }, limit: 1, depth: 0 })
    other = found.docs[0] ?? invalid({ other: 'No published question has that address or id.' })
    if (other!.id === doc.id) invalid({ other: 'A question cannot be a duplicate of itself.' })
  }
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'contributions', id: doc.id, data: { question: { ...(doc.question ?? {}), duplicateOf: other?.id ?? null } }, req: tx.req })
    await audit(tx, { action: 'mark_duplicate', actor: staff, targetType: 'contribution', targetId: doc.id, contribution: doc.id, details: { duplicateOf: other?.id ?? null } })
  })
  return { ok: true }
}

/** Correct an abused "accepted answer", with a reason on the record. */
export async function overrideAcceptedAnswer(staffIn: StaffActor, id: unknown, input: { replyId: unknown | null; reason: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  const doc = await loadContribution(id)
  if (doc.type !== 'question') fail('validation', 'Only questions have an accepted answer.')
  const reason = reasonFrom(input.reason, true)
  const payload = await cms()
  let replyId: string | null = null
  if (input.replyId) {
    if (!isUuid(input.replyId)) fail('not_found', 'That answer could not be found.')
    const reply = await payload.findByID({ collection: 'replies', id: input.replyId as string, depth: 0, disableErrors: true })
    if (!reply || reply.state !== 'published' || relId(reply.contribution) !== doc.id || relId(reply.parent)) fail('not_found', 'That answer could not be found.')
    replyId = reply!.id
  }
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'contributions', id: doc.id, data: { question: { ...(doc.question ?? {}), acceptedAnswer: replyId, resolved: Boolean(replyId) } }, req: tx.req })
    await audit(tx, { action: 'override_accepted_answer', actor: staff, targetType: 'contribution', targetId: doc.id, contribution: doc.id, reason, details: { from: relId(doc.question?.acceptedAnswer), to: replyId } })
  })
  return { ok: true }
}

/** A moderator sets the status of an activity, for example after a report that it was cancelled. */
export async function moderateEventStatus(staffIn: StaffActor, id: unknown, input: { status: unknown; note: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  const doc = await loadContribution(id)
  if (doc.type !== 'activity' || !['published', 'hidden'].includes(doc.state)) fail('conflict', 'Only a published activity has a status.')
  const status = ['scheduled', 'postponed', 'rescheduled', 'cancelled', 'ended'].includes(String(input.status)) ? (input.status as EventStatus) : fail('validation', 'Unknown status.')
  if (doc.activity?.eventStatus === status) return { ok: true }
  await inTransaction((tx) => changeEventStatus(tx, doc, { status, note: cleanLine(input.note, 300), actor: staff }))
  return { ok: true }
}

/** Record that a moderator checked the listing's facts today, and optionally whether the organiser is confirmed. */
export async function recordFactCheck(staffIn: StaffActor, id: unknown, input: { organiserVerified?: boolean }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  const doc = await loadContribution(id)
  if (doc.type !== 'activity') fail('validation', 'Only activities have a fact check.')
  await inTransaction(async (tx) => {
    const organiserVerified = typeof input.organiserVerified === 'boolean' ? input.organiserVerified : Boolean(doc.activity?.organiserVerified)
    await tx.payload.update({ collection: 'contributions', id: doc.id, data: { activity: { ...(doc.activity ?? {}), lastCheckedAt: new Date().toISOString(), organiserVerified } }, req: tx.req })
    await audit(tx, { action: organiserVerified !== Boolean(doc.activity?.organiserVerified) ? 'verify_organiser' : 'fact_check', actor: staff, targetType: 'contribution', targetId: doc.id, contribution: doc.id, details: { organiserVerified } })
  })
  return { ok: true }
}

/** Reject or remove a single photo without rejecting the whole post. */
export async function decideMedia(staffIn: StaffActor, mediaId: unknown, input: { decision: 'reject' | 'remove'; reason?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  if (!isUuid(mediaId)) fail('not_found', 'That photo could not be found.')
  const payload = await cms()
  const media = (await payload.findByID({ collection: 'media', id: mediaId as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That photo could not be found.')
  const reason = reasonFrom(input.reason, true)
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'media', id: media.id, data: { state: input.decision === 'reject' ? 'rejected' : 'removed' }, req: tx.req })
    // Take it out of the post it was attached to, so it cannot be approved later by mistake.
    await run(tx.payload, sql`DELETE FROM "contributions_rels" WHERE "media_id" = ${media.id}::uuid AND "path" = 'photos'`, tx.req)
    await audit(tx, { action: input.decision === 'reject' ? 'reject_media' : 'remove_media', actor: staff, targetType: 'media', targetId: media.id, contribution: relId(media.contribution), reason })
    const owner = relId(media.owner)
    if (owner) await notify(tx, { recipient: owner, type: 'moderation_decision', message: 'One of your photos was not accepted.', path: '/account', dedupeKey: `media:${media.id}:${input.decision}`, email: { template: 'moderation_decision', data: { title: 'your photo', summary: 'One of your photos was not accepted.', reason } } })
  })
  return { ok: true }
}

/** Suspend an account, or lift a suspension. A suspended member can read and sign in but cannot post, reply, vote or report. */
export async function restrictAccount(staffIn: StaffActor, memberId: unknown, input: { action: 'suspend' | 'unsuspend'; reason?: unknown; days?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  if (!isUuid(memberId)) fail('not_found', 'That member could not be found.')
  const payload = await cms()
  const member = await payload.findByID({ collection: 'members', id: memberId as string, depth: 0, disableErrors: true })
  if (!member || member.status === 'deleted') return fail('not_found', 'That member could not be found.')
  const suspend = input.action === 'suspend'
  const reason = reasonFrom(input.reason, suspend)
  const days = Number(input.days)
  const until = suspend && Number.isInteger(days) && days > 0 && days <= 3650 ? new Date(Date.now() + days * 86_400_000).toISOString() : null
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'members', id: member.id, data: { status: suspend ? 'suspended' : 'active', statusReason: suspend ? reason : '', suspendedUntil: until }, req: tx.req })
    await audit(tx, { action: suspend ? 'suspend' : 'unsuspend', actor: staff, targetType: 'member', targetId: member.id, reason, details: { until } })
    await notify(tx, { recipient: member.id, type: 'account_notice', message: suspend ? `Your account was suspended${until ? ` until ${until.slice(0, 10)}` : ''}.` : 'Your account suspension was lifted.', path: '/account', dedupeKey: `account:${member.id}:${input.action}:${Date.now()}` })
  })
  return { ok: true }
}

/** Mark a member as trusted, or not. A person decides this; posting volume never does. */
export async function setTrusted(staffIn: StaffActor, memberId: unknown, trusted: boolean): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  if (!isUuid(memberId)) fail('not_found', 'That member could not be found.')
  const payload = await cms()
  const member = (await payload.findByID({ collection: 'members', id: memberId as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That member could not be found.')
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'members', id: member.id, data: { trusted }, req: tx.req })
    await audit(tx, { action: 'set_trust', actor: staff, targetType: 'member', targetId: member.id, details: { trusted } })
  })
  return { ok: true }
}

export async function resolveReport(staffIn: StaffActor, reportId: unknown, input: { status: 'resolved' | 'dismissed'; resolution?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  if (!isUuid(reportId)) fail('not_found', 'That report could not be found.')
  const payload = await cms()
  const report = (await payload.findByID({ collection: 'reports', id: reportId as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That report could not be found.')
  if (report.status !== 'open') fail('conflict', 'This report was already handled.')
  const resolution = reasonFrom(input.resolution, true, 'resolution')
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'reports', id: report.id, data: { status: input.status === 'dismissed' ? 'dismissed' : 'resolved', resolution, resolvedBy: staff.id, resolvedAt: new Date().toISOString() }, req: tx.req })
    await audit(tx, { action: input.status === 'dismissed' ? 'dismiss_report' : 'resolve_report', actor: staff, targetType: 'report', targetId: report.id, contribution: relId(report.contribution), reason: resolution })
  })
  return { ok: true }
}

/** Accept a suggested place by linking it to a destination record an editor created or found, or turn it down. */
export async function decideSuggestion(staffIn: StaffActor, id: unknown, input: { decision: 'accept' | 'reject'; destinationId?: unknown; resolution?: unknown }): Promise<{ ok: true }> {
  const staff = requireModerator(staffIn)
  if (!isUuid(id)) fail('not_found', 'That suggestion could not be found.')
  const payload = await cms()
  const suggestion = (await payload.findByID({ collection: 'destination-suggestions', id: id as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That suggestion could not be found.')
  if (suggestion.status !== 'pending') fail('conflict', 'This suggestion was already handled.')
  const accept = input.decision === 'accept'
  let destination: string | null = null
  if (accept) {
    const found = await destinationsByIds([isUuid(input.destinationId) ? input.destinationId : null], payload)
    destination = found[0]?.id ?? invalid({ destinationId: 'Choose the published destination record that matches this suggestion. Create it in the CMS first if it does not exist.' })
  }
  const resolution = reasonFrom(input.resolution, !accept, 'resolution')
  await inTransaction(async (tx) => {
    await tx.payload.update({ collection: 'destination-suggestions', id: suggestion.id, data: { status: accept ? 'accepted' : 'rejected', destination, resolution }, req: tx.req })
    await audit(tx, { action: accept ? 'accept_suggestion' : 'reject_suggestion', actor: staff, targetType: 'suggestion', targetId: suggestion.id, reason: resolution, details: { destination } })
    const member = relId(suggestion.member)
    if (member) await notify(tx, { recipient: member, type: 'account_notice', message: accept ? `“${suggestion.name}” is now available as a destination.` : `Your suggestion “${suggestion.name}” was not added.`, path: '/account', dedupeKey: `suggestion:${suggestion.id}` })
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------------------------
// Reading for the moderation console
// ---------------------------------------------------------------------------------------------

export type QueueItem = { id: string; type: ContributionType; title: string; state: string; kind: 'new' | 'edit'; authorName: string; authorId: string | null; submittedAt: string | null; openReports: number }

async function memberNames(ids: (string | null)[]): Promise<Map<string, { name: string; handle: string; email: string; status: string }>> {
  const unique = [...new Set(ids.filter(isUuid))]
  const map = new Map<string, { name: string; handle: string; email: string; status: string }>()
  if (!unique.length) return map
  const payload = await cms()
  const found = await payload.find({ collection: 'members', where: { id: { in: unique } }, limit: unique.length, pagination: false, depth: 0 })
  for (const m of found.docs) map.set(m.id, { name: m.displayName, handle: m.handle, email: m.email, status: m.status })
  return map
}

/** Contributions waiting for a decision, oldest first, so nothing waits behind newer items. */
export async function reviewQueue(staffIn: StaffActor, filter: { type?: string | null; kind?: string | null } = {}): Promise<QueueItem[]> {
  requireModerator(staffIn)
  const payload = await cms()
  const found = await payload.find({
    collection: 'contributions',
    where: { and: [{ pendingRevision: { exists: true } }, { state: { in: filter.kind === 'edit' ? ['published'] : filter.kind === 'new' ? ['pending'] : ['pending', 'published'] } }, ...(filter.type ? [{ type: { equals: filter.type } }] : [])] },
    sort: ['submittedAt', 'id'], limit: 200, pagination: false, depth: 0,
  })
  const names = await memberNames(found.docs.map((d) => relId(d.author)))
  return found.docs.map((d) => ({ id: d.id, type: d.type as ContributionType, title: d.title, state: d.state, kind: d.state === 'published' ? 'edit' : 'new', authorName: names.get(relId(d.author) ?? '')?.name ?? 'Deleted member', authorId: relId(d.author), submittedAt: d.submittedAt ?? null, openReports: 0 }))
}

export type ReviewView = {
  doc: Contribution
  path: string | null
  proposed: Content | null
  approved: Content | null
  author: { id: string; name: string; handle: string; email: string; status: string } | null
  places: Map<string, string>
  photos: { id: string; url: string; alt: string; state: string }[]
  revisions: { id: string; number: number; kind: string; reviewState: string; reason: string; createdAt: string }[]
  history: { action: string; actor: string; reason: string; at: string }[]
  reports: { id: string; category: string; details: string; status: string; targetType: string; createdAt: string }[]
  replies: { id: string; body: string; state: string; authorName: string; createdAt: string; note: string }[]
}

/** Everything a moderator needs to decide one post: what is proposed, what is public now, who wrote it and what happened before. */
export async function getForReview(staffIn: StaffActor, id: unknown): Promise<ReviewView> {
  requireModerator(staffIn)
  const doc = await loadContribution(id)
  const payload = await cms()
  const pendingId = relId(doc.pendingRevision)
  const pending = pendingId ? await payload.findByID({ collection: 'revisions', id: pendingId, depth: 0, disableErrors: true }) : null
  const proposed = pending?.reviewState === 'pending' ? (pending.snapshot as unknown as Content) : null
  const approved = doc.publishedAt ? docToContent(doc) : null
  const shown = proposed ?? docToContent(doc)
  const [revisions, history, reports, replies, media] = await Promise.all([
    payload.find({ collection: 'revisions', where: { contribution: { equals: doc.id } }, sort: '-number', limit: 50, depth: 0 }),
    payload.find({ collection: 'moderation-actions', where: { contribution: { equals: doc.id } }, sort: '-createdAt', limit: 100, depth: 1 }),
    payload.find({ collection: 'reports', where: { contribution: { equals: doc.id } }, sort: '-createdAt', limit: 50, depth: 0 }),
    payload.find({ collection: 'replies', where: { contribution: { equals: doc.id } }, sort: '-createdAt', limit: 100, depth: 0 }),
    payload.find({ collection: 'media', where: { id: { in: [...new Set([...shown.photos, ...(approved?.photos ?? [])])].length ? [...new Set([...shown.photos, ...(approved?.photos ?? [])])] : ['00000000-0000-0000-0000-000000000000'] } }, limit: 50, pagination: false, depth: 0 }),
  ])
  const names = await memberNames([relId(doc.author), ...replies.docs.map((r) => relId(r.author))])
  const placeIds = [...shown.destinations, ...(approved?.destinations ?? []), ...(shown.itineraryDays ?? []).flatMap((d) => d.stops.map((s) => s.destination))]
  const places = new Map((await destinationsByIds(placeIds, payload)).map((p) => [p.id, p.label]))
  const authorId = relId(doc.author)
  const author = authorId && names.get(authorId) ? { id: authorId, ...names.get(authorId)! } : null
  return {
    doc,
    path: doc.state === 'published' ? contributionPath(doc) : null,
    proposed, approved, author, places,
    photos: media.docs.map((m) => ({ id: m.id, url: m.sizes?.card?.url ?? m.url ?? '', alt: m.alt ?? '', state: m.state })),
    revisions: revisions.docs.map((r) => ({ id: r.id, number: r.number, kind: r.kind, reviewState: r.reviewState, reason: r.reason ?? '', createdAt: r.createdAt })),
    history: history.docs.map((h) => ({ action: h.action, actor: h.actorType === 'staff' ? `Staff: ${typeof h.staff === 'object' && h.staff ? h.staff.name : 'unknown'}` : h.actorType === 'member' ? 'Member' : 'System', reason: h.reason ?? '', at: h.createdAt })),
    reports: reports.docs.map((r) => ({ id: r.id, category: r.category, details: r.details ?? '', status: r.status, targetType: r.targetType, createdAt: r.createdAt })),
    replies: replies.docs.map((r) => ({ id: r.id, body: r.body, state: r.state, authorName: names.get(relId(r.author) ?? '')?.name ?? 'Deleted member', createdAt: r.createdAt, note: r.moderationNote ?? '' })),
  }
}

export type PendingReply = { id: string; body: string; authorName: string; authorId: string | null; createdAt: string; contributionId: string; contributionTitle: string; contributionPath: string | null; isReplyToReply: boolean }

export async function pendingReplies(staffIn: StaffActor): Promise<PendingReply[]> {
  requireModerator(staffIn)
  const payload = await cms()
  const found = await payload.find({ collection: 'replies', where: { state: { equals: 'pending' } }, sort: ['createdAt', 'id'], limit: 200, pagination: false, depth: 1 })
  const names = await memberNames(found.docs.map((r) => relId(r.author)))
  return found.docs.map((r) => {
    const c = typeof r.contribution === 'object' ? r.contribution : null
    return { id: r.id, body: r.body, authorName: names.get(relId(r.author) ?? '')?.name ?? 'Deleted member', authorId: relId(r.author), createdAt: r.createdAt, contributionId: relId(r.contribution) ?? '', contributionTitle: c?.title ?? '', contributionPath: c && c.state === 'published' ? contributionPath(c) : null, isReplyToReply: Boolean(relId(r.parent)) }
  })
}

export type ReportItem = { id: string; category: string; details: string; status: string; targetType: string; targetId: string; contributionId: string | null; contributionTitle: string; reporterName: string; createdAt: string; resolution: string }

export async function listReports(staffIn: StaffActor, status: 'open' | 'resolved' | 'dismissed' = 'open'): Promise<ReportItem[]> {
  requireModerator(staffIn)
  const payload = await cms()
  const found = await payload.find({ collection: 'reports', where: { status: { equals: status } }, sort: status === 'open' ? ['createdAt', 'id'] : ['-createdAt'], limit: 200, pagination: false, depth: 1 })
  const names = await memberNames(found.docs.map((r) => relId(r.reporter)))
  return found.docs.map((r) => ({ id: r.id, category: r.category, details: r.details ?? '', status: r.status, targetType: r.targetType, targetId: r.targetId, contributionId: relId(r.contribution), contributionTitle: typeof r.contribution === 'object' && r.contribution ? r.contribution.title : '', reporterName: names.get(relId(r.reporter) ?? '')?.name ?? 'Deleted member', createdAt: r.createdAt, resolution: r.resolution ?? '' }))
}

export async function listSuggestions(staffIn: StaffActor): Promise<{ id: string; name: string; country: string; details: string; memberName: string; createdAt: string }[]> {
  requireModerator(staffIn)
  const payload = await cms()
  const found = await payload.find({ collection: 'destination-suggestions', where: { status: { equals: 'pending' } }, sort: 'createdAt', limit: 200, pagination: false, depth: 0 })
  const names = await memberNames(found.docs.map((s) => relId(s.member)))
  return found.docs.map((s) => ({ id: s.id, name: s.name, country: s.country, details: s.details ?? '', memberName: names.get(relId(s.member) ?? '')?.name ?? 'Deleted member', createdAt: s.createdAt }))
}

export type MemberOverview = {
  id: string; handle: string; displayName: string; email: string; status: string; statusReason: string; suspendedUntil: string | null; trusted: boolean; verified: boolean; createdAt: string
  counts: { published: number; pending: number; rejected: number; replies: number; reportsAgainst: number }
  posts: { id: string; title: string; type: string; state: string; updatedAt: string }[]
  actions: { action: string; reason: string; at: string }[]
}

export async function getMemberOverview(staffIn: StaffActor, memberId: unknown): Promise<MemberOverview> {
  requireModerator(staffIn)
  if (!isUuid(memberId)) fail('not_found', 'That member could not be found.')
  const payload = await cms()
  const m = (await payload.findByID({ collection: 'members', id: memberId as string, depth: 0, disableErrors: true })) ?? fail('not_found', 'That member could not be found.')
  const [posts, replies, reports, actions] = await Promise.all([
    payload.find({ collection: 'contributions', where: { author: { equals: m.id } }, sort: '-updatedAt', limit: 100, depth: 0 }),
    payload.count({ collection: 'replies', where: { and: [{ author: { equals: m.id } }, { state: { equals: 'published' } }] } }),
    payload.count({ collection: 'reports', where: { and: [{ targetType: { equals: 'member' } }, { targetId: { equals: m.id } }] } }),
    payload.find({ collection: 'moderation-actions', where: { and: [{ targetType: { equals: 'member' } }, { targetId: { equals: m.id } }] }, sort: '-createdAt', limit: 50, depth: 0 }),
  ])
  const count = (state: string) => posts.docs.filter((p) => p.state === state).length
  return {
    id: m.id, handle: m.handle, displayName: m.displayName, email: m.email, status: m.status, statusReason: m.statusReason ?? '', suspendedUntil: m.suspendedUntil ?? null, trusted: Boolean(m.trusted), verified: m._verified !== false, createdAt: m.createdAt,
    counts: { published: count('published'), pending: count('pending'), rejected: count('rejected'), replies: replies.totalDocs, reportsAgainst: reports.totalDocs },
    posts: posts.docs.map((p) => ({ id: p.id, title: p.title, type: p.type, state: p.state, updatedAt: p.updatedAt })),
    actions: actions.docs.map((a) => ({ action: a.action, reason: a.reason ?? '', at: a.createdAt })),
  }
}

export async function findMembers(staffIn: StaffActor, query: unknown): Promise<{ id: string; handle: string; displayName: string; email: string; status: string }[]> {
  requireModerator(staffIn)
  const q = cleanLine(query, 100)
  const payload = await cms()
  const found = await payload.find({
    collection: 'members',
    where: q ? { or: [{ handle: { like: q } }, { displayName: { like: q } }, { email: { like: q } }] } : { status: { not_equals: 'deleted' } },
    sort: '-createdAt', limit: 50, depth: 0,
  })
  return found.docs.map((m) => ({ id: m.id, handle: m.handle, displayName: m.displayName, email: m.email, status: m.status }))
}

export async function auditLog(staffIn: StaffActor, page = 1): Promise<{ items: { action: string; actor: string; targetType: string; targetId: string; contributionId: string | null; reason: string; at: string }[]; totalPages: number }> {
  requireModerator(staffIn)
  const payload = await cms()
  const found = await payload.find({ collection: 'moderation-actions', sort: ['-createdAt', 'id'], limit: 50, page: Math.max(1, page), depth: 1 })
  return {
    totalPages: found.totalPages,
    items: found.docs.map((h) => ({ action: h.action, actor: h.actorType === 'staff' ? `Staff: ${typeof h.staff === 'object' && h.staff ? h.staff.name : 'unknown'}` : h.actorType === 'member' ? `Member: ${typeof h.member === 'object' && h.member ? h.member.handle : 'unknown'}` : 'System', targetType: h.targetType, targetId: h.targetId, contributionId: relId(h.contribution), reason: h.reason ?? '', at: h.createdAt })),
  }
}
