import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { AuthenticationError, LockedAuth, UnverifiedEmail, ValidationError } from 'payload'

import type { Member } from '../../payload-types'
import { audit } from './audit'
import { EMAIL_CATEGORIES, LIMITS, RESERVED_HANDLES, type EmailCategory } from './constants'
import { cms, inTransaction, relId, run, sql } from './db'
import { enqueueEmail } from './email/outbox'
import { validUnsubscribeSignature } from './email/templates'
import { emailMode } from './email/transport'
import { CommunityError, fail, invalid, type FieldErrors } from './errors'
import { track } from './metrics'
import { hashSubject, limit } from './ratelimit'
import { getSettings } from './settings'
import { cleanLine, cleanText, HANDLE_PATTERN, newShortId } from './text'
import type { MemberActor, PublicAuthor } from './types'

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/
const DELETED_NAME = 'Deleted member'

export const toActor = (doc: Member): MemberActor => ({
  kind: 'member',
  id: doc.id,
  handle: doc.handle,
  displayName: doc.displayName,
  email: doc.email,
  status: (doc.status as MemberActor['status']) ?? 'active',
  trusted: Boolean(doc.trusted),
})

/**
 * Load the member again from the database and confirm the account may act right now.
 * Every write calls this first, so a suspension takes effect on the very next request even if the
 * member still has a valid session or sends a hand-made request.
 */
export async function requireActive(actor: MemberActor | null | undefined, payload?: Payload): Promise<MemberActor> {
  if (!actor || actor.kind !== 'member') return fail('auth', 'Please sign in to continue.')
  const p = payload ?? (await cms())
  const doc = await p.findByID({ collection: 'members', id: actor.id, depth: 0, disableErrors: true })
  if (!doc || doc.status === 'deleted') return fail('auth', 'Please sign in to continue.')
  if (doc._verified === false) return fail('forbidden', 'Please confirm your email address before taking part.')
  if (doc.status === 'suspended') {
    const until = doc.suspendedUntil ? new Date(doc.suspendedUntil) : null
    if (!until || until.getTime() > Date.now()) {
      return fail('forbidden', `Your account is suspended${until ? ` until ${until.toISOString().slice(0, 10)}` : ''}, so you cannot post, reply, vote or report.${doc.statusReason ? ` Reason: ${doc.statusReason}` : ''}`)
    }
  }
  return toActor(doc)
}

function validatePassword(password: unknown, errors: FieldErrors, others: string[] = []): string {
  const value = typeof password === 'string' ? password : ''
  if (value.length < 10) errors.password = 'Use at least 10 characters.'
  else if (value.length > 128) errors.password = 'Use 128 characters or fewer.'
  else if (others.some((o) => o && value.toLowerCase() === o.toLowerCase())) errors.password = 'Choose a password that is different from your email and name.'
  return value
}

export type SignUpInput = { email: unknown; password: unknown; handle: unknown; displayName: unknown; acceptTerms: unknown; website?: unknown }

/**
 * Create an account and queue the confirmation email.
 * The answer is the same whether or not the email address already has an account, so the form
 * cannot be used to find out who is a member.
 */
