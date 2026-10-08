import type { Plan } from '../../payload-types'
import { LIMITS } from './constants'
import { contributionPath } from './contributions'
import { cms, relId } from './db'
import { isUuid } from './destinations'
import { fail, invalid, type FieldErrors } from './errors'
import { authorsById } from './members'
import { track } from './metrics'
import { limit } from './ratelimit'
import { cleanLine, cleanText } from './text'
import { isLocalDate } from './time'
import type { MemberActor } from './types'

/**
 * Private saved trip plans.
 *
 * A plan belongs to one member and nobody else can read or change it: every function here looks
 * the plan up by id AND owner, so another member's plan answers exactly like one that does not
 * exist. There is no public sharing in this release, so there is no share button.
 */

export type PlanStop = { title: string; place: string; notes: string; saved: { title: string; path: string } | null }
export type PlanDay = { title: string; date: string | null; stops: PlanStop[] }
export type PlanView = {
  id: string; title: string; startDate: string | null; endDate: string | null; notes: string; days: PlanDay[]; updatedAt: string
  /** Where the itinerary was copied from, with credit to its author. */
  source: { title: string; authorName: string; path: string | null; copiedAt: string | null } | null
}

type Raw = Record<string, unknown>
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})

function parsePlan(input: Raw): { data: Pick<Plan, 'title' | 'startDate' | 'endDate' | 'notes' | 'days'>; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const title = cleanLine(input.title, 140)
  if (title.length < 2) errors.title = 'Give your plan a name.'
  const date = (field: string): string | null => {
    const value = typeof input[field] === 'string' && input[field] ? (input[field] as string) : null
    if (value && !isLocalDate(value)) { errors[field] = 'Enter a valid date.'; return null }
    return value
  }
  const startDate = date('startDate')
  const endDate = date('endDate')
  if (startDate && endDate && endDate < startDate) errors.endDate = 'The end date is before the start date.'
  if (list(input.days).length > LIMITS.maxPlanDays) errors.days = `A plan can have up to ${LIMITS.maxPlanDays} days.`
  const days = list(input.days).slice(0, LIMITS.maxPlanDays).map((entry, d) => {
    const day = obj(entry)
    const dayDate = typeof day.date === 'string' && day.date ? day.date : null
    if (dayDate && !isLocalDate(dayDate)) errors[`days.${d}`] = 'Enter a valid date for this day.'
    return {
      title: cleanLine(day.title, 140),
      date: dayDate && isLocalDate(dayDate) ? dayDate : null,
      stops: list(day.stops).slice(0, LIMITS.maxStopsPerDay).map((s) => obj(s)).filter((s) => cleanLine(s.title, 140)).map((s) => ({
        title: cleanLine(s.title, 140),
        place: cleanLine(s.place, 200),
        notes: cleanText(s.notes, 2000),
        savedContribution: isUuid(s.savedContribution) ? s.savedContribution : null,
      })),
    }
  })
  return { data: { title, startDate, endDate, notes: cleanText(input.notes, 5000), days }, errors }
}

async function ownPlan(actor: MemberActor, id: unknown): Promise<Plan> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  if (!isUuid(id)) fail('not_found', 'That plan could not be found.')
  const payload = await cms()
  const found = await payload.find({ collection: 'plans', where: { and: [{ id: { equals: id } }, { owner: { equals: actor.id } }] }, limit: 1, depth: 0 })
  return found.docs[0] ?? fail('not_found', 'That plan could not be found.')
}

/** Only references to posts that are public right now are kept as links. */
async function toView(plan: Plan): Promise<PlanView> {
  const payload = await cms()
  const ids = [...new Set([relId(plan.source?.contribution), ...(plan.days ?? []).flatMap((d) => (d.stops ?? []).map((s) => relId(s.savedContribution)))].filter(isUuid))]
  const posts = ids.length ? await payload.find({ collection: 'contributions', where: { and: [{ id: { in: ids } }, { state: { equals: 'published' } }] }, limit: ids.length, pagination: false, depth: 0, select: { title: true, slug: true, shortId: true, type: true } }) : { docs: [] }
  const links = new Map(posts.docs.map((p) => [p.id, { title: p.title, path: contributionPath(p) }]))
  const sourceId = relId(plan.source?.contribution)
  return {
    id: plan.id, title: plan.title, startDate: plan.startDate ?? null, endDate: plan.endDate ?? null, notes: plan.notes ?? '', updatedAt: plan.updatedAt,
    days: (plan.days ?? []).map((d) => ({ title: d.title ?? '', date: d.date ?? null, stops: (d.stops ?? []).map((s) => ({ title: s.title, place: s.place ?? '', notes: s.notes ?? '', saved: links.get(relId(s.savedContribution) ?? '') ?? null })) })),
    source: plan.source?.title ? { title: plan.source.title, authorName: plan.source.authorName ?? 'a member', path: (sourceId && links.get(sourceId)?.path) || null, copiedAt: plan.source.copiedAt ?? null } : null,
  }
}

export async function listPlans(actor: MemberActor): Promise<{ id: string; title: string; startDate: string | null; days: number; updatedAt: string }[]> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const found = await payload.find({ collection: 'plans', where: { owner: { equals: actor.id } }, sort: '-updatedAt', limit: LIMITS.maxPlans, pagination: false, depth: 0 })
  return found.docs.map((p) => ({ id: p.id, title: p.title, startDate: p.startDate ?? null, days: p.days?.length ?? 0, updatedAt: p.updatedAt }))
}

