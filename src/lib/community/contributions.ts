import type { Contribution } from '../../payload-types'
import { audit } from './audit'
import { TYPE_PATH, type ContributionState, type ContributionType, type EventStatus } from './constants'
import { buildSearchText, parseContent, type Content } from './content'
import { cms, inTransaction, relId, relIds, run, sql, type Tx } from './db'
import { destinationsByIds, isUuid, withAncestors } from './destinations'
import { fail, invalid } from './errors'
import { recountMember, requireActive } from './members'
import { track } from './metrics'
import { limit } from './ratelimit'
import { assertSubmissionsOpen } from './settings'
import { cleanLine, newShortId, slugify } from './text'
import type { MemberActor } from './types'

export const contributionPath = (doc: { type: string; shortId: string; slug: string }): string => `${TYPE_PATH[doc.type as ContributionType]}/${doc.shortId}-${doc.slug}`

/** Read the member-editable content back out of a stored contribution. */
export function docToContent(doc: Contribution): Content {
  const type = doc.type as ContributionType
  const content: Content = {
    title: doc.title === UNTITLED ? '' : doc.title,
    body: doc.body ?? '',
    language: doc.language ?? 'en',
    destinations: relIds(doc.destinations),
    topics: relIds(doc.topics),
    style: doc.style ?? null,
    photos: relIds(doc.photos),
  }
  if (type === 'question') {
    const q = doc.question ?? {}
    content.question = { travelMonth: q.travelMonth ?? null, durationDays: q.durationDays ?? null, partyType: q.partyType ?? null, budgetMinor: q.budgetMinor ?? null, budgetCurrency: q.budgetCurrency ?? null }
  }
  if (type === 'trip') {
    const t = doc.trip ?? {}
    content.trip = {
      startDate: t.startDate ?? null, endDate: t.endDate ?? null, travelMonth: t.travelMonth ?? null, durationDays: t.durationDays ?? null, nights: t.nights ?? null,
      partySize: t.partySize ?? null, partyType: t.partyType ?? null, costScope: t.costScope ?? null, flightsIncluded: Boolean(t.flightsIncluded), costNotes: t.costNotes ?? '',
      transport: t.transport ?? '', recommendations: t.recommendations ?? '', mistakes: t.mistakes ?? '', permission: Boolean(t.permissionGivenAt),
    }
    content.tripCosts = (doc.tripCosts ?? []).map((c) => ({ category: c.category, amountMinor: c.amountMinor, currency: c.currency, basis: c.basis ?? 'total', quantity: c.quantity ?? 1, date: c.date ?? null, kind: c.kind ?? 'measured', note: c.note ?? '' }))
    content.itineraryDays = (doc.itineraryDays ?? []).map((d) => ({
      title: d.title ?? '', date: d.date ?? null,
      stops: (d.stops ?? []).map((s) => ({ title: s.title, destination: relId(s.destination), place: s.place ?? '', timeNote: s.timeNote ?? '', costMinor: s.costMinor ?? null, costCurrency: s.costCurrency ?? null, description: s.description ?? '' })),
    }))
  }
  if (type === 'activity') {
    const a = doc.activity ?? {}
    content.activity = {
      category: a.category ?? null, format: a.format ?? null, venueName: a.venueName ?? '', venueAddress: a.venueAddress ?? '', timeZone: a.timeZone ?? null, allDay: Boolean(a.allDay),
      startLocal: a.startLocal ?? null, endLocal: a.endLocal ?? null, startsAt: a.startsAt ?? null, endsAt: a.endsAt ?? null,
      priceState: a.priceState ?? null, priceMinor: a.priceMinor ?? null, priceCurrency: a.priceCurrency ?? null, bookingUrl: a.bookingUrl ?? null, sourceUrl: a.sourceUrl ?? null,
      organiserName: a.organiserName ?? '', organiserContact: a.organiserContact ?? '', disclosure: a.disclosure ?? 'none', audience: a.audience ?? '', accessibility: a.accessibility ?? '', capacity: a.capacity ?? null,
    }
  }
  return content
}

const UNTITLED = '(untitled draft)'

/**
 * Turn checked content into the fields stored on a contribution.
 * Fields only a moderator or the system may set are carried over from `existing`, never from the member.
 */