export async function signUp(input: SignUpInput, context: { ip?: string | null }): Promise<{ ok: true }> {
  const settings = await getSettings()
  if (!settings.signupsOpen) fail('closed', 'Sign-up is not open yet.')
  if (emailMode() === 'off') fail('unavailable', 'Sign-up is not available yet, because the site cannot send confirmation emails.')
  // Honeypot: a hidden field that people leave empty. A filled field means a script; answer as if it worked.
  if (typeof input.website === 'string' && input.website.trim()) return { ok: true }
  await limit('signup_ip', context.ip ? hashSubject(context.ip) : null)

  const errors: FieldErrors = {}
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email) || email.length > 254) errors.email = 'Enter a valid email address.'
  const handle = typeof input.handle === 'string' ? input.handle.trim().toLowerCase() : ''
  if (!HANDLE_PATTERN.test(handle)) errors.handle = 'Use 3 to 30 lowercase letters, numbers or hyphens. Start and end with a letter or number.'
  else if (RESERVED_HANDLES.includes(handle) || handle.startsWith('deleted-')) errors.handle = 'That name is not available.'
  const displayName = cleanLine(input.displayName, 60)
  if (displayName.length < 2) errors.displayName = 'Enter the name to show on your posts.'
  const password = validatePassword(input.password, errors, [email, handle])
  if (input.acceptTerms !== true && input.acceptTerms !== 'on') errors.acceptTerms = 'Please accept the community rules and terms to continue.'
  if (Object.keys(errors).length) invalid(errors)

  const payload = await cms()
  const handleTaken = await payload.count({ collection: 'members', where: { handle: { equals: handle } } })
  if (handleTaken.totalDocs) invalid({ handle: 'That name is already taken.' })

  const existing = await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0, showHiddenFields: true })
  if (existing.docs[0]) {
    // Same answer as a new sign-up. If that account never confirmed its address, send the link again.
    await resendVerification(email, context).catch(() => undefined)
    return { ok: true }
  }

  try {
    await inTransaction(async (tx) => {
      const created = await tx.payload.create({
        collection: 'members',
        req: tx.req,
        disableVerificationEmail: true,
        showHiddenFields: true,
        data: { email, password, handle, displayName, status: 'active', termsAcceptedAt: new Date().toISOString() },
      })
      const token = (created as Member & { _verificationToken?: string | null })._verificationToken
      if (!token) throw new Error('No verification token was generated.')
      await enqueueEmail(tx, { template: 'verify_email', recipient: created.id, data: { token }, idempotencyKey: `verify:${created.id}:${token.slice(0, 12)}` })
    })
  } catch (error) {
    // Two sign-ups raced for the same name or address: the database's unique rule decided.
    if (error instanceof ValidationError) invalid({ handle: 'That name or email address was just taken. Please try again.' })
    throw error
  }
  return { ok: true }
}

/** Send the confirmation link again to an account that has not confirmed yet. Always answers the same. */
export async function resendVerification(emailInput: unknown, context: { ip?: string | null }): Promise<{ ok: true }> {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) return { ok: true }
  await limit('recovery_ip', context.ip ? hashSubject(context.ip) : null)
  await limit('recovery_account', hashSubject(email))
  const payload = await cms()
  const found = await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0, showHiddenFields: true })
  const member = found.docs[0] as (Member & { _verificationToken?: string | null }) | undefined
  if (member && member._verified === false && member._verificationToken && member.status === 'active') {
    const hour = new Date().toISOString().slice(0, 13)
    await inTransaction((tx) => enqueueEmail(tx, { template: 'verify_email', recipient: member.id, data: { token: member._verificationToken }, idempotencyKey: `verify:${member.id}:${hour}` }))
  }
  return { ok: true }
}

export async function verifyEmail(token: unknown): Promise<{ ok: true }> {
  if (typeof token !== 'string' || !/^[a-f0-9]{20,80}$/i.test(token)) fail('validation', 'This confirmation link is not valid. Ask for a new one from the sign-in page.')
  const payload = await cms()
  try {
    await payload.verifyEmail({ collection: 'members', token: token as string })
  } catch {
    fail('validation', 'This confirmation link is not valid or was already used. If you already confirmed, you can sign in.')
  }
  await track('member_verified')
  return { ok: true }
}

export type SignInResult = { token: string; exp: number; member: MemberActor }

