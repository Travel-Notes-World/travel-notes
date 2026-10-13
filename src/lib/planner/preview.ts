import { createHash } from 'node:crypto'

import type { Payload } from 'payload'

import { cms } from '../community/db'
import { fail, isCommunityError } from '../community/errors'
import { ownPlanDoc, storedDays, type StoredDay } from '../community/plans'
import { hashSubject } from '../community/ratelimit'
import { getSettings } from '../community/settings'
import type { MemberActor } from '../community/types'
import { AI_MAX_DAYS, aiConfigured, callModel, contextFor, costMicroUsd, mergeAnswer, parseAnswer, spentTodayMicroUsd, summaryText, type AiResponse } from './ai'
import { planDays, plannerHref, type PlannerInput } from './input'

/**
 * The instant free itinerary on the Trip Planner page: as soon as a visitor presses "Plan my trip",
 * the AI writes a short day-by-day plan (2 ideas a day) with no account needed.
 *
 * Limits: one new itinerary per visitor (network address, stored only as a one-way code) per 24
 * hours, plus the site-wide daily AI spending limit. Opening the same plan again shows the saved
 * answer instead of paying for it twice; it is kept for 7 days. "Save to my trips" copies it into
 * the member's account.
 */

export type PreviewStop = { title: string; place: string; notes: string; origin: 'travel_notes' | 'ai_idea'; sourcePath: string | null }
export type PreviewDay = { title: string; date: string | null; stops: PreviewStop[] }
export type Preview = { summary: string; days: PreviewDay[] }
export type PreviewResult = { status: 'ready'; preview: Preview } | { status: 'limited' } | { status: 'off' }

const WORST_INPUT_TOKENS = 40_000
const WORST_OUTPUT_TOKENS = 6000

const visitorOf = (ip: string) => hashSubject(`preview:${ip}`)
const keyOf = (visitor: string, input: PlannerInput) => createHash('sha256').update(`${visitor}|${plannerHref(input)}`).digest('hex')

const toPreview = (doc: { summary?: string | null; days?: unknown }): Preview => ({ summary: doc.summary ?? '', days: Array.isArray(doc.days) ? (doc.days as PreviewDay[]) : [] })

export async function findPreview(ip: string | null, input: PlannerInput): Promise<Preview | null> {
  if (!ip || !input.placeIds.length) return null
  const payload = await cms()
  const found = await payload.find({ collection: 'ai-previews', where: { key: { equals: keyOf(visitorOf(ip), input) } }, limit: 1, depth: 0, overrideAccess: true })
  return found.docs[0] ? toPreview(found.docs[0]) : null
}

/** Whether instant itineraries can be offered for this trip at all. */
export async function previewsOpen(input: PlannerInput): Promise<boolean> {
  const settings = await getSettings()
  return settings.planner.aiEnabled && aiConfigured() && input.purpose !== 'visa' && input.placeIds.length > 0 && input.days <= AI_MAX_DAYS
}

async function placeNames(payload: Payload, ids: string[]): Promise<Map<string, string>> {
  const found = await payload.find({ collection: 'destinations', where: { id: { in: ids } }, limit: ids.length, pagination: false, depth: 0, draft: false, overrideAccess: false, select: { name: true } })
  return new Map(found.docs.map((d) => [d.id, d.name]))
}