async function contentToData(tx: Tx, type: ContributionType, content: Content, existing: Contribution | null) {
  const title = content.title || UNTITLED
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- built field by field to match the generated collection type
  const data: Record<string, any> = {
    title,
    slug: slugify(title),
    body: content.body,
    language: content.language,
    destinations: content.destinations,
    destinationTree: await withAncestors(content.destinations, tx.payload),
    topics: content.topics,
    style: content.style,
    photos: content.photos,
  }
  if (type === 'question' && content.question) data.question = { ...(existing?.question ?? {}), ...content.question }
  if (type === 'trip' && content.trip) {
    const { permission, ...trip } = content.trip
    data.trip = { ...trip, permissionGivenAt: permission ? existing?.trip?.permissionGivenAt ?? new Date().toISOString() : null }
    data.tripCosts = content.tripCosts ?? []
    data.itineraryDays = content.itineraryDays ?? []
  }
  if (type === 'activity' && content.activity) data.activity = { ...(existing?.activity ?? {}), ...content.activity }
  return data
}

/**
 * Attach the listed photos to a contribution. A photo can only be attached by its owner, and
 * only if it is not already part of another contribution.
 */
async function attachPhotos(tx: Tx, contributionId: string, memberId: string, photoIds: string[]): Promise<void> {
  if (!photoIds.length) return
  const found = await tx.payload.find({ collection: 'media', where: { id: { in: photoIds } }, limit: photoIds.length, pagination: false, depth: 0, req: tx.req })
  for (const id of photoIds) {
    const media = found.docs.find((m) => m.id === id)
    const attachedTo = relId(media?.contribution)
    if (!media || relId(media.owner) !== memberId || media.purpose !== 'photo' || !['pending', 'approved'].includes(media.state) || (attachedTo && attachedTo !== contributionId)) {
      invalid({ photos: 'One of the photos is not available. Remove it and upload it again.' })
    }
    if (!attachedTo) await tx.payload.update({ collection: 'media', id, data: { contribution: contributionId }, req: tx.req })
  }
}

/** Photos that were attached to this contribution but are no longer part of it are taken out of use. */
async function releasePhotos(tx: Tx, contributionId: string, keep: string[]): Promise<void> {
  const attached = await tx.payload.find({ collection: 'media', where: { contribution: { equals: contributionId } }, limit: 200, pagination: false, depth: 0, select: { state: true }, req: tx.req })
  for (const media of attached.docs) {
    if (!keep.includes(media.id) && media.state !== 'removed') await tx.payload.update({ collection: 'media', id: media.id, data: { state: 'removed' }, req: tx.req })
  }
}

async function nextRevisionNumber(tx: Tx, contributionId: string): Promise<number> {
  const result = await run(tx.payload, sql`SELECT COALESCE(MAX("number"), 0) + 1 AS next FROM "revisions" WHERE "contribution_id" = ${contributionId}::uuid`, tx.req)
  return Number(result.rows[0]?.next ?? 1)
}

async function pendingCount(tx: Tx, memberId: string): Promise<number> {
  const result = await run(
    tx.payload,
    sql`SELECT COUNT(*) AS n FROM "contributions" WHERE "author_id" = ${memberId}::uuid AND ("state" = 'pending' OR "pending_revision_id" IS NOT NULL)`,
    tx.req,
  )
  return Number(result.rows[0]?.n ?? 0)
}

export type SaveResult = { id: string; shortId: string; state: ContributionState; /** True when an edit to a published post is now waiting for review. */ editPending: boolean }

/**
 * Save a draft, submit for review, or propose an edit to something already published.
 *
 * - The author is always the signed-in member. An author id from the browser is never read.
 * - A published contribution is never changed here. An edit to it becomes a pending revision and
 *   the public page keeps showing the approved version until a moderator approves the edit.
 */