/** Check the password with the CMS's own authentication. The caller stores the returned token in the session cookie. */
export async function signIn(input: { email: unknown; password: unknown }, context: { ip?: string | null }): Promise<SignInResult> {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  if (!email || !password) invalid({ email: 'Enter your email address and password.' })
  await limit('signin_ip', context.ip ? hashSubject(context.ip) : null)
  // Per account AND address, so a stranger guessing from elsewhere cannot lock the owner out. A
  // looser limit per account alone still stops slow guessing spread over many addresses.
  await limit('signin_account', hashSubject(`${email}|${context.ip ?? ''}`))
  await limit('signin_account_total', hashSubject(email))
  const payload = await cms()
  const wrong = () => fail('validation', 'The email address or password is not correct.')
  try {
    const result = await payload.login({ collection: 'members', data: { email, password }, depth: 0 })
    const member = result.user as unknown as Member
    if (!result.token || !member || member.status === 'deleted') return wrong()
    return { token: result.token, exp: result.exp ?? 0, member: toActor(member) }
  } catch (error) {
    if (error instanceof CommunityError) throw error
    if (error instanceof UnverifiedEmail) return fail('forbidden', 'Please confirm your email address first. We can send the confirmation link again.')
    // Same answer as a wrong password, so the reply never reveals whether an account exists.
    if (error instanceof LockedAuth) return wrong()
    if (error instanceof AuthenticationError || error instanceof ValidationError) return wrong()
    throw error
  }
}

/** End one session on the server, so a copied cookie stops working after sign-out. */
export async function endSession(memberId: string, sessionId: string | null | undefined): Promise<void> {
  const payload = await cms()
  const doc = (await payload.db.findOne({ collection: 'members', where: { id: { equals: memberId } } })) as { sessions?: { id: string }[] } | null
  if (!doc) return
  const sessions = (doc.sessions ?? []).filter((s) => (sessionId ? s.id !== sessionId : false))
  await payload.db.updateOne({ collection: 'members', id: memberId, data: { sessions }, returning: false })
}

/** Queue a password-reset email if the address has an account. Always answers the same. */
export async function requestPasswordReset(emailInput: unknown, context: { ip?: string | null }): Promise<{ ok: true }> {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) invalid({ email: 'Enter a valid email address.' })
  if (emailMode() === 'off') fail('unavailable', 'Password reset is not available, because the site cannot send email yet.')
  await limit('recovery_ip', context.ip ? hashSubject(context.ip) : null)
  await limit('recovery_account', hashSubject(email))
  const payload = await cms()
  const found = await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0 })
  const member = found.docs[0]
  if (!member || member.status === 'deleted') return { ok: true }
  const token = await payload.forgotPassword({ collection: 'members', data: { email }, disableEmail: true })
  if (token) await inTransaction((tx) => enqueueEmail(tx, { template: 'password_reset', recipient: member.id, data: { token }, idempotencyKey: `reset:${member.id}:${String(token).slice(0, 12)}` }))
  return { ok: true }
}

export async function resetPassword(input: { token: unknown; password: unknown }): Promise<{ ok: true }> {
  const errors: FieldErrors = {}
  const password = validatePassword(input.password, errors)
  if (Object.keys(errors).length) invalid(errors)
  if (typeof input.token !== 'string' || !/^[a-f0-9]{20,80}$/i.test(input.token)) fail('validation', 'This reset link is not valid. Ask for a new one.')
  const payload = await cms()
  try {
    // The CMS also ends every existing session for the account.
    await payload.resetPassword({ collection: 'members', data: { token: input.token as string, password }, overrideAccess: true })
  } catch {
    fail('validation', 'This reset link is not valid or has expired. Ask for a new one.')
  }
  return { ok: true }
}

/**
 * Change the password after checking the current one. Every other session of the account ends;
 * the session making the change (`sessionId`) stays signed in.
 */
export async function changePassword(actor: MemberActor, input: { current: unknown; next: unknown }, sessionId?: string | null): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  const errors: FieldErrors = {}
  const next = validatePassword(input.next, errors, [member.email, member.handle])
  if (Object.keys(errors).length) invalid({ next: errors.password })
  const payload = await cms()
  await limit('signin_account', hashSubject(member.email))
  try {
    await payload.login({ collection: 'members', data: { email: member.email, password: String(input.current ?? '') }, depth: 0 })
  } catch {
    invalid({ current: 'Your current password is not correct.' })
  }
  // The CMS keeps only the session of the user making a password change and ends the rest. Without
  // a user it ends every session, which would sign the member out in the browser they are using.
  const doc = await payload.findByID({ collection: 'members', id: member.id, depth: 0 })
  const user = sessionId ? { ...doc, collection: 'members' as const, _sid: sessionId } : undefined
  await payload.update({ collection: 'members', id: member.id, data: { password: next }, user })
  return { ok: true }
}

