/**
 * Shared setup for the community acceptance tests.
 *
 * These tests create and delete records, so they only run against a throwaway database named in
 * TEST_DATABASE_URL. Email uses the "capture" transport: nothing is ever sent to anyone.
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/tn_test npm run test:community
 */
import assert from 'node:assert/strict'
import type { Payload } from 'payload'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set. Refusing to run: these tests write to the database.')
  process.exit(1)
}
process.env.DATABASE_URL = testUrl
process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'test-only-secret'
process.env.EMAIL_TRANSPORT = 'capture'
// The tests post far more than a person would; the limiter itself is tested separately with its own small limit.
process.env.COMMUNITY_RATE_LIMIT_MULTIPLIER = '1000'
delete process.env.VERCEL
delete process.env.VERCEL_ENV

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helpers pass loosely typed docs
export type Any = any

export const stamp = Date.now().toString(36)
let counter = 0
export const unique = (prefix: string) => `${prefix}${stamp}${(counter++).toString(36)}`

export let payload: Payload
export const staff: { admin: Any; moderator: Any; editor: Any } = { admin: null, moderator: null, editor: null }
export const places: { thailand: Any; bangkok: Any; japan: Any; kyoto: Any } = { thailand: null, bangkok: null, japan: null, kyoto: null }

const COMMUNITY_TABLES = [
  'votes', 'bookmarks', 'follows', 'rsvps', 'plans', 'reports', 'moderation-actions', 'destination-suggestions', 'notifications',
  'email-outbox', 'rate-limits', 'metric-counters', 'job-runs', 'revisions', 'replies', 'media', 'contributions', 'members',
] as const

export async function setup(): Promise<void> {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  payload = await getPayload({ config })
  await payload.db.migrate()
  const { run, sql } = await import('../../src/lib/community/db')
  // Clear in an order that respects the links between tables.
  await run(payload, sql`UPDATE "contributions" SET "published_revision_id" = NULL, "pending_revision_id" = NULL, "question_accepted_answer_id" = NULL, "question_duplicate_of_id" = NULL`)
  await run(payload, sql`UPDATE "members" SET "avatar_id" = NULL`)
  for (const collection of COMMUNITY_TABLES) await payload.delete({ collection, where: { id: { exists: true } } })
  for (const collection of ['articles', 'topics', 'destinations', 'authors', 'staff'] as const) await payload.delete({ collection, where: { id: { exists: true } } })

  staff.admin = await payload.create({ collection: 'staff', data: { name: 'Admin', email: `admin-${stamp}@example.test`, password: 'x'.repeat(16), role: 'contributor' } as Any })
  staff.moderator = await payload.create({ collection: 'staff', data: { name: 'Moderator', email: `mod-${stamp}@example.test`, password: 'x'.repeat(16), role: 'contributor', communityModerator: true } as Any })
  staff.editor = await payload.create({ collection: 'staff', data: { name: 'Editor', email: `editor-${stamp}@example.test`, password: 'x'.repeat(16), role: 'editor' } as Any })

  const place = (data: Any) => payload.create({ collection: 'destinations', data: { summary: 'Test destination.', seo: { title: data.name, description: 'Test destination.' }, _status: 'published', ...data } as Any })
  places.thailand = await place({ name: 'Thailand', slug: 'thailand', kind: 'country', isoCountryCode: 'TH', timeZone: 'Asia/Bangkok' })
  places.bangkok = await place({ name: 'Bangkok', slug: 'bangkok', kind: 'city', parent: places.thailand.id, timeZone: 'Asia/Bangkok', aliases: ['Krung Thep'], population: 5000000 })
  places.japan = await place({ name: 'Japan', slug: 'japan', kind: 'country', isoCountryCode: 'JP', timeZone: 'Asia/Tokyo' })
  places.kyoto = await place({ name: 'Kyoto', slug: 'kyoto', kind: 'city', parent: places.japan.id, timeZone: 'Asia/Tokyo', population: 1400000 })

  await openCommunity()
}

export async function openCommunity(overrides: Any = {}): Promise<void> {
  await payload.updateGlobal({ slug: 'community-settings', data: { publicAccess: true, signupsOpen: true, submissionsOpen: true, maxPendingPerMember: 50, ...overrides } })
}

export const moderator = () => ({ kind: 'staff' as const, id: staff.moderator.id as string, name: 'Moderator', canModerate: true, isAdministrator: false })
export const administrator = () => ({ kind: 'staff' as const, id: staff.admin.id as string, name: 'Admin', canModerate: true, isAdministrator: true })
/** Active staff with an editorial role but no moderation rights. */
export const plainEditor = () => ({ kind: 'staff' as const, id: staff.editor.id as string, name: 'Editor', canModerate: false, isAdministrator: false })