export const getPlan = async (actor: MemberActor, id: unknown): Promise<PlanView> => toView(await ownPlan(actor, id))

/** The raw stored days of a plan, including saved-post ids, for the editor. Owner only. */
export async function getPlanForEdit(actor: MemberActor, id: unknown): Promise<{ view: PlanView; days: { title: string; date: string | null; stops: { title: string; place: string; notes: string; savedContribution: string | null }[] }[] }> {
  const plan = await ownPlan(actor, id)
  return {
    view: await toView(plan),
    days: (plan.days ?? []).map((d) => ({ title: d.title ?? '', date: d.date ?? null, stops: (d.stops ?? []).map((s) => ({ title: s.title, place: s.place ?? '', notes: s.notes ?? '', savedContribution: relId(s.savedContribution) })) })),
  }
}

async function assertRoom(actor: MemberActor): Promise<void> {
  const payload = await cms()
  const count = await payload.count({ collection: 'plans', where: { owner: { equals: actor.id } } })
  if (count.totalDocs >= LIMITS.maxPlans) fail('conflict', `You can keep up to ${LIMITS.maxPlans} plans. Delete one you no longer need.`)
}

export async function createPlan(actor: MemberActor, input: Raw): Promise<{ id: string }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  await limit('engagement', actor.id)
  const { data, errors } = parsePlan(input)
  if (Object.keys(errors).length) invalid(errors)
  await assertRoom(actor)
  const payload = await cms()
  const plan = await payload.create({ collection: 'plans', data: { ...data, owner: actor.id } })
  await track('plan_created')
  return { id: plan.id }
}

export async function updatePlan(actor: MemberActor, id: unknown, input: Raw): Promise<{ id: string }> {
  const plan = await ownPlan(actor, id)
  await limit('engagement', actor.id)
  const { data, errors } = parsePlan(input)
  if (Object.keys(errors).length) invalid(errors)
  const payload = await cms()
  await payload.update({ collection: 'plans', id: plan.id, data })
  return { id: plan.id }
}

export async function deletePlan(actor: MemberActor, id: unknown): Promise<{ ok: true }> {
  const plan = await ownPlan(actor, id)
  const payload = await cms()
  await payload.delete({ collection: 'plans', id: plan.id })
  return { ok: true }
}

/**
 * Copy the itinerary of a published trip report into a new private plan.
 * The plan is the member's own snapshot: changing it never touches the original report, and later
 * changes to the report do not change the plan. The source and its author are credited on the plan.
 */
export async function copyItinerary(actor: MemberActor, contributionId: unknown): Promise<{ id: string }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  await limit('engagement', actor.id)
  if (!isUuid(contributionId)) fail('not_found', 'That trip report could not be found.')
  const payload = await cms()
  const report = await payload.findByID({ collection: 'contributions', id: contributionId as string, depth: 0, disableErrors: true })
  if (!report || report.type !== 'trip' || report.state !== 'published') return fail('not_found', 'That trip report could not be found.')
  const days = (report.itineraryDays ?? []).map((d) => ({
    title: d.title ?? '', date: null,
    stops: (d.stops ?? []).map((s) => ({ title: s.title, place: s.place ?? '', notes: [s.timeNote, s.description].filter(Boolean).join('\n\n'), savedContribution: null })),
  }))
  if (!days.length) fail('conflict', 'This trip report has no itinerary to copy.')
  await assertRoom(actor)
  const author = (await authorsById([relId(report.author)])).get(relId(report.author) ?? '')
  const plan = await payload.create({
    collection: 'plans',
    data: {
      owner: actor.id,
      title: cleanLine(`My plan from: ${report.title}`, 140),
      days,
      source: { contribution: report.id, title: report.title, authorName: author?.displayName ?? 'a member', copiedAt: new Date().toISOString() },
    },
  })
  await track('itinerary_copied')
  return { id: plan.id }
}

/** Add an approved post (an activity, a trip report, a question) to a plan as a stop on its last day. */
export async function addPostToPlan(actor: MemberActor, input: { planId: unknown; contributionId: unknown }): Promise<{ id: string }> {
  const plan = await ownPlan(actor, input.planId)
  await limit('engagement', actor.id)
  if (!isUuid(input.contributionId)) fail('not_found', 'That post could not be found.')
  const payload = await cms()
  const post = await payload.findByID({ collection: 'contributions', id: input.contributionId as string, depth: 0, disableErrors: true })
  if (!post || post.state !== 'published') return fail('not_found', 'That post could not be found.')
  const days = (plan.days ?? []).map((d) => ({ title: d.title ?? '', date: d.date ?? null, stops: (d.stops ?? []).map((s) => ({ title: s.title, place: s.place ?? '', notes: s.notes ?? '', savedContribution: relId(s.savedContribution) })) }))
  if (!days.length) days.push({ title: 'Saved ideas', date: null, stops: [] })
  const last = days[days.length - 1]
  if (last.stops.some((s) => s.savedContribution === post.id)) return { id: plan.id }
  if (last.stops.length >= LIMITS.maxStopsPerDay) fail('conflict', 'The last day of that plan is full. Add a new day first.')
  last.stops.push({ title: cleanLine(post.title, 140), place: post.type === 'activity' ? post.activity?.venueName ?? '' : '', notes: '', savedContribution: post.id })
  await payload.update({ collection: 'plans', id: plan.id, data: { days } })
  return { id: plan.id }
}