export type ProfileInput = { displayName: unknown; bio: unknown; experience: unknown }

export async function updateProfile(actor: MemberActor, input: ProfileInput): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  const displayName = cleanLine(input.displayName, 60)
  const bio = cleanText(input.bio, LIMITS.bioMax)
  const experience = cleanLine(input.experience, 200)
  if (displayName.length < 2) invalid({ displayName: 'Enter the name to show on your posts.' })
  if (/https?:\/\//i.test(experience)) invalid({ experience: 'Please describe your experience in words, without links.' })
  const payload = await cms()
  await payload.update({ collection: 'members', id: member.id, data: { displayName, bio, experience } })
  return { ok: true }
}

export async function updateEmailPrefs(actor: MemberActor, prefs: Partial<Record<EmailCategory, boolean>>): Promise<{ ok: true }> {
  // A suspended member can still change email settings: it is their data, not a contribution.
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const current = await payload.findByID({ collection: 'members', id: actor.id, depth: 0 })
  const emailPrefs = { ...current.emailPrefs }
  for (const category of EMAIL_CATEGORIES) if (typeof prefs[category] === 'boolean') emailPrefs[category] = prefs[category]
  await payload.update({ collection: 'members', id: actor.id, data: { emailPrefs } })
  return { ok: true }
}

/** One-click unsubscribe from an email. The signed link is the proof; no sign-in is needed. */
export async function unsubscribe(memberId: unknown, category: unknown, signature: unknown): Promise<{ ok: true; category: EmailCategory }> {
  if (typeof memberId !== 'string' || typeof category !== 'string' || typeof signature !== 'string' || !(EMAIL_CATEGORIES as readonly string[]).includes(category) || !validUnsubscribeSignature(memberId, category, signature)) {
    fail('validation', 'This unsubscribe link is not valid. You can change email settings after signing in.')
  }
  const payload = await cms()
  const member = await payload.findByID({ collection: 'members', id: memberId as string, depth: 0, disableErrors: true })
  if (member) await payload.update({ collection: 'members', id: member.id, data: { emailPrefs: { ...member.emailPrefs, [category as EmailCategory]: false } } })
  return { ok: true, category: category as EmailCategory }
}

const publicAuthor = (doc: Pick<Member, 'handle' | 'displayName' | 'status' | 'experience'> | null | undefined): PublicAuthor =>
  !doc || doc.status === 'deleted'
    ? { handle: null, displayName: DELETED_NAME, hasProfile: false }
    : { handle: doc.handle, displayName: doc.displayName, experience: doc.experience || undefined, hasProfile: true }

/** Public author details for a set of member ids. Selects the public fields only. */
export async function authorsById(ids: (string | null | undefined)[]): Promise<Map<string, PublicAuthor>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, PublicAuthor>()
  if (!unique.length) return map
  const payload = await cms()
  const found = await payload.find({
    collection: 'members',
    where: { id: { in: unique } },
    limit: unique.length,
    pagination: false,
    depth: 0,
    select: { handle: true, displayName: true, status: true, experience: true },
  })
  for (const doc of found.docs) map.set(doc.id, publicAuthor(doc))
  for (const id of unique) if (!map.has(id)) map.set(id, publicAuthor(null))
  return map
}

export type PublicProfile = PublicAuthor & { id: string; bio: string; memberSince: string; publishedCount: number; answerCount: number }