export async function writePreview(ip: string | null, input: PlannerInput, options: { now?: Date } = {}): Promise<PreviewResult> {
  if (!(await previewsOpen(input))) return { status: 'off' }
  if (!ip) return fail('forbidden', 'We could not start your itinerary. Please try again, or create a free account.')
  const payload = await cms()
  const visitor = visitorOf(ip)
  const key = keyOf(visitor, input)
  const existing = await payload.find({ collection: 'ai-previews', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
  if (existing.docs[0]) return { status: 'ready', preview: toPreview(existing.docs[0]) }

  const since = new Date((options.now ?? new Date()).getTime() - 24 * 3_600_000).toISOString()
  const recent = await payload.count({ collection: 'ai-previews', where: { and: [{ visitor: { equals: visitor } }, { createdAt: { greater_than: since } }] }, overrideAccess: true })
  if (recent.totalDocs >= 1) return { status: 'limited' }

  const settings = await getSettings()
  const model = settings.planner.model
  if ((await spentTodayMicroUsd(payload, options.now)) + costMicroUsd(model, WORST_INPUT_TOKENS, WORST_OUTPUT_TOKENS) > settings.planner.dailyBudgetUsd * 1_000_000) {
    fail('closed', 'Instant itineraries are very popular today and have paused until midnight (Sydney time). You can still save your plan and add your own stops.')
  }

  const names = await placeNames(payload, input.placeIds)
  const placeIds = input.placeIds.filter((id) => names.has(id))
  if (!placeIds.length) return { status: 'off' }
  const split = placeIds.length === input.placeIds.length ? input.split : placeIds.map(() => Math.max(1, Math.floor(input.days / placeIds.length)))
  const days: StoredDay[] = planDays({ start: input.start, split }).map((d) => ({ title: names.get(placeIds[d.placeIndex]) ?? '', date: d.date, overnight: '', overnightConfirmed: false, transport: '', stops: [] }))

  const run = await payload.create({ collection: 'ai-runs', data: { status: 'started', model, kind: 'brief', free: true } })
  let response: AiResponse | null = null
  try {
    const plan = { purpose: input.purpose, startDate: input.start, party: input.party, pace: input.pace, details: {}, visa: {} }
    const { context, paths } = await contextFor(payload, { placeIds, days, plan, now: options.now })
    response = await callModel({ model, kind: 'brief', purpose: input.purpose, context })
    const cost = costMicroUsd(model, response.inputTokens, response.outputTokens)
    if (response.stopReason !== 'end_turn') throw new Error(`stop reason: ${response.stopReason}`)
    const answer = parseAnswer(response.text)
    const merged = mergeAnswer(days, answer, paths, 'brief')
    const preview: Preview = {
      summary: summaryText(answer),
      days: merged.map((d) => ({ title: d.title, date: d.date, stops: d.stops.map((s) => ({ title: s.title, place: s.place, notes: s.notes, origin: s.origin === 'travel_notes' ? 'travel_notes' : 'ai_idea', sourcePath: s.sourcePath })) })),
    }
    await payload.create({ collection: 'ai-previews', overrideAccess: true, data: { key, visitor, query: plannerHref(input), summary: preview.summary, days: preview.days, paths: [...paths] } })
    await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'ok', inputTokens: response.inputTokens, outputTokens: response.outputTokens, costMicroUsd: cost } })
    return { status: 'ready', preview }
  } catch (error) {
    const usage = response ? { inputTokens: response.inputTokens, outputTokens: response.outputTokens, costMicroUsd: costMicroUsd(model, response.inputTokens, response.outputTokens) } : {}
    await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'failed', error: (error instanceof Error ? error.message : String(error)).slice(0, 500), ...usage } })
    if (isCommunityError(error)) throw error
    console.error('[planner] instant itinerary failed', error instanceof Error ? error.message : error)
    return fail('unavailable', 'The AI could not write your itinerary just now. Please try again in a minute.')
  }
}

/**
 * Copy a visitor's instant itinerary into the plan they just saved. Days are matched in order;
 * the plan is marked as having its free brief plan written.
 */
export async function attachPreview(actor: MemberActor, planId: string, ip: string | null, input: PlannerInput): Promise<boolean> {
  const preview = await findPreview(ip, input)
  if (!preview) return false
  const plan = await ownPlanDoc(actor, planId)
  const days = storedDays(plan).map((d, i) => {
    const p = preview.days[i]
    return p ? { ...d, stops: p.stops.map((s) => ({ title: s.title, place: s.place, notes: s.notes, savedContribution: null, origin: s.origin, sourcePath: s.sourcePath, timeOfDay: null })) } : d
  })
  const payload = await cms()
  await payload.update({
    collection: 'plans',
    id: plan.id,
    data: {
      days: days.map((d) => ({ title: d.title, date: d.date, overnight: d.overnight, overnightConfirmed: d.overnightConfirmed, transport: d.transport, stops: d.stops })),
      ai: { generatedAt: new Date().toISOString(), model: 'instant preview', summary: preview.summary, unlocked: false, tier: 'brief', revisionsUsed: 0, options: [] },
    },
  })
  return true
}
