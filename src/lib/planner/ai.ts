import type { Payload } from 'payload'

import type { Plan } from '../../payload-types'
import { cms, relId, relIds } from '../community/db'
import { fail, isCommunityError } from '../community/errors'
import { requireActive } from '../community/members'
import { ownPlanDoc, storedDays, type StoredDay, type StoredStop } from '../community/plans'
import { getPublished } from '../community/queries'
import { limit } from '../community/ratelimit'
import { canViewCommunity, getSettings, type Settings } from '../community/settings'
import { cleanLine, cleanText } from '../community/text'
import type { MemberActor } from '../community/types'
import { LIMITS } from '../community/constants'
import { MONTH_NAMES } from '../content/destinationFacts'
import { loadDestinationPage } from '../content/destinations'
import { evenSplit, tripMonths, type PlannerInput } from './input'
import { loadPlanner, type PlannerResult } from './load'

/**
 * The AI Trip Planner: Claude fills in the days of a member's saved plan.
 *
 * Trust comes first. The model is given only what Travel Notes has published about the places in
 * the plan (editor-rated months, sourced facts, travel updates, guides, trip reports, activities)
 * and must point every suggestion that comes from that content to its page. Anything else it
 * suggests is saved as an "AI idea", shown with a clear "not checked" label. It is told never to
 * state prices, opening hours or entry rules.
 *
 * Cost control: each request is logged with its token use and an estimated cost from the published
 * prices. Requests stop for the day (Sydney time) when the day's estimated spend reaches the
 * administrator's limit. Each member gets a number of free AI plans; after that a plan is paid for
 * once (which also unlocks printing it).
 */

/**
 * US dollars per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing
 * (checked 13 October 2026, prompts up to 100,000 tokens). Used only to ESTIMATE spend for the
 * daily limit; the bill from Anthropic is the real figure. Update if the prices change.
 */
export const MODEL_PRICES = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
} as const
export type AiModel = keyof typeof MODEL_PRICES

/** AI plans cover up to this many days, so one answer fits well inside the server's time limit. */
export const AI_MAX_DAYS = 14
const MAX_OUTPUT_TOKENS = 5000
/** Stops the AI may add to one day, leaving room for the member's own. */
const AI_STOPS_PER_DAY = 4
const REQUEST_TIMEOUT_MS = 55_000

export const costMicroUsd = (model: AiModel, inputTokens: number, outputTokens: number): number =>
  Math.round(inputTokens * MODEL_PRICES[model].input + outputTokens * MODEL_PRICES[model].output)

// ---------------------------------------------------------------------------------------------
// The model call, behind a small interface so tests can replace it.

export type AiRequest = { model: AiModel; system: string; prompt: string; schema: Record<string, unknown>; maxTokens: number }
export type AiResponse = { text: string; inputTokens: number; outputTokens: number; stopReason: string }
export type AiGateway = { generate(request: AiRequest): Promise<AiResponse> }

let override: AiGateway | null = null
/** Tests only: use a fake model. Pass null to go back to the real one. */
export function setAiGatewayForTests(gateway: AiGateway | null): void {
  override = gateway
}
export const aiConfigured = (): boolean => Boolean(override || process.env.ANTHROPIC_API_KEY)

const anthropic: AiGateway = {
  async generate(request) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set.')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        output_config: { format: { type: 'json_schema', schema: request.schema } },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as {
      content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string; error?: { message?: string }
    } | null
    if (!response.ok || !body) throw new Error(`Anthropic API error ${response.status}: ${body?.error?.message ?? 'no details'}`)
    return {
      text: (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      stopReason: body.stop_reason ?? '',
    }
  },
}
const gateway = (): AiGateway => override ?? anthropic

// ---------------------------------------------------------------------------------------------
// Allowance, spending and status.

/** Midnight in Sydney at the start of the current day, as a UTC instant. */
export function sydneyDayStart(now: Date = new Date()): Date {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const guess = new Date(`${date}T00:00:00Z`)
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', timeZoneName: 'shortOffset' }).formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+10'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offset)
  const minutes = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 600
  return new Date(guess.getTime() - minutes * 60_000)
}

export async function spentTodayMicroUsd(payload: Payload, now: Date = new Date()): Promise<number> {
  const found = await payload.find({ collection: 'ai-runs', where: { createdAt: { greater_than_equal: sydneyDayStart(now).toISOString() } }, limit: 0, pagination: false, depth: 0, select: { costMicroUsd: true, status: true, model: true } })
  // A request still running counts at its largest possible cost, so two at once cannot overshoot.
  return found.docs.reduce((sum, r) => sum + (r.status === 'started' ? costMicroUsd((r.model as AiModel) in MODEL_PRICES ? (r.model as AiModel) : 'claude-sonnet-5-5', 40_000, MAX_OUTPUT_TOKENS) : r.costMicroUsd ?? 0), 0)
}