/** The public profile for a handle, or null. Suspended and deleted accounts have no public profile. */
export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const payload = await cms()
  const found = await payload.find({
    collection: 'members',
    where: { and: [{ handle: { equals: handle.toLowerCase() } }, { status: { equals: 'active' } }, { _verified: { equals: true } }] },
    limit: 1,
    depth: 0,
    select: { handle: true, displayName: true, status: true, experience: true, bio: true, createdAt: true, publishedCount: true, answerCount: true },
  })
  const doc = found.docs[0]
  if (!doc) return null
  return { ...publicAuthor(doc), id: doc.id, bio: doc.bio ?? '', memberSince: doc.createdAt, publishedCount: doc.publishedCount ?? 0, answerCount: doc.answerCount ?? 0 }
}

/** Recount a member's public totals from the real rows. Called after anything that changes them. */
export async function recountMember(payload: Payload, memberId: string, req?: Parameters<typeof run>[2]): Promise<void> {
  await run(
    payload,
    sql`UPDATE "members" SET
          "published_count" = (SELECT COUNT(*) FROM "contributions" WHERE "author_id" = ${memberId}::uuid AND "state" = 'published'),
          "answer_count" = (SELECT COUNT(*) FROM "replies" WHERE "author_id" = ${memberId}::uuid AND "state" = 'published')
        WHERE "id" = ${memberId}::uuid`,
    req,
  )
}

/**
 * Everything the site holds that the member created or set, as plain data they can download.
 * Other people's content, moderators' private notes and security records are not included.
 */