/** The captured (never sent) emails for a member, newest first. */
export async function captured(memberId: string, template?: string): Promise<Any[]> {
  const found = await payload.find({ collection: 'email-outbox', where: { and: [{ recipient: { equals: memberId } }, ...(template ? [{ template: { equals: template } }] : [])] }, sort: '-createdAt', limit: 100, depth: 0 })
  return found.docs
}

/** Create a member the real way: sign up, read the confirmation link from the captured email, confirm. */
export async function newMember(name = 'Traveller'): Promise<Any> {
  const { signUp, verifyEmail, toActor } = await import('../../src/lib/community/members')
  const handle = unique('t').toLowerCase()
  const email = `${handle}@example.test`
  await signUp({ email, password: 'correct horse battery', handle, displayName: name, acceptTerms: true }, { ip: null })
  const doc = (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0 })).docs[0]
  assert.ok(doc, 'the member row exists')
  const mail = (await captured(doc.id, 'verify_email'))[0]
  assert.ok(mail?.data?.token, 'a confirmation email was captured')
  await verifyEmail(mail.data.token)
  const fresh = await payload.findByID({ collection: 'members', id: doc.id, depth: 0 })
  return { ...toActor(fresh), password: 'correct horse battery' }
}

export const questionInput = (over: Any = {}) => ({
  title: 'Is two days enough to see the main temples?',
  body: 'We arrive on a Friday evening and leave on Sunday night. Is it realistic to see the main temples without rushing?',
  destinations: [places.bangkok.id],
  ...over,
})

export const tripInput = (over: Any = {}) => ({
  title: 'Five slow days in Kyoto in spring',
  body: 'We spent five days in Kyoto in April. This report covers what we did each day, what it cost and what we would change.',
  destinations: [places.kyoto.id],
  travelMonth: '2026-04',
  durationDays: 5,
  partySize: 2,
  permission: true,
  ...over,
})

/** An activity that starts a given number of days from now, in Bangkok time. */
export const activityInput = (over: Any = {}, daysAhead = 10) => {
  const start = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10)
  return {
    title: 'Evening street food walk for travellers',
    body: 'An informal walk through the old town food stalls. We meet at the main gate and finish near the river after about two hours.',
    destinations: [places.bangkok.id],
    category: 'community_gathering',
    format: 'in_person',
    venueName: 'Old town main gate',
    timeZone: 'Asia/Bangkok',
    startLocal: `${start}T18:30`,
    endLocal: `${start}T20:30`,
    priceState: 'free',
    organiserName: 'Test organiser',
    organiserContact: 'organiser-private@example.test',
    ...over,
  }
}

/** Submit a contribution as a member and approve it as a moderator. Returns the stored row. */
export async function published(member: Any, type: 'question' | 'trip' | 'activity', input: Any): Promise<Any> {
  const { saveContribution } = await import('../../src/lib/community/contributions')
  const { decideContribution } = await import('../../src/lib/community/moderation')
  const saved = await saveContribution(member, { type, input, intent: 'submit' })
  await decideContribution(moderator(), saved.id, { decision: 'approve' })
  return payload.findByID({ collection: 'contributions', id: saved.id, depth: 0 })
}

export async function approvedReply(member: Any, contributionId: string, body = 'Yes, two days is enough if you start early and group the temples by area.'): Promise<Any> {
  const { postReply } = await import('../../src/lib/community/replies')
  const { decideReply } = await import('../../src/lib/community/moderation')
  const reply = await postReply(member, { contributionId, body })
  await decideReply(moderator(), reply.id, { decision: 'approve' })
  return payload.findByID({ collection: 'replies', id: reply.id, depth: 0 })
}

/** Expect a CommunityError with this code. */
export async function rejects(promise: Promise<unknown>, code: string, message?: string): Promise<Any> {
  try {
    await promise
  } catch (error: Any) {
    assert.equal(error?.name, 'CommunityError', `${message ?? ''} expected a CommunityError(${code}) but got: ${error?.stack ?? error}`)
    assert.equal(error.code, code, `${message ?? ''} expected code ${code}, got ${error.code}: ${error.message}`)
    return error
  }
  assert.fail(`${message ?? 'call'} should have been refused with ${code}`)
}

/** A request as it would arrive through the REST API: access rules on, signed in as this user. */
export const asUser = (user: Any, collection: 'members' | 'staff') => ({ overrideAccess: false, user: user ? { ...user, collection } : undefined })

/** How many rows of a collection this requester can see through the API rules. A refusal counts as none. */
export async function visibleRows(collection: Any, who: Any): Promise<Any[]> {
  try {
    return (await payload.find({ collection, limit: 50, depth: 0, ...who })).docs
  } catch {
    return []
  }
}