async function paidPaymentsFor(payload: Payload, planId: string): Promise<{ id: string; used: boolean }[]> {
  const paid = await payload.find({ collection: 'listing-payments', where: { and: [{ purpose: { equals: 'ai_plan' } }, { plan: { equals: planId } }, { status: { equals: 'paid' } }] }, limit: 20, depth: 0 })
  if (!paid.docs.length) return []
  const runs = await payload.find({ collection: 'ai-runs', where: { and: [{ payment: { in: paid.docs.map((p) => p.id) } }, { status: { equals: 'ok' } }] }, limit: 50, depth: 0, select: { payment: true } })
  const used = new Set(runs.docs.map((r) => relId(r.payment)))
  return paid.docs.map((p) => ({ id: p.id, used: used.has(p.id) }))
}

export async function freePlansUsed(payload: Payload, memberId: string): Promise<number> {
  return (await payload.count({ collection: 'ai-runs', where: { and: [{ member: { equals: memberId } }, { free: { equals: true } }, { status: { equals: 'ok' } }] } })).totalDocs
}

export type AiStatus = {
  /** Switched on, a key is set and today's limit is not reached. */
  available: boolean
  /** Why it is not available, in words for the member. */
  reason: string | null
  freeLeft: number
  /** An unused payment for this plan. */
  paidCredit: boolean
  priceMinor: number
  /** Whether payments can be taken right now. */
  canPay: boolean
  unlocked: boolean
  generated: boolean
  tooLong: boolean
  hasPlaces: boolean
}

export async function aiStatus(actor: MemberActor, planId: unknown, options: { settings?: Settings; canPay?: boolean; now?: Date } = {}): Promise<AiStatus> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  const payload = await cms()
  const settings = options.settings ?? (await getSettings())
  const [freeUsed, payments, spent] = await Promise.all([freePlansUsed(payload, member.id), paidPaymentsFor(payload, plan.id), spentTodayMicroUsd(payload, options.now)])
  const overBudget = spent >= settings.planner.dailyBudgetUsd * 1_000_000
  const reason = !settings.planner.aiEnabled || !aiConfigured()
    ? 'AI plans are not switched on yet.'
    : overBudget
      ? 'AI plans are very popular today and have paused until midnight (Sydney time). Please try again tomorrow.'
      : null
  return {
    available: reason === null,
    reason,
    freeLeft: Math.max(0, settings.planner.freePlans - freeUsed),
    paidCredit: payments.some((p) => !p.used),
    priceMinor: settings.planner.priceMinor,
    canPay: Boolean(options.canPay),
    unlocked: Boolean(plan.ai?.unlocked),
    generated: Boolean(plan.ai?.generatedAt),
    tooLong: (plan.days?.length ?? 0) > AI_MAX_DAYS,
    hasPlaces: relIds(plan.destinations).length > 0,
  }
}

// ---------------------------------------------------------------------------------------------
// Context, prompt and answer.

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'days', 'checks'],
  properties: {
    summary: { type: 'string', description: 'Two or three plain sentences describing the shape of the trip. No prices, hours or promises.' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'title', 'stops'],
        properties: {
          day: { type: 'integer', description: 'Day number, starting at 1.' },
          title: { type: 'string', description: 'A short title for the day, under 60 characters.' },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'place', 'notes', 'source'],
              properties: {
                title: { type: 'string', description: 'What to do, under 80 characters.' },
                place: { type: 'string', description: 'Area or place name, under 80 characters, or empty.' },
                notes: { type: 'string', description: 'One practical sentence, under 30 words. No prices, opening hours or entry rules.' },
                source: { type: 'string', description: 'The exact path of the Travel Notes page in the context that supports this stop, or an empty string when it is your own suggestion.' },
              },
            },
          },
        },
      },
    },
    checks: { type: 'array', items: { type: 'string' }, description: 'Up to five short things to confirm with an official source before travelling, based only on the context.' },
  },
} as const

const SYSTEM = `You are the trip planner for Travel Notes, an Australian travel publication. You fill in a traveller's day-by-day plan.

Rules you must follow:
- Write in clear Australian English for a general reader.
- Use the CONTEXT first. When a stop comes from a page in the context, set "source" to that page's exact path.
- You may add other well-known sights, areas or activities when the context has too few. Set "source" to "" for those. Only suggest places you are confident exist; prefer areas and landmarks over small businesses. Never invent restaurants, hotels or tour companies.
- Never state prices, fees, opening hours, timetables, phone numbers, ticket or booking rules, visa or entry rules. Never say a place is open, safe, free, cheap or guaranteed.
- Never claim personal experience or that anyone from Travel Notes visited.
- Give exactly one entry per day, numbered from 1, in order. Respect each day's place.
- Match the pace: relaxed = 2 stops a day, balanced = 3, full = 4. On a day that moves to a new place, plan fewer stops and mention the journey.
- Keep notes to one short practical sentence each.`