export async function saveContribution(
  actor: MemberActor,
  args: { id?: string | null; type: ContributionType; input: Record<string, unknown>; intent: 'save' | 'submit' },
): Promise<SaveResult> {
  const member = await requireActive(actor)
  const settings = await assertSubmissionsOpen()
  const submit = args.intent === 'submit'
  await limit(submit ? 'submission' : 'draft_save', member.id)
  const payload = await cms()

  let existing: Contribution | null = null
  if (args.id) {
    if (!isUuid(args.id)) fail('not_found', 'That draft could not be found.')
    existing = await payload.findByID({ collection: 'contributions', id: args.id, depth: 0, disableErrors: true })
    // Someone else's post answers exactly like one that does not exist.
    if (!existing || relId(existing.author) !== member.id) fail('not_found', 'That draft could not be found.')
  }
  const type = (existing?.type as ContributionType | undefined) ?? args.type
  const state = (existing?.state as ContributionState | undefined) ?? 'draft'
  const editingPublished = state === 'published'
  if (state === 'pending') fail('conflict', 'This is waiting for review. Withdraw it first if you want to change it.')
  if (state === 'rejected' || state === 'hidden' || state === 'removed') fail('conflict', 'This can no longer be edited.')
  if (editingPublished && !submit) fail('conflict', 'Changes to a published post are sent for review when you submit them.')

  // An event that is already running or over can still have its text corrected.
  const { content, errors } = await parseContent(type, args.input, { strict: submit, payload, allowPastEvent: editingPublished })
  if (Object.keys(errors).length) invalid(errors, submit ? 'Please fix the highlighted fields before submitting.' : 'Some fields are not valid.')

  const result = await inTransaction(async (tx) => {
    if (submit && (await pendingCount(tx, member.id)) >= settings.maxPendingPerMember && !(existing && relId(existing.pendingRevision))) {
      fail('rate_limited', `You already have ${settings.maxPendingPerMember} items waiting for review. Please wait for a moderator before sending more.`)
    }

    if (editingPublished && existing) {
      if (JSON.stringify(docToContent(existing)) === JSON.stringify(content)) fail('validation', 'You have not changed anything.')
      await attachPhotos(tx, existing.id, member.id, content.photos)
      const previous = relId(existing.pendingRevision)
      if (previous) await tx.payload.update({ collection: 'revisions', id: previous, data: { reviewState: 'superseded' }, req: tx.req })
      const revision = await tx.payload.create({
        collection: 'revisions',
        req: tx.req,
        data: { contribution: existing.id, number: await nextRevisionNumber(tx, existing.id), kind: 'edit', editor: member.id, snapshot: content, reviewState: 'pending' },
      })
      await tx.payload.update({ collection: 'contributions', id: existing.id, data: { pendingRevision: revision.id, submittedAt: new Date().toISOString() }, req: tx.req })
      await audit(tx, { action: 'propose_revision', actor: member, targetType: 'revision', targetId: revision.id, contribution: existing.id })
      return { id: existing.id, shortId: existing.shortId, state: 'published' as ContributionState, editPending: true }
    }

    const data = await contentToData(tx, type, content, existing)
    const doc = existing
      ? await tx.payload.update({ collection: 'contributions', id: existing.id, data, req: tx.req })
      : await tx.payload.create({ collection: 'contributions', req: tx.req, data: { ...data, shortId: newShortId(), type, author: member.id, state: 'draft', indexing: 'policy' } as never })
    await attachPhotos(tx, doc.id, member.id, content.photos)
    await releasePhotos(tx, doc.id, content.photos)

    if (!submit) return { id: doc.id, shortId: doc.shortId, state: doc.state as ContributionState, editPending: false }

    const revision = await tx.payload.create({
      collection: 'revisions',
      req: tx.req,
      data: { contribution: doc.id, number: await nextRevisionNumber(tx, doc.id), kind: 'submission', editor: member.id, snapshot: content, reviewState: 'pending' },
    })
    await tx.payload.update({
      collection: 'contributions',
      id: doc.id,
      req: tx.req,
      data: { state: 'pending', submittedAt: new Date().toISOString(), pendingRevision: revision.id, moderation: { ...(doc.moderation ?? {}), note: '' } },
    })
    await audit(tx, { action: 'submit', actor: member, targetType: 'contribution', targetId: doc.id, contribution: doc.id, details: { revision: revision.id } })
    return { id: doc.id, shortId: doc.shortId, state: 'pending' as ContributionState, editPending: false }
  })
  if (submit && type === 'question' && !editingPublished) await track('question_submitted')
  return result
}

