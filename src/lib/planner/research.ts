import type { Payload } from 'payload'

import { cleanLine, cleanText } from '../community/text'
import { getSettings } from '../community/settings'
import { aiConfigured, aiGateway, costMicroUsd, SEARCH_MICRO_USD, spentTodayMicroUsd, type AiModel } from './ai'
import { costItem, type Basis, type CostItem } from './costs'
import { loadPriceFinder } from './prices'

/**
 * AI price research. When a plan needs prices for a place that Travel Notes has not checked, the
 * AI searches the web for the typical current range of everyday costs there (meals, coffee, water,
 * snacks, local transport, airport transfer, hotel nights) and for the entry prices of the
 * attractions in the plan.
 *
 * Trust rules, enforced in code:
 * - A price is only saved when its source address is one of the pages the searches returned.
 * - Numbers must be sensible (a high end at most six times the low end, nothing negative).
 * - Every saved price is labelled "found by AI web research", with its source and the date.
 * - Prices in another currency are converted to A$ only at a rate with a cited source.
 * - Results are saved as price checks, reused for every traveller, and refreshed after 90 days.
 *   Editors can correct or retire any of them in the CMS.
 */

export const RESEARCH_MODEL: AiModel = 'claude-haiku-5-5'
export const RESEARCH_MAX_AGE_DAYS = 90
const MAX_SEARCHES = 8
/** Do not research the same place again for this long after a try, even if it found little. */
const RETRY_AFTER_HOURS = 24

export const CORE_ITEMS: { item: CostItem; ask: string; basis: Basis[] }[] = [
  { item: 'breakfast', ask: 'breakfast at a casual café, per person', basis: ['person'] },
  { item: 'lunch', ask: 'lunch at a casual restaurant, per person', basis: ['person'] },
  { item: 'dinner', ask: 'dinner at a mid-range restaurant, per person, without alcohol', basis: ['person'] },
  { item: 'coffee', ask: 'one cappuccino or tea at a café', basis: ['item'] },
  { item: 'snacks', ask: 'snacks for one person for a day (for example fruit, a pastry, an ice cream)', basis: ['person'] },
  { item: 'water', ask: 'bottled drinking water for one person for a day (about 1.5 litres)', basis: ['person'] },
  { item: 'local_transport', ask: 'public transport for one person for a day (a day pass, or two to four single trips)', basis: ['person'] },
  { item: 'airport_transfer', ask: 'the main airport to the city centre, one way: train or bus per person, or a taxi for the group', basis: ['person', 'group'] },
  { item: 'stay_budget', ask: 'a budget hotel or private hostel room, per room per night', basis: ['room_night'] },
  { item: 'stay_mid', ask: 'a mid-range (3 to 4 star) hotel room, per room per night', basis: ['room_night'] },
  { item: 'stay_premium', ask: 'a premium (5 star) hotel room, per room per night', basis: ['room_night'] },
  { item: 'mobile_data', ask: 'a tourist SIM or eSIM with data for about a week', basis: ['item'] },
]

type Found = { item?: string; title?: string; name?: string; low?: number; high?: number; childLow?: number | null; childHigh?: number | null; childMaxAge?: number | null; freeUnderAge?: number | null; free?: boolean; basis?: string; sourceUrl?: string; sourceName?: string; quote?: string }
type Answer = { currency?: string; prices?: Found[]; attractions?: Found[]; exchangeRate?: { perAud?: number; sourceUrl?: string; sourceName?: string } | null }

const SYSTEM = `You research typical current travel prices for Travel Notes, an Australian travel publication. Travellers use your ranges to budget before a trip.

Rules:
- Use the web search tool. Report a price ONLY when a page in your search results states it. Copy that page's exact address into "sourceUrl" and a short quote of what it says into "quote".
- Prefer official sources (transport operators, attractions, tourism boards), then recent, reputable travel cost guides. Prefer pages from the last two years.
- Give the typical range a mid-range traveller pays ("low" to "high"), in the local currency as numbers only.
- If you cannot find a price on a page, leave that item out. Never guess and never calculate a price that no page gives.
- For attractions: use the standard adult ticket; add the child price and ages when the page gives them. If the page says entry is free, set "free": true and low and high to 0.
- If the prices are not in Australian dollars, also find the current exchange rate (how many units of the local currency 1 Australian dollar buys) on a reputable page and report it in "exchangeRate".
- Finish with ONE JSON object in a \`\`\`json code block, and nothing after it.`