type Context = { plan: { days: { day: number; place: string; date: string | null }[]; party: string | null; pace: string | null; months: string[] }; places: unknown[]; checks: unknown[]; updates: unknown[] }

function buildContext(result: PlannerResult, days: StoredDay[], plan: Plan, trips: Map<string, { path: string; title: string; days: { title: string; stops: string[] }[] }[]>): { context: Context; paths: Set<string> } {
  const paths = new Set<string>()
  const add = (p: string) => (paths.add(p), p)
  const months = tripMonths({ start: plan.startDate ?? null, month: null, days: days.length }).map((m) => MONTH_NAMES[m])
  const context: Context = {
    plan: { days: days.map((d, i) => ({ day: i + 1, place: d.title, date: d.date })), party: plan.party ?? null, pace: plan.pace ?? 'balanced', months },
    places: result.places.map((p) => ({
      name: p.label,
      path: add(`/destinations/${p.path}`),
      summary: p.summary || undefined,
      goodFor: p.goodFor || undefined,
      timeNeeded: p.timeNeeded || undefined,
      whenToGo: p.whenToGo || undefined,
      travelMonthsRating: p.timing ?? undefined,
      guides: p.guides.map((g) => ({ title: g.title, path: add(`/stories/${g.slug}`), summary: g.excerpt, itinerary: g.days?.map((d) => ({ title: d.title, stops: d.stops.map((s) => s.name) })) })),
      tripReports: (trips.get(p.id) ?? []).map((t) => ({ ...t, path: add(t.path) })),
      questions: p.questions.map((q) => ({ title: q.title, path: add(q.path) })),
      activitiesOnTheseDates: p.activities.map((a) => ({ title: a.title, path: add(a.path), venue: a.activity?.venueName || undefined, starts: a.activity?.startLocal ?? undefined })),
    })),
    checks: result.countries.map((c) => ({ country: c.name, facts: c.checks.map((f) => ({ label: f.label, value: f.value, source: f.source?.name })) })),
    updates: result.updates.map((u) => ({ title: u.title, summary: u.summary, path: add(u.path) })),
  }
  return { context, paths }
}

type Answer = { summary: string; days: { day: number; title: string; stops: { title: string; place: string; notes: string; source: string }[] }[]; checks: string[] }

function parseAnswer(text: string): Answer {
  const raw = JSON.parse(text) as Answer
  if (!raw || !Array.isArray(raw.days)) throw new Error('The answer had no days.')
  return raw
}

/** Merge the answer into the plan: the member's own stops stay; earlier AI stops are replaced. */
export function mergeAnswer(days: StoredDay[], answer: Answer, allowedPaths: Set<string>): StoredDay[] {
  return days.map((day, i) => {
    const own = day.stops.filter((s) => s.origin === 'own')
    const fromAi = (answer.days.find((d) => d.day === i + 1)?.stops ?? []).slice(0, AI_STOPS_PER_DAY)
    const room = Math.max(0, LIMITS.maxStopsPerDay - own.length)
    const aiStops: StoredStop[] = fromAi
      .map((s) => {
        const path = typeof s.source === 'string' ? s.source.trim() : ''
        const checked = allowedPaths.has(path)
        return {
          title: cleanLine(s.title, 140),
          place: cleanLine(s.place, 200),
          notes: cleanText(s.notes, 600),
          savedContribution: null,
          origin: checked ? ('travel_notes' as const) : ('ai_idea' as const),
          sourcePath: checked ? path : null,
        }
      })
      .filter((s) => s.title.length > 0)
      .slice(0, room)
    return { ...day, stops: [...aiStops, ...own] }
  })
}

// ---------------------------------------------------------------------------------------------
// The request.