async function ownContribution(actor: MemberActor, id: string): Promise<Contribution> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  if (!isUuid(id)) fail('not_found', 'That post could not be found.')
  const payload = await cms()
  const doc = await payload.findByID({ collection: 'contributions', id, depth: 0, disableErrors: true })
  if (!doc || relId(doc.author) !== actor.id) return fail('not_found', 'That post could not be found.')
  return doc
}

/** Take a submission back out of the review queue so it can be changed. */
export async function withdrawSubmission(actor: MemberActor, id: string): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  const doc = await ownContribution(member, id)
  const pendingRevision = relId(doc.pendingRevision)
  if (doc.state !== 'pending' && !(doc.state === 'published' && pendingRevision)) fail('conflict', 'There is nothing waiting for review to withdraw.')
  await inTransaction(async (tx) => {
    if (pendingRevision) await tx.payload.update({ collection: 'revisions', id: pendingRevision, data: { reviewState: 'superseded' }, req: tx.req })
    await tx.payload.update({ collection: 'contributions', id: doc.id, data: { pendingRevision: null, ...(doc.state === 'pending' ? { state: 'draft' } : {}) }, req: tx.req })
    await audit(tx, { action: 'withdraw', actor: member, targetType: 'contribution', targetId: doc.id, contribution: doc.id })
  })
  return { ok: true }
}

/** Delete something that was never published. Published posts are removed with `removeOwn` instead. */
export async function deleteDraft(actor: MemberActor, id: string): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const doc = await ownContribution(actor, id)
  if (!['draft', 'changes_requested', 'rejected'].includes(doc.state)) fail('conflict', 'Only drafts and items that were not accepted can be deleted. Withdraw it first if it is waiting for review.')
  await inTransaction(async (tx) => {
    await run(tx.payload, sql`UPDATE "media" SET "state" = 'removed', "contribution_id" = NULL WHERE "contribution_id" = ${doc.id}::uuid`, tx.req)
    await tx.payload.delete({ collection: 'revisions', where: { contribution: { equals: doc.id } }, req: tx.req })
    await tx.payload.delete({ collection: 'contributions', id: doc.id, req: tx.req })
  })
  return { ok: true }
}

/** The author takes their own published post down. It stops being public straight away. */
export async function removeOwn(actor: MemberActor, id: string): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const doc = await ownContribution(actor, id)
  if (doc.state !== 'published' && doc.state !== 'hidden') fail('conflict', 'This post is not published.')
  await inTransaction(async (tx) => {
    const pendingRevision = relId(doc.pendingRevision)
    if (pendingRevision) await tx.payload.update({ collection: 'revisions', id: pendingRevision, data: { reviewState: 'superseded' }, req: tx.req })
    await tx.payload.update({ collection: 'contributions', id: doc.id, data: { state: 'removed', pendingRevision: null, searchText: '' }, req: tx.req })
    await run(tx.payload, sql`UPDATE "media" SET "state" = 'removed' WHERE "contribution_id" = ${doc.id}::uuid`, tx.req)
    await audit(tx, { action: 'author_remove', actor, targetType: 'contribution', targetId: doc.id, contribution: doc.id })
    await recountMember(tx.payload, actor.id, tx.req)
  })
  return { ok: true }
}

export type OwnItem = {
  id: string; shortId: string; type: ContributionType; title: string; state: ContributionState; editPending: boolean
  note: string; updatedAt: string; path: string | null; replyCount: number
}

/** The member's own contributions in every state, newest first. */
export async function listOwn(actor: MemberActor): Promise<OwnItem[]> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const found = await payload.find({ collection: 'contributions', where: { author: { equals: actor.id } }, sort: '-updatedAt', limit: 200, pagination: false, depth: 0 })
  return found.docs.map((doc) => ({
    id: doc.id, shortId: doc.shortId, type: doc.type as ContributionType, title: doc.title, state: doc.state as ContributionState, editPending: Boolean(relId(doc.pendingRevision)) && doc.state === 'published',
    note: doc.moderation?.note ?? '', updatedAt: doc.updatedAt, path: doc.state === 'published' ? contributionPath(doc) : null, replyCount: doc.replyCount ?? 0,
  }))
}

export type OwnEditable = { id: string; shortId: string; type: ContributionType; state: ContributionState; editPending: boolean; note: string; content: Content; canEdit: boolean; publicPath: string | null; eventStatus: string | null }