function answerFormat(withAttractions: boolean) {
  return `JSON format:
{"currency": "three-letter code of the prices",
 "prices": [{"item": "<item code>", "low": 0, "high": 0, "basis": "person|item|room_night|group", "sourceUrl": "", "sourceName": "", "quote": ""}],${withAttractions ? `
 "attractions": [{"title": "<exactly as given>", "name": "official ticket name", "low": 0, "high": 0, "childLow": null, "childMaxAge": null, "freeUnderAge": null, "free": false, "sourceUrl": "", "sourceName": "", "quote": ""}],` : ''}
 "exchangeRate": {"perAud": 0, "sourceUrl": "", "sourceName": ""} or null}`
}

/** The JSON object at the end of the model's answer. */
export function parseResearch(text: string): Answer | null {
  const block = /```json\s*([\s\S]*?)```/i.exec(text)?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const v = JSON.parse(block) as Answer
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

const norm = (u: string) => u.trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const sane = (low: number | null, high: number | null, allowZero: boolean) => low !== null && high !== null && (allowZero ? low >= 0 : low > 0) && high >= low && (low === 0 ? high === 0 : high <= low * 6) && high < 10_000_000

async function placeLabel(payload: Payload, placeId: string): Promise<{ name: string; label: string } | null> {
  const doc = await payload.findByID({ collection: 'destinations', id: placeId, depth: 1, draft: false, disableErrors: true })
  if (!doc) return null
  const parent = doc.parent && typeof doc.parent === 'object' ? doc.parent.name : null
  return { name: doc.name, label: parent ? `${doc.name}, ${parent}` : doc.name }
}

/** Core items that have no usable price for this place (its own, or its region's or country's), or only an old one. */
export async function missingCoreItems(payload: Payload, placeId: string, now = new Date()): Promise<CostItem[]> {
  const { find } = await loadPriceFinder(payload, [placeId])
  const oldest = now.getTime() - RESEARCH_MAX_AGE_DAYS * 24 * 3600 * 1000
  return CORE_ITEMS.filter(({ item }) => {
    const p = find(item, placeId)
    return !p || (p.method === 'ai_research' && new Date(p.checkedAt).getTime() < oldest)
  }).map((c) => c.item)
}

/** Whether a research run for this place is running now or ran recently. */
export async function researchedRecently(payload: Payload, placeId: string, now = new Date()): Promise<{ running: boolean; recent: boolean }> {
  const since = new Date(now.getTime() - RETRY_AFTER_HOURS * 3600 * 1000).toISOString()
  const found = await payload.find({ collection: 'ai-runs', where: { and: [{ kind: { equals: 'research' } }, { place: { equals: placeId } }, { createdAt: { greater_than_equal: since } }] }, limit: 20, depth: 0, select: { status: true, createdAt: true } })
  const running = found.docs.some((r) => r.status === 'started' && now.getTime() - new Date(r.createdAt).getTime() < 10 * 60_000)
  return { running, recent: found.docs.length > 0 }
}

export type ResearchResult = { saved: number; attractions: Map<string, string>; skipped?: string }

/**
 * Research one place: the everyday costs it is missing, and the entry prices of the given
 * attractions. Returns the attraction titles that now have a price check (title → price check id).
 */
export async function researchPlace(payload: Payload, placeId: string, options: { attractions?: string[]; now?: Date; force?: boolean } = {}): Promise<ResearchResult> {
  const now = options.now ?? new Date()
  const none: ResearchResult = { saved: 0, attractions: new Map() }
  const gateway = aiGateway()
  if (!aiConfigured() || !gateway.research) return { ...none, skipped: 'AI is not set up' }
  const settings = await getSettings()
  if (!settings.planner.aiEnabled) return { ...none, skipped: 'AI is switched off' }
  const place = await placeLabel(payload, placeId)
  if (!place) return { ...none, skipped: 'unknown place' }
  const recent = await researchedRecently(payload, placeId, now)
  if (recent.running) return { ...none, skipped: 'research is running' }
  // Everyday costs are looked up at most once a day per place; new attractions can be added any time.
  const missing = recent.recent && !options.force ? [] : await missingCoreItems(payload, placeId, now)
  const attractions = [...new Set((options.attractions ?? []).map((t) => cleanLine(t, 140)).filter(Boolean))].slice(0, 12)
  if (!missing.length && !attractions.length) return { ...none, skipped: recent.recent ? 'researched recently' : 'nothing to research' }
  // Price research shares the daily AI spending limit.
  const worst = costMicroUsd(RESEARCH_MODEL, 150_000, 4000) + MAX_SEARCHES * SEARCH_MICRO_USD
  if ((await spentTodayMicroUsd(payload, now)) + worst > settings.planner.dailyBudgetUsd * 1_000_000) return { ...none, skipped: 'daily AI limit reached' }

  const run = await payload.create({ collection: 'ai-runs', data: { model: RESEARCH_MODEL, kind: 'research', place: placeId, status: 'started', free: false } })
  try {
    const wanted = CORE_ITEMS.filter((c) => missing.includes(c.item))
    const prompt = [
      `Place: ${place.label}.`,
      `Today is ${now.toISOString().slice(0, 10)}.`,
      wanted.length ? `Find typical current prices for these items (item code: what to price):\n${wanted.map((c) => `- ${c.item}: ${c.ask}`).join('\n')}` : 'No everyday items are needed.',
      attractions.length ? `Also find the current entry price for each of these attractions or activities in ${place.name}:\n${attractions.map((t) => `- ${t}`).join('\n')}` : '',
      answerFormat(attractions.length > 0),
    ].filter(Boolean).join('\n\n')
    const response = await gateway.research({ model: RESEARCH_MODEL, system: SYSTEM, prompt, maxTokens: 4000, maxSearches: MAX_SEARCHES })
    const cost = costMicroUsd(RESEARCH_MODEL, response.inputTokens, response.outputTokens) + response.searches * SEARCH_MICRO_USD
    const answer = parseResearch(response.text)
    const allowed = new Map(response.sources.map((s) => [norm(s.url), s]))
    const sourceOf = (f: Found) => {
      const url = typeof f.sourceUrl === 'string' ? f.sourceUrl.trim() : ''
      if (!/^https:\/\//.test(url) || !allowed.has(norm(url))) return null
      return { url: url.slice(0, 500), name: cleanLine(f.sourceName, 120) || cleanLine(allowed.get(norm(url))!.title, 120) || new URL(url).hostname }
    }
    const currency = typeof answer?.currency === 'string' && /^[A-Z]{3}$/.test(answer.currency) ? answer.currency : null
    let saved = 0
    const found = new Map<string, string>()
    const common = { currency: currency ?? 'AUD', kind: 'estimate' as const, method: 'ai_research' as const, status: 'active' as const, checkedAt: now.toISOString() }

    if (answer && currency) {
      for (const f of answer.prices ?? []) {
        const spec = CORE_ITEMS.find((c) => c.item === f.item)
        if (!spec || !missing.includes(spec.item)) continue
        const low = num(f.low)
        const high = num(f.high) ?? low
        const basis = spec.basis.includes(f.basis as Basis) ? (f.basis as Basis) : spec.basis[0]
        const source = sourceOf(f)
        if (!source || !sane(low, high, false)) continue
        // A new research result replaces the old one for the same item.
        await payload.update({ collection: 'price-checks', where: { and: [{ destination: { equals: placeId } }, { item: { equals: spec.item } }, { method: { equals: 'ai_research' } }, { status: { equals: 'active' } }] }, data: { status: 'retired' } })
        await payload.create({ collection: 'price-checks', data: { ...common, destination: placeId, item: spec.item, name: costItem(spec.item)!.label, amount: low!, amountHigh: high!, basis, sourceName: source.name, sourceUrl: source.url, quote: cleanText(f.quote, 600) } })
        saved++
      }
      for (const f of answer.attractions ?? []) {
        const title = attractions.find((t) => t.toLowerCase() === cleanLine(f.title, 140).toLowerCase())
        const free = f.free === true
        const low = free ? 0 : num(f.low)
        const high = free ? 0 : num(f.high) ?? low
        const source = sourceOf(f)
        if (!title || !source || !sane(low, high, true)) continue
        const childLow = num(f.childLow)
        const name = cleanLine(f.name, 140) || title
        const doc = await payload.create({
          collection: 'price-checks',
          data: {
            ...common, destination: placeId, item: 'attraction', name: name.length >= 3 ? name : title, amount: low!, amountHigh: high!, basis: 'person',
            childAmount: childLow !== null && childLow >= 0 && childLow <= (high ?? 0) ? childLow : null,
            childMaxAge: num(f.childMaxAge) !== null && num(f.childMaxAge)! >= 0 && num(f.childMaxAge)! <= 17 ? Math.round(num(f.childMaxAge)!) : null,
            freeUnderAge: num(f.freeUnderAge) !== null && num(f.freeUnderAge)! >= 0 && num(f.freeUnderAge)! <= 18 ? Math.round(num(f.freeUnderAge)!) : null,
            sourceName: source.name, sourceUrl: source.url, quote: cleanText(f.quote, 600),
          },
        })
        found.set(title.toLowerCase(), doc.id)
        saved++
      }
      // The exchange rate, only with a cited source and a believable value.
      const r = answer.exchangeRate
      const rateSource = r ? sourceOf({ sourceUrl: r.sourceUrl, sourceName: r.sourceName }) : null
      const perAud = num(r?.perAud)
      if (currency !== 'AUD' && rateSource && perAud !== null && perAud > 0.0001 && perAud < 1_000_000) {
        const existing = await payload.find({ collection: 'exchange-rates', where: { currency: { equals: currency } }, limit: 1, depth: 0 })
        const data = { currency, perAud, sourceName: rateSource.name, sourceUrl: rateSource.url, checkedAt: now.toISOString(), method: 'ai_research' as const }
        if (existing.docs[0]) {
          if (existing.docs[0].method === 'ai_research') await payload.update({ collection: 'exchange-rates', id: existing.docs[0].id, data })
        } else {
          await payload.create({ collection: 'exchange-rates', data })
        }
      }
    }
    await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'ok', inputTokens: response.inputTokens, outputTokens: response.outputTokens, searches: response.searches, costMicroUsd: cost, error: answer ? null : 'no JSON answer' } })
    return { saved, attractions: found }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await payload.update({ collection: 'ai-runs', id: run.id, data: { status: 'failed', error: message.slice(0, 500) } })
    console.error('[planner] price research failed', message)
    return { ...none, skipped: 'research failed' }
  }
}