export async function exportAccount(actor: MemberActor): Promise<Record<string, unknown>> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  await limit('export', actor.id)
  const payload = await cms()
  const me = await payload.findByID({ collection: 'members', id: actor.id, depth: 0 })
  const mine = { limit: 2000, pagination: false, depth: 0 } as const
  const [contributions, replies, plans, bookmarks, follows, rsvps, votes, reports, notifications, media, suggestions, revisions] = await Promise.all([
    payload.find({ collection: 'contributions', where: { author: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'replies', where: { author: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'plans', where: { owner: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'bookmarks', where: { member: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'follows', where: { member: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'rsvps', where: { member: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'votes', where: { member: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'reports', where: { reporter: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'notifications', where: { recipient: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'media', where: { owner: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'destination-suggestions', where: { member: { equals: actor.id } }, ...mine }),
    payload.find({ collection: 'revisions', where: { editor: { equals: actor.id } }, ...mine }),
  ])
  const strip = <T extends Record<string, unknown>>(doc: T, remove: string[]) => Object.fromEntries(Object.entries(doc).filter(([k]) => !remove.includes(k)))
  return {
    exportedAt: new Date().toISOString(),
    note: 'This file contains the data you created or set on Travel Notes. Moderation records about your account are kept separately and are not included.',
    account: { email: me.email, handle: me.handle, displayName: me.displayName, bio: me.bio, experience: me.experience, emailPreferences: me.emailPrefs, createdAt: me.createdAt, termsAcceptedAt: me.termsAcceptedAt },
    contributions: contributions.docs.map((c) => {
      const doc = strip(c as unknown as Record<string, unknown>, ['searchText', 'destinationTree', 'moderation', 'publishedRevision', 'pendingRevision', 'indexing'])
      return { ...doc, moderatorNoteToYou: c.moderation?.note ?? null }
    }),
    replies: replies.docs.map((r) => strip(r as unknown as Record<string, unknown>, ['reviewedBy'])),
    savedPlans: plans.docs,
    bookmarks: bookmarks.docs.map((b) => ({ targetType: b.targetType, targetId: b.targetId, createdAt: b.createdAt })),
    followedDestinations: follows.docs.map((f) => ({ destination: relId(f.destination), createdAt: f.createdAt })),
    rsvps: rsvps.docs.map((r) => ({ activity: relId(r.activity), status: r.status, showPublicly: r.showPublicly, createdAt: r.createdAt })),
    helpfulVotes: votes.docs.map((v) => ({ targetType: v.targetType, targetId: v.targetId, createdAt: v.createdAt })),
    reportsYouSent: reports.docs.map((r) => ({ targetType: r.targetType, targetId: r.targetId, category: r.category, details: r.details, status: r.status, createdAt: r.createdAt })),
    notifications: notifications.docs.map((n) => ({ type: n.type, message: n.message, path: n.path, readAt: n.readAt, createdAt: n.createdAt })),
    photos: media.docs.map((m) => ({ filename: m.filename, alt: m.alt, state: m.state, createdAt: m.createdAt })),
    editHistory: revisions.docs.map((r) => ({ contribution: relId(r.contribution), number: r.number, reviewState: r.reviewState, content: r.snapshot, createdAt: r.createdAt })),
    destinationSuggestions: suggestions.docs.map((s) => ({ name: s.name, country: s.country, details: s.details, status: s.status, createdAt: s.createdAt })),
  }
}

/**
 * Delete an account, following the policy in docs/community/data-model.md:
 * - the sign-in details and profile are erased and the row is kept only as an anonymous marker;
 * - private data (plans, bookmarks, follows, RSVPs, notifications, unsent email, drafts) is deleted;
 * - approved public posts stay, shown as written by "Deleted member", unless the member asks for
 *   them to be removed as well;
 * - audit records and reports are kept, pointing at the anonymous marker.
 */
export async function deleteAccount(actor: MemberActor, input: { password: unknown; removeContent: boolean }): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const me = await payload.findByID({ collection: 'members', id: actor.id, depth: 0, disableErrors: true })
  if (!me || me.status === 'deleted') fail('auth', 'Please sign in to continue.')
  await limit('signin_account_total', hashSubject(actor.email))
  try {
    await payload.login({ collection: 'members', data: { email: me!.email, password: String(input.password ?? '') }, depth: 0 })
  } catch {
    invalid({ password: 'Your password is not correct.' })
  }
  const id = actor.id
  const affectedActivities = new Set<string>()
  await inTransaction(async (tx) => {
    const { payload: p, req } = tx
    const rsvps = await p.find({ collection: 'rsvps', where: { member: { equals: id } }, limit: 2000, pagination: false, depth: 0, req })
    rsvps.docs.forEach((r) => { const a = relId(r.activity); if (a) affectedActivities.add(a) })
    for (const collection of ['plans', 'bookmarks', 'follows', 'rsvps', 'notifications'] as const) {
      const field = collection === 'plans' ? 'owner' : collection === 'notifications' ? 'recipient' : 'member'
      await p.delete({ collection, where: { [field]: { equals: id } }, req })
    }
    await run(p, sql`UPDATE "email_outbox" SET "status" = 'suppressed', "last_error" = 'account deleted', "data" = NULL WHERE "recipient_id" = ${id}::uuid`, req)
    // Never-published work is simply deleted. Published work is kept or removed, as the member chose.
    const unpublished = await p.find({ collection: 'contributions', where: { and: [{ author: { equals: id } }, { state: { in: ['draft', 'pending', 'changes_requested', 'rejected'] } }] }, limit: 2000, pagination: false, depth: 0, select: {}, req })
    const unpublishedIds = unpublished.docs.map((d) => d.id)
    if (unpublishedIds.length) {
      await p.delete({ collection: 'revisions', where: { contribution: { in: unpublishedIds } }, req })
      await p.delete({ collection: 'contributions', where: { id: { in: unpublishedIds } }, req })
    }
    await p.delete({ collection: 'replies', where: { and: [{ author: { equals: id } }, { state: { in: ['pending', 'rejected'] } }] }, req })
    await run(p, sql`UPDATE "revisions" SET "review_state" = 'superseded' WHERE "editor_id" = ${id}::uuid AND "review_state" = 'pending'`, req)
    await run(p, sql`UPDATE "contributions" SET "pending_revision_id" = NULL WHERE "author_id" = ${id}::uuid`, req)
    // The organiser's private contact details go in every case, including from the edit history.
    await run(p, sql`UPDATE "contributions" SET "activity_organiser_contact" = NULL WHERE "author_id" = ${id}::uuid`, req)
    await run(p, sql`UPDATE "revisions" SET "snapshot" = jsonb_set("snapshot", '{activity,organiserContact}', '""'::jsonb) WHERE "snapshot" ? 'activity' AND ("editor_id" = ${id}::uuid OR "contribution_id" IN (SELECT "id" FROM "contributions" WHERE "author_id" = ${id}::uuid))`, req)
    // Helpful votes are private choices: delete them and recount what they were on.
    const votes = await run(p, sql`DELETE FROM "votes" WHERE "member_id" = ${id}::uuid RETURNING "target_type"::text AS t, "target_id" AS i`, req)
    for (const v of votes.rows) {
      const table = v.t === 'reply' ? sql`"replies"` : sql`"contributions"`
      await run(p, sql`UPDATE ${table} SET "helpful_count" = (SELECT COUNT(*) FROM "votes" WHERE "target_type" = ${String(v.t)}::"enum_votes_target_type" AND "target_id" = ${String(v.i)}) WHERE "id" = ${String(v.i)}::uuid`, req)
    }
    await run(p, sql`DELETE FROM "destination_suggestions" WHERE "member_id" = ${id}::uuid AND "status" = 'pending'`, req)
    if (input.removeContent) {
      // Removed posts keep only an empty shell, so the audit trail still points somewhere.
      await run(p, sql`UPDATE "contributions" SET "state" = 'removed', "title" = 'Removed by the author', "body" = '', "search_text" = '', "updated_at" = now() WHERE "author_id" = ${id}::uuid AND "state" IN ('published', 'hidden', 'removed')`, req)
      await run(p, sql`UPDATE "revisions" SET "snapshot" = '{}'::jsonb WHERE "contribution_id" IN (SELECT "id" FROM "contributions" WHERE "author_id" = ${id}::uuid)`, req)
      await run(p, sql`UPDATE "replies" SET "state" = 'removed', "body" = '', "updated_at" = now() WHERE "author_id" = ${id}::uuid AND "state" IN ('published', 'hidden', 'removed')`, req)
      await run(p, sql`UPDATE "media" SET "state" = 'removed' WHERE "owner_id" = ${id}::uuid`, req)
    } else {
      // Photos that are not part of a published post go; the rest stay with the posts they illustrate.
      await run(p, sql`UPDATE "media" SET "state" = 'removed' WHERE "owner_id" = ${id}::uuid AND "state" <> 'approved'`, req)
    }
    await p.update({
      collection: 'members',
      id,
      req,
      data: {
        email: `deleted-${id}@deleted.invalid`,
        password: randomBytes(32).toString('hex'),
        handle: `deleted-${newShortId(10)}`,
        displayName: DELETED_NAME,
        bio: '',
        experience: '',
        avatar: null,
        status: 'deleted',
        statusReason: '',
        deletedAt: new Date().toISOString(),
        emailPrefs: { replies: false, moderation: false, events: false, digest: false },
        publishedCount: 0,
        answerCount: 0,
      },
    })
    await audit(tx, { action: 'account_deleted', actor: { ...actor, kind: 'member' }, targetType: 'member', targetId: id, details: { removeContent: input.removeContent } })
  })
  // Sessions are cleared outside the transaction with the adapter, the same way the CMS signs a user out.
  await endSession(id, null)
  const p = await cms()
  for (const activity of affectedActivities) await recountRsvps(p, activity)
  if (input.removeContent) await run(p, sql`UPDATE "contributions" c SET "reply_count" = (SELECT COUNT(*) FROM "replies" r WHERE r."contribution_id" = c."id" AND r."state" = 'published')`)
  return { ok: true }
}

export async function recountRsvps(payload: Payload, activityId: string, req?: Parameters<typeof run>[2]): Promise<void> {
  await run(
    payload,
    sql`UPDATE "contributions" SET
          "activity_interested_count" = (SELECT COUNT(*) FROM "rsvps" WHERE "activity_id" = ${activityId}::uuid AND "status" = 'interested'),
          "activity_going_count" = (SELECT COUNT(*) FROM "rsvps" WHERE "activity_id" = ${activityId}::uuid AND "status" = 'going')
        WHERE "id" = ${activityId}::uuid`,
    req,
  )
}