/** One of the member's own contributions, with the content to edit: the pending edit if there is one, otherwise what is stored. */
export async function getOwn(actor: MemberActor, id: string): Promise<OwnEditable> {
  const doc = await ownContribution(actor, id)
  const payload = await cms()
  let content = docToContent(doc)
  const pendingRevision = relId(doc.pendingRevision)
  if (doc.state === 'published' && pendingRevision) {
    const revision = await payload.findByID({ collection: 'revisions', id: pendingRevision, depth: 0, disableErrors: true })
    if (revision?.reviewState === 'pending' && revision.snapshot) content = revision.snapshot as unknown as Content
  }
  return {
    id: doc.id, shortId: doc.shortId, type: doc.type as ContributionType, state: doc.state as ContributionState, editPending: Boolean(pendingRevision) && doc.state === 'published',
    note: doc.moderation?.note ?? '', content, canEdit: ['draft', 'changes_requested', 'published'].includes(doc.state),
    publicPath: doc.state === 'published' ? contributionPath(doc) : null, eventStatus: doc.type === 'activity' ? doc.activity?.eventStatus ?? 'scheduled' : null,
  }
}

/**
 * Copy approved content onto a contribution and rebuild what is derived from it.
 * Called only when a moderator approves a submission or an edit.
 */
export async function applyApprovedContent(tx: Tx, doc: Contribution, content: Content, extra: Record<string, unknown> = {}): Promise<Contribution> {
  const type = doc.type as ContributionType
  const data = await contentToData(tx, type, content, doc)
  const names = (await destinationsByIds(data.destinationTree as string[], tx.payload)).map((d) => d.name)
  data.searchText = buildSearchText(content, names)
  if (type === 'activity' && content.activity && doc.state === 'published') {
    // A new start time on a live listing is a reschedule. The first date is kept for the record.
    const before = doc.activity?.startLocal
    if (before && content.activity.startLocal && before !== content.activity.startLocal) {
      data.activity = { ...data.activity, eventStatus: 'rescheduled', originalStartLocal: doc.activity?.originalStartLocal ?? before, statusChangedAt: new Date().toISOString() }
    }
  }
  const updated = await tx.payload.update({ collection: 'contributions', id: doc.id, data: { ...data, ...extra }, req: tx.req })
  // Photos in the approved content become public; photos dropped from it stop being public.
  await run(tx.payload, sql`UPDATE "media" SET "state" = 'approved' WHERE "contribution_id" = ${doc.id}::uuid AND "state" IN ('pending', 'withheld') AND "id" IN (SELECT "media_id" FROM "contributions_rels" WHERE "parent_id" = ${doc.id}::uuid AND "path" = 'photos')`, tx.req)
  await run(tx.payload, sql`UPDATE "media" SET "state" = 'removed' WHERE "contribution_id" = ${doc.id}::uuid AND "state" <> 'removed' AND "id" NOT IN (SELECT "media_id" FROM "contributions_rels" WHERE "parent_id" = ${doc.id}::uuid AND "path" = 'photos' AND "media_id" IS NOT NULL)`, tx.req)
  return updated
}

/**
 * The organiser marks their own published activity as cancelled or postponed.
 *
 * This takes effect straight away, without waiting for review: a stale date that sends people to
 * an event that is not happening is a safety problem. It is logged, and people who said they are
 * interested or going are told. A new date is an edit and does go through review.
 */
export async function setOwnEventStatus(actor: MemberActor, id: string, input: { status: unknown; note: unknown }): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  const doc = await ownContribution(member, id)
  if (doc.type !== 'activity' || doc.state !== 'published') fail('conflict', 'Only a published activity can be cancelled or postponed.')
  const status = input.status === 'cancelled' || input.status === 'postponed' ? (input.status as EventStatus) : fail('validation', 'Choose cancelled or postponed.')
  const note = cleanLine(input.note, 300)
  if (doc.activity?.eventStatus === status) return { ok: true }
  if (doc.activity?.eventStatus === 'cancelled') fail('conflict', 'This activity is already cancelled. Submit a new activity if it will run again.')
  const { changeEventStatus } = await import('./events')
  await inTransaction((tx) => changeEventStatus(tx, doc, { status, note, actor: member }))
  return { ok: true }
}