export async function generateAiPlan(actor: MemberActor, planId: unknown, options: { now?: Date } = {}): Promise<{ id: string; stops: number; free: boolean }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  const payload = await cms()
  const settings = await getSettings()
  if (!settings.planner.aiEnabled || !aiConfigured()) fail('closed', 'AI plans are not switched on yet.')
  const days = storedDays(plan)
  const placeIds = relIds(plan.destinations)
  if (!placeIds.length) fail('validation', 'Start this plan from the Trip Planner, so the AI knows where you are going.')
  if (!days.length) fail('validation', 'Add at least one day to the plan first.')
  if (days.length > AI_MAX_DAYS) fail('validation', `AI plans cover up to ${AI_MAX_DAYS} days. Remove some days, or split the trip into two plans.`)

  // One request at a time per plan.
  const running = await payload.count({ collection: 'ai-runs', where: { and: [{ plan: { equals: plan.id } }, { status: { equals: 'started' } }, { createdAt: { greater_than: new Date(Date.now() - 2 * 60_000).toISOString() } }] } })
  if (running.totalDocs) fail('conflict', 'Your plan is already being written. Please wait a minute and refresh the page.')

  const model = settings.planner.model
  if ((await spentTodayMicroUsd(payload, options.now)) + costMicroUsd(model, 40_000, MAX_OUTPUT_TOKENS) > settings.planner.dailyBudgetUsd * 1_000_000) {
    fail('closed', 'AI plans are very popular today and have paused until midnight (Sydney time). Please try again tomorrow.')
  }

  // Use a paid credit for this plan first, then the free allowance.
  const credit = (await paidPaymentsFor(payload, plan.id)).find((p) => !p.used)
  const free = !credit && (await freePlansUsed(payload, member.id)) < settings.planner.freePlans
  if (!credit && !free) fail('forbidden', 'You have used your free AI plan. Pay for this plan to fill in its days with AI.')
  await limit('ai_plan', member.id)

  const run = await payload.create({ collection: 'ai-runs', data: { member: member.id, plan: plan.id, status: 'started', model, free, payment: credit?.id } })
  let response: AiResponse | null = null

  try {
    const input: PlannerInput = { placeIds, start: plan.startDate ?? null, month: null, days: days.length, split: evenSplit(Math.max(days.length, placeIds.length), placeIds.length), party: null, pace: 'balanced' }
    const community = await canViewCommunity(null)
    const result = await loadPlanner(payload, input, { pageFor: (doc) => loadDestinationPage(payload, doc), months: tripMonths(input), community, now: options.now })
    const trips = new Map<string, { path: string; title: string; days: { title: string; stops: string[] }[] }[]>()
    for (const place of result.places) {
      const details = await Promise.all(place.trips.slice(0, 2).map((t) => getPublished(t.shortId).catch(() => null)))
      trips.set(place.id, details.filter((d) => d?.tripDetail).map((d) => ({ path: d!.path, title: d!.title, days: d!.tripDetail!.days.map((x) => ({ title: x.title, stops: x.stops.map((s) => s.title) })) })))
    }
    const { context, paths } = buildContext(result, days, plan, trips)
    response = await gateway().generate({
      model,
      system: SYSTEM,
      prompt: `Fill in this trip. Reply in the required JSON format.\n\nCONTEXT (published by Travel Notes):\n${JSON.stringify(context)}`,
      schema: SCHEMA as unknown as Record<string, unknown>,
      maxTokens: MAX_OUTPUT_TOKENS,
    })
    const cost = costMicroUsd(model, response.inputTokens, response.outputTokens)
    if (response.stopReason !== 'end_turn') {
      await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'failed', inputTokens: response.inputTokens, outputTokens: response.outputTokens, costMicroUsd: cost, error: `stop reason: ${response.stopReason}` } })
      return fail('unavailable', 'The AI could not finish this plan. Nothing was used from your allowance. Please try again, or shorten the trip.')
    }
    const answer = parseAnswer(response.text)
    const merged = mergeAnswer(days, answer, paths)
    const summary = cleanText([answer.summary, ...(answer.checks ?? []).slice(0, 5).map((c) => `• ${cleanLine(c, 200)}`)].filter(Boolean).join('\n'), 2000)
    await payload.update({
      collection: 'plans',
      id: plan.id,
      data: {
        days: merged.map((d) => ({ title: d.title, date: d.date, stops: d.stops.map((s) => ({ title: s.title, place: s.place, notes: s.notes, savedContribution: s.savedContribution, origin: s.origin, sourcePath: s.sourcePath })) })),
        ai: { generatedAt: new Date().toISOString(), model, summary, unlocked: Boolean(plan.ai?.unlocked) || Boolean(credit) },
      },
    })
    await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'ok', inputTokens: response.inputTokens, outputTokens: response.outputTokens, costMicroUsd: cost } })
    return { id: plan.id, stops: merged.reduce((n, d) => n + d.stops.filter((s) => s.origin !== 'own').length, 0), free }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // A run already marked failed above keeps its record; anything else is recorded here.
    const current = await payload.findByID({ collection: 'ai-runs', id: run.id, depth: 0, disableErrors: true })
    if (current?.status === 'started') {
      const usage = response ? { inputTokens: response.inputTokens, outputTokens: response.outputTokens, costMicroUsd: costMicroUsd(model, response.inputTokens, response.outputTokens) } : {}
      await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'failed', error: message.slice(0, 500), ...usage } })
    }
    if (isCommunityError(error)) throw error
    console.error('[planner] AI plan failed', message)
    return fail('unavailable', 'The AI could not write your plan just now. Nothing was used from your allowance. Please try again in a few minutes.')
  }
}