/**
 * Research what a saved plan still needs: everyday costs for each place, and entry prices for the
 * activity options that have none. Found prices are linked to the options straight away.
 */
export async function researchForPlan(payload: Payload, planId: string, now = new Date()): Promise<{ saved: number }> {
  const { readChoices, choicesJson } = await import('./choices')
  const { dayPlaces } = await import('./trip-budget')
  const plan = await payload.findByID({ collection: 'plans', id: planId, depth: 0, disableErrors: true })
  if (!plan) return { saved: 0 }
  const placeIds = (plan.destinations ?? []).map((d) => (typeof d === 'object' ? d.id : d)).slice(0, 4)
  if (!placeIds.length) return { saved: 0 }
  const docs = await payload.find({ collection: 'destinations', where: { id: { in: placeIds } }, limit: placeIds.length, pagination: false, depth: 0, select: { name: true } })
  const places = placeIds.map((id) => docs.docs.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d)).map((d) => ({ id: d.id, name: d.name }))
  const days = (plan.days ?? []).map((d) => ({ title: d.title ?? '', overnight: d.overnight ?? '', date: d.date ?? null }))
  const where = dayPlaces(days, places)
  const choices = readChoices(plan.choices, days.length)
  const titles = new Map<string, Set<string>>()
  choices.days.forEach((day, i) => {
    for (const slot of day.slots) for (const o of slot.options) {
      if (o.priceId || o.researched || !where[i]) continue
      const set = titles.get(where[i].placeId) ?? new Set<string>()
      set.add(o.title)
      titles.set(where[i].placeId, set)
    }
  })
  const results = await Promise.all(places.map((p) => researchPlace(payload, p.id, { attractions: [...(titles.get(p.id) ?? [])], now })))
  const found = new Map<string, string>()
  results.forEach((r) => r.attractions.forEach((v, k) => found.set(k, v)))
  const tried = new Set(places.flatMap((p, i) => (results[i].skipped ? [] : [...(titles.get(p.id) ?? [])].map((t) => t.toLowerCase()))))
  if (tried.size) {
    // Re-read so a choice made while research ran is not lost; only add the prices.
    const latest = await payload.findByID({ collection: 'plans', id: planId, depth: 0, disableErrors: true })
    if (latest) {
      const fresh = readChoices(latest.choices, (latest.days ?? []).length)
      for (const day of fresh.days) for (const slot of day.slots) for (const o of slot.options) {
        const key = o.title.toLowerCase()
        if (!tried.has(key)) continue
        o.researched = true
        if (!o.priceId && found.has(key)) o.priceId = found.get(key)!
      }
      await payload.update({ collection: 'plans', id: planId, data: { choices: choicesJson(fresh) } })
    }
  }
  return { saved: results.reduce((a, r) => a + r.saved, 0) }
}

/** What the page should say while prices are being looked up. */
export async function researchState(payload: Payload, placeIds: string[], now = new Date()): Promise<{ running: boolean; needed: boolean }> {
  let running = false
  let needed = false
  for (const id of placeIds.slice(0, 4)) {
    const r = await researchedRecently(payload, id, now)
    running ||= r.running
    if (!r.recent && (await missingCoreItems(payload, id, now)).length) needed = true
  }
  return { running, needed }
}
