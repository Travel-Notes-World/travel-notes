/**
 * Single-form Trip Planner, end to end against a test database, with a fake AI and a fake Stripe:
 * generation and its failures, the free allowance, what an unpaid visitor can load, changes,
 * checkout without double charges, server-side payment confirmation, and returning purchasers.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { newMember, payload, setup, type Any } from './helpers'

let S: Any, F: Any, CO: Any, L: Any, AI: Any, STRIPE: Any, CALC: Any

const TEST_ABN = '51 824 753 556'
const TODAY = '2026-11-05'
const sessions = new Map<string, Any>()
let counter = 0
let created = 0
const fakeStripe = {
  async createCheckout(input: Any) {
    created++
    const id = `cs_test_trip_${++counter}`
    const s = { id, url: `https://checkout.example/${id}`, paymentStatus: 'unpaid', paymentIntentId: null, customerEmail: input.customerEmail, metadata: input.metadata }
    sessions.set(id, s)
    return s
  },
  async getCheckout(id: string) { return sessions.get(id) },
  async refund() {},
  verifyWebhook() { throw new Error('not used') },
}

/**
 * A fake model: a valid itinerary for the requested days (one base, or Sydney then Melbourne for
 * trips of 14 days or more), three activities on each day, and sourced prices for every key asked,
 * except the keys listed in `priceGaps`.
 */
const SOURCE = 'https://www.example.test/prices'
const OFFICIAL = 'https://www.example.test/official'
let itineraryMode: 'ok' | 'bad' | 'throw' = 'ok'
let priceMode: 'ok' | 'none' | 'throw' = 'ok'
let routeCalls = 0
let dayCalls: [number, number][] = []
let priceCalls = 0
let allowanceCalls = 0
/** Keys the first price search does not find; `allowanceFinds` are found by the second, cost-data search. */
let priceGaps = new Set<string>()
let allowanceFinds = new Set<string>()
/** Days whose first answer has only two activities (the planner should ask again). */
let thinOnce = new Set<number>()
const basesFor = (days: number) => days >= 14
  ? [{ name: 'Sydney', region: 'NSW', nights: Math.floor((days - 1) / 2), fromDay: 1, toDay: Math.floor((days - 1) / 2) + 1, reason: 'Harbour and beaches.', airport: 'SYD' },
     { name: 'Melbourne', region: 'VIC', nights: days - 1 - Math.floor((days - 1) / 2), fromDay: Math.floor((days - 1) / 2) + 1, toDay: days, reason: 'Laneways and food.', airport: 'MEL' }]
  : [{ name: 'Sydney', region: 'NSW', nights: days - 1, fromDay: 1, toDay: days, reason: 'Harbour, beaches and easy transport.', airport: 'SYD' }]
const baseOn = (days: number, day: number) => { const b = basesFor(days); return b.length > 1 && day > b[0].nights ? b[1].name : 'Sydney' }
const itemsFor = (day: number, base: string, thin: boolean) => [
  { slot: 'morning', start: '09:00', kind: 'activity', title: `Secret garden ${day}`, place: 'Royal Botanic Garden Sydney', area: `${base}`, minutes: 90, travel: { mode: 'none', minutes: 0 }, reason: 'Easy start.', desc: 'Shady paths and harbour views.', costKey: '', note: '' },
  { slot: 'afternoon', start: '13:30', kind: 'activity', title: `Opera House tour ${day}`, place: 'Sydney Opera House', area: `${base}`, minutes: 60, travel: { mode: 'walk', minutes: 15 }, reason: 'Iconic.', desc: 'A guided walk through the theatres.', costKey: 'ticket-opera-tour', note: '' },
  ...(thin ? [] : [{ slot: 'afternoon', start: '15:30', kind: 'activity', title: `Art gallery ${day}`, place: 'Art Gallery of New South Wales', area: `${base}`, minutes: 90, travel: { mode: 'walk', minutes: 20 }, reason: 'Free and indoors.', desc: 'Australian and international art.', costKey: 'visit-art-gallery', note: '' }]),
  { slot: 'afternoon', start: '12:30', kind: 'break', title: 'Rest', place: '', area: '', minutes: 30, travel: { mode: 'none', minutes: 0 }, reason: '', desc: '', costKey: '', note: '' },
]
const fakeAi = {
  async generate(request: Any) {
    if (itineraryMode === 'throw') throw new Error('model down')
    const days = Number(/Days at the destination: (\d+)/.exec(request.prompt)![1])
    if (itineraryMode === 'bad') return { text: '{"days": []}', inputTokens: 10, outputTokens: 10, stopReason: 'end_turn' }
    const route = {
      summary: 'A relaxed Australian stay.', why: 'Few moves keep travel short.',
      gateway: { needsFlight: true, arrivalAirport: 'Sydney (SYD)', departureAirport: 'Sydney (SYD)', note: '' },
      bases: basesFor(days),
      days: Array.from({ length: days }, (_, i) => ({ day: i + 1, base: baseOn(days, i + 1), overnight: baseOn(days, i + 1), kind: 'full', title: `Day ${i + 1}` })),
      assumptions: ['Economy flights with one checked bag.'], checks: ['Check tour times.'],
    }
    if (request.prompt.includes('STEP 1 OF 2')) {
      routeCalls++
      return { text: JSON.stringify(route), inputTokens: 2000, outputTokens: 1000, stopReason: 'end_turn' }
    }
    const [, from, to] = /days (\d+) to (\d+) only/.exec(request.prompt)!.map(Number)
    dayCalls.push([from, to])
    const out: Any = { days: {}, alternatives: [], costNeeds: [] }
    for (let d = from; d <= to; d++) {
      const thin = thinOnce.has(d) && !request.prompt.includes('YOUR PREVIOUS ANSWER')
      out.days[`d${d}`] = { pacingNote: '', items: itemsFor(d, baseOn(days, d), thin) }
      out.alternatives.push({ day: d, replaces: `d${d}-2`, optional: false, slot: 'afternoon', start: '13:30', kind: 'activity', title: 'Bondi to Coogee walk', place: 'Bondi Beach', area: 'Bondi Beach, Sydney NSW', minutes: 150, travel: { mode: 'bus', minutes: 40 }, reason: 'Free coastal walk.', desc: 'Cliff-top coastal path.', costKey: '', note: '' })
    }
    if (from === 1) out.costNeeds = [
      { key: 'ticket-opera-tour', label: 'Opera House tour', category: 'activities', unit: 'per_person', detail: 'Standard guided tour' },
      { key: 'visit-art-gallery', label: 'Art Gallery of NSW', category: 'activities', unit: 'per_person', detail: 'General admission' },
    ]
    return { text: JSON.stringify(out), inputTokens: 2000, outputTokens: 3000, stopReason: 'end_turn' }
  },
  async research(request: Any) {
    priceCalls++
    if (priceMode === 'throw') throw new Error('search down')
    const allowance = /everyday travel costs/.test(request.system)
    if (allowance) allowanceCalls++
    const keys = [...request.prompt.matchAll(/^- ([a-z0-9:@_-]+):/gm)].map((m: Any) => m[1]).filter((k: string) => (allowance ? allowanceFinds.has(k) : !priceGaps.has(k)))
    const amount = (key: string) => key.startsWith('flight') ? 500 : key.startsWith('stay-budget') ? 120 : key.startsWith('stay') ? 250 : key.startsWith('visit') ? 0 : 25
    const prices = priceMode === 'none' ? [] : keys.map((key: string) => ({
      key, type: key.startsWith('ticket') ? 'published' : 'estimate', currency: 'AUD', low: Math.round(amount(key) * 0.8), high: Math.round(amount(key) * 1.2), working: amount(key),
      unit: key.startsWith('stay') ? 'per_room_night' : key.startsWith('coffee') ? 'per_item' : 'per_person', sampleSize: 4, sourceUrl: SOURCE, sourceName: 'Example',
      ...(key.startsWith('visit') ? { free: true, inclusions: 'Special exhibitions are ticketed' } : {}),
      ...(key.startsWith('ticket') || key.startsWith('visit') ? { officialUrl: OFFICIAL, ticketsUrl: SOURCE, hoursUrl: 'https://not-in-results.example/hours' } : {}),
      ...(allowance ? { method: 'Menu prices at three cafés' } : {}),
    }))
    return { text: '```json\n' + JSON.stringify({ prices, rates: [] }) + '\n```', sources: [{ url: SOURCE, title: 'Example prices', pageAge: null }, { url: OFFICIAL, title: 'Official site', pageAge: null }], inputTokens: 5000, outputTokens: 2000, searches: 3, stopReason: 'end_turn' }
  },
}

const configure = (planner: Any = {}) =>
  payload.updateGlobal({
    slug: 'community-settings',
    data: {
      planner: { aiEnabled: true, model: 'claude-sonnet-5-5', dailyBudgetUsd: 50, freePlans: 1, priceAud: 9.99, revisionsPerPlan: 2, ...planner },
      listings: { enabled: false, feeAud: 5, priceLabel: 'Launch price', gstRegistered: true, sellerName: 'Test Seller', sellerAbn: TEST_ABN },
    } as Any,
  })

let ipCounter = 0
const newIp = () => `203.0.113.${++ipCounter}`
const formFor = (days: number, over: Any = {}) => {
  const depart = new Date(Date.UTC(2026, 11, 1 + days - 1)).toISOString().slice(0, 10)
  const r = F.readTripForm({ origin: 'Singapore', destination: 'Australia', arrive: '2026-12-01', depart, by: 'dates', travellerType: 'couple', adults: '2', children: '0', budget: '8000', currency: 'AUD', ...over }, TODAY)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  return r.form
}
const makeTrip = async (days: number, opts: Any = {}) => {
  const t = await S.createTrip({ form: formFor(days, opts.form), ip: opts.ip ?? newIp(), memberId: opts.memberId ?? null })
  await S.generateTrip(t.id)
  return (await S.findTrip(t.token))!
}

before(async () => {
  await setup()
  S = await import('../../src/lib/planner/trip/store')
  F = await import('../../src/lib/planner/trip/form')
  CO = await import('../../src/lib/planner/trip/checkout')
  CALC = await import('../../src/lib/planner/trip/calc')
  L = await import('../../src/lib/community/listings')
  AI = await import('../../src/lib/planner/ai')
  STRIPE = await import('../../src/lib/community/payments/stripe')
  AI.setAiGatewayForTests(fakeAi)
  STRIPE.setPaymentGatewayForTests(fakeStripe)
  await configure()
})

describe('generating a trip', () => {
  it('a country-only destination produces a feasible, priced route saved on the server', async () => {
    const trip = await makeTrip(5)
    assert.equal(trip.status, 'ready')
    assert.equal(trip.plan.days.length, 5)
    assert.equal(trip.plan.bases.reduce((a: number, b: Any) => a + b.nights, 0), 4)
    const budget = CALC.calculateBudget(trip.form, trip.plan, trip.selection)
    assert.equal(budget.incomplete, false)
    assert.ok(budget.total.working > 0)
    assert.equal(S.isToken(trip.token), true)
    assert.equal(JSON.stringify(trip.form).includes(trip.token), false)
  })
  it('one free trip per visitor per day; a failed generation does not use it and can be retried', async () => {
    const ip = newIp()
    itineraryMode = 'bad'
    const t = await S.createTrip({ form: formFor(4), ip, memberId: null })
    await S.generateTrip(t.id)
    assert.equal((await S.findTrip(t.token)).status, 'failed')
    itineraryMode = 'ok'
    // The failed one does not count, so a retry on the same trip works...
    await S.generateTrip(t.id)
    assert.equal((await S.findTrip(t.token)).status, 'ready')
    // ...and now the allowance is used.
    await assert.rejects(S.createTrip({ form: formFor(4), ip, memberId: null }), /free trip/)
  })
  it('a long trip is written as a route and then small groups of days, so no single request runs long', async () => {
    routeCalls = 0; dayCalls = []; priceCalls = 0
    const trip = await makeTrip(13)
    assert.equal(trip.status, 'ready', trip.error ?? '')
    assert.equal(routeCalls, 1)
    assert.deepEqual(dayCalls.sort((a, b) => a[0] - b[0]), [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 13]])
    assert.equal(trip.plan.days.length, 13)
    assert.ok(trip.plan.days.every((d: Any) => d.items.length === 4), 'every day has its items')
    assert.equal(trip.plan.days[12].items[0].id, 'd13-1')
    assert.equal(priceCalls, 3, 'flights and stays, food and transport, then activities')
    const budget = CALC.calculateBudget(trip.form, trip.plan, trip.selection)
    assert.equal(budget.incomplete, false)
  })
  it('never runs more price lookups at once than the limit', async () => {
    const gate = S.limiter(2)
    let now = 0, most = 0
    await Promise.all(Array.from({ length: 6 }, () => gate(async () => { now++; most = Math.max(most, now); await new Promise((r) => setTimeout(r, 5)); now-- })))
    assert.equal(most, 2)
  })
  it('keeps every finished price from an answer that was cut off part-way', () => {
    const cut = 'Searching...\n```json\n{"prices": [{"key": "a", "low": 1, "sourceName": "x {y}"}, {"key": "b", "low": 2}, {"key": "c", "lo'
    const got = S.readPriceAnswer(cut, () => null) as Any
    assert.deepEqual(got.prices.map((p: Any) => p.key), ['a', 'b'])
    assert.equal(S.readPriceAnswer('no json here', () => null), null)
    assert.deepEqual(S.priceGroups(Array.from({ length: 14 }, (_, i) => ({ key: `k${i}`, category: 'food' }))).map((g: Any) => g.length), [6, 6, 2])
  })
  it('when price research fails, costs show as missing and the total is incomplete, never zero', async () => {
    priceMode = 'throw'
    const trip = await makeTrip(4)
    priceMode = 'ok'
    const budget = CALC.calculateBudget(trip.form, trip.plan, trip.selection)
    assert.equal(budget.incomplete, true)
    assert.ok(budget.missing.some((m: Any) => m.category === 'flights'))
    assert.equal(budget.lines.filter((l: Any) => l.status === 'priced').length, 0)
  })
})

describe('a 20-day trip in two areas (Sydney, then Melbourne)', () => {
  let trip: Any
  before(async () => {
    priceGaps = new Set(['lunch@melbourne', 'snacks@melbourne', 'dinner@melbourne'])
    allowanceFinds = new Set(['lunch@melbourne'])
    thinOnce = new Set([5])
    routeCalls = 0; dayCalls = []; priceCalls = 0; allowanceCalls = 0
    trip = await makeTrip(20, { form: { budget: '6000' } })
    priceGaps = new Set(); allowanceFinds = new Set(); thinOnce = new Set()
  })
  it('generates two bases and every day', () => {
    assert.equal(trip.status, 'ready', trip.error ?? '')
    assert.deepEqual(trip.plan.bases.map((b: Any) => [b.name, b.nights]), [['Sydney', 9], ['Melbourne', 10]])
    assert.equal(trip.plan.days.length, 20)
  })
  it('every full sightseeing day has at least three substantive activities (a light answer is asked again)', () => {
    const full = trip.plan.days.filter((d: Any) => d.kind === 'full')
    assert.ok(full.length >= 17)
    for (const d of full) assert.ok(d.items.filter((i: Any) => i.kind === 'activity').length >= 3, `day ${d.day}`)
    assert.ok(dayCalls.filter(([f]) => f === 5).length === 2, 'the days 5–6 group was asked again')
    assert.ok(trip.plan.days[1].items.every((i: Any) => i.start && i.desc !== undefined))
  })
  it('meal allowances apply to every appropriate day: cost data first, then a sourced price from the other base', () => {
    const p = trip.plan.prices
    assert.equal(allowanceCalls, 1, 'one second search for the routine gaps')
    assert.equal(p['lunch@melbourne'].type, 'allowance')
    assert.match(p['lunch@melbourne'].basis, /local cost data: Menu prices/)
    assert.equal(p['snacks@melbourne'].type, 'allowance')
    assert.match(p['snacks@melbourne'].basis, /Sydney/)
    assert.equal(p['snacks@melbourne'].sourceUrl, SOURCE, 'an allowance keeps the source it rests on')
    const b = CALC.calculateBudget(trip.form, trip.plan, trip.selection)
    const food = b.lines.filter((l: Any) => l.category === 'food')
    assert.equal(food.filter((l: Any) => l.status === 'unavailable').length, 0, 'no meal is left without an estimate')
    for (const d of trip.plan.days.filter((x: Any) => x.kind === 'full')) {
      for (const m of ['breakfast', 'lunch', 'dinner']) assert.ok(food.some((l: Any) => l.id === `d${d.day}-${m}`), `day ${d.day} ${m}`)
    }
  })
  it('prices say what they are, and activity links are kept only when the searches returned them', () => {
    const types = new Set(Object.values(trip.plan.prices).map((f: Any) => f.type))
    for (const t of types) assert.ok(['quote', 'published', 'estimate', 'allowance', 'user', 'unavailable'].includes(t as string))
    const gallery = trip.plan.prices['visit-art-gallery']
    assert.equal(gallery.working, 0)
    assert.equal(gallery.officialUrl, OFFICIAL)
    assert.equal(gallery.hoursUrl, null, 'a page the searches did not return is dropped')
    assert.match(gallery.inclusions, /exhibitions/)
    assert.equal(trip.plan.prices['ticket-opera-tour'].type, 'published')
  })
  it('daily, one-time and category totals reconcile with the trip total', () => {
    const b = CALC.calculateBudget(trip.form, trip.plan, trip.selection)
    const days = b.byDay.reduce((a: number, d: Any) => a + d.working, 0)
    assert.equal(days + b.oneTime.working + b.contingency.working, b.total.working)
    assert.equal(b.byCategory.reduce((a: number, c: Any) => a + c.working, 0) + b.contingency.working, b.total.working)
  })
  it('locked days show meaningful summary amounts, without their details', () => {
    const view = S.tripPage(trip, null).view
    const locked = view.budget.lines.filter((l: Any) => l.id.startsWith('locked-'))
    const meals = locked.find((l: Any) => l.category === 'food')
    assert.equal(meals.label, 'Meals, coffee and snacks for days 4–20')
    assert.ok(meals.working > 0)
    assert.equal(meals.status, 'priced')
    assert.ok(locked.find((l: Any) => l.category === 'activities').working > 0)
    const sum = view.budget.lines.reduce((a: number, l: Any) => a + l.working, 0)
    assert.equal(sum + view.budget.contingency.working, view.budget.total.working, 'the preview lines still add up to the total')
    assert.equal(JSON.stringify(view).includes('Opera House tour 9'), false)
  })
  it('an over-budget trip gets its cost drivers and sourced ways to spend less', () => {
    const view = S.tripPage(trip, null).view
    assert.ok(view.advice, 'the plan is over the A$6,000 budget')
    assert.ok(view.advice.drivers.length > 0)
    const ids = view.advice.options.map((o: Any) => o.id)
    for (const id of ['stay', 'free', 'meals', 'night']) assert.ok(ids.includes(id), id)
    assert.ok(view.advice.options.find((o: Any) => o.id === 'stay').saving > 0)
    assert.equal(typeof view.advice.fits, 'boolean')
  })
  it('the PDF keeps every source as a readable, clickable link', async () => {
    const view = S.tripPage({ ...trip, unlocked: true }, null).view
    const { renderTripPdf } = await import('../../src/lib/planner/trip/pdf')
    const pdf = (await renderTripPdf(trip.form, view)).toString('latin1')
    assert.ok(pdf.includes('/URI'), 'links are clickable')
    assert.ok(pdf.includes(SOURCE) && pdf.includes(OFFICIAL))
  })
  it('a cost with no sourced price can take the traveller’s own allowance, shown as theirs', async () => {
    const t = await makeTrip(4, { form: {} })
    const key = 'coffee@sydney'
    // Make the coffee price unavailable, as if nothing was found.
    const doc: Any = await payload.findByID({ collection: "trips", id: t.id, depth: 0, overrideAccess: true })
    doc.plan.prices[key] = { ...doc.plan.prices[key], type: 'unavailable', low: 0, high: 0, working: 0, sourceUrl: null }
    await payload.update({ collection: 'trips', id: t.id, overrideAccess: true, data: { plan: doc.plan } })
    let view = S.tripPage(await S.findTrip(t.token), null).view
    assert.ok(view.allowanceKeys.some((k: Any) => k.key === key))
    await S.changeTrip(t.token, null, { op: 'allowance', key, amount: 6 })
    const after = await S.findTrip(t.token)
    view = S.tripPage(after, null).view
    const coffee = view.budget.lines.filter((l: Any) => l.factKey === key)
    assert.ok(coffee.every((l: Any) => l.priceType === 'user' && l.working > 0))
    assert.equal(view.budget.usesUserAllowance, true)
    await assert.rejects(S.changeTrip(t.token, null, { op: 'allowance', key: 'ticket-opera-tour', amount: 5 }), /cannot be set/)
  })
})

describe('the free preview and changes', () => {
  it('an unpaid visitor loads only the first three days of a longer trip', async () => {
    const trip = await makeTrip(7)
    const page = S.tripPage(trip, null)
    assert.equal(page.state, 'ready')
    assert.equal(page.full, false)
    const sent = JSON.stringify(page.view)
    assert.equal(sent.includes('Secret garden 5'), false)
    assert.equal(sent.includes('Opera House tour 7'), false)
    assert.ok(sent.includes('Secret garden 3'))
  })
  it('a three-day trip is shown in full for free', async () => {
    const trip = await makeTrip(3)
    assert.equal(S.tripPage(trip, null).view.days.every((d: Any) => !d.locked), true)
  })
  it('replacing the paid tour with a free walk lowers the total, and locked days cannot be changed', async () => {
    const trip = await makeTrip(6)
    const before = CALC.calculateBudget(trip.form, trip.plan, trip.selection).total.working
    await S.changeTrip(trip.token, null, { op: 'replace', item: 'd1-2', with: 'alt-1' })
    const after = await S.findTrip(trip.token)
    assert.ok(CALC.calculateBudget(after.form, after.plan, after.selection).total.working < before)
    await assert.rejects(S.changeTrip(trip.token, null, { op: 'remove', item: 'd5-1' }))
  })
})

describe('paying the planner fee', () => {
  it('checks payment on the server, never charges twice, and restores access for the purchaser', async () => {
    const member = await newMember('Payer')
    const trip = await makeTrip(8, { memberId: null })
    const start = created
    const first = await CO.startTripCheckout(member, trip.token, { base: 'https://travelnotes.test' })
    const again = await CO.startTripCheckout(member, trip.token, { base: 'https://travelnotes.test' })
    assert.equal(again.url, first.url, 'pressing unlock again reuses the open checkout')
    assert.equal(created - start, 1)

    const id = new URL(first.url).pathname.slice(1)
    // Returning from Stripe before the payment completes does not unlock anything.
    assert.equal((await L.confirmListingPayment(id)).status, 'unpaid')
    assert.equal((await S.findTrip(trip.token)).unlocked, false)

    sessions.get(id).paymentStatus = 'paid'
    sessions.get(id).paymentIntentId = `pi_${id}`
    assert.equal((await L.confirmListingPayment(id)).status, 'paid')
    assert.equal((await L.confirmListingPayment(id)).status, 'paid', 'the webhook and the return page can both confirm it')
    const paid = await S.findTrip(trip.token)
    assert.equal(paid.unlocked, true)
    const payment = await payload.findByID({ collection: 'listing-payments', id: sessions.get(id).metadata.paymentId, depth: 0 })
    assert.equal(payment.amountMinor, 999, 'the configured price is what is charged')
    assert.equal(payment.status, 'paid')

    // The purchaser sees every day; someone else with the link still sees only the preview.
    assert.equal(S.tripPage(paid, member.id).full, true)
    assert.equal(S.tripPage(paid, member.id).view.days.every((d: Any) => !d.locked), true)
    assert.equal(S.tripPage(paid, null).full, false)
    // A paid trip never starts another checkout.
    const after = await CO.startTripCheckout(member, trip.token, { base: 'https://travelnotes.test' })
    assert.equal(after.url, `https://travelnotes.test/trip-planner/t/${trip.token}`)
    // It is listed in the account, for coming back later.
    assert.ok((await S.memberTrips(member.id)).some((t: Any) => t.token === trip.token && t.unlocked))
  })
  it('the unlocked plan is the same plan that was previewed', async () => {
    const member = await newMember('Matcher')
    const trip = await makeTrip(6)
    const previewTotal = S.tripPage(trip, null).view.budget.total.working
    const { url } = await CO.startTripCheckout(member, trip.token, { base: 'https://travelnotes.test' })
    const id = new URL(url).pathname.slice(1)
    sessions.get(id).paymentStatus = 'paid'
    await L.confirmListingPayment(id)
    const paid = await S.findTrip(trip.token)
    assert.equal(S.tripPage(paid, member.id).view.budget.total.working, previewTotal)
    const doc = await payload.findByID({ collection: 'trips', id: paid.id, depth: 0, overrideAccess: true })
    assert.equal(doc.previewHash, S.previewHash(trip))
  })
  it('a trip that belongs to one account cannot be bought or changed by another', async () => {
    const owner = await newMember('Owner')
    const other = await newMember('Other')
    const trip = await makeTrip(5, { memberId: owner.id })
    await assert.rejects(CO.startTripCheckout(other, trip.token, { base: 'https://travelnotes.test' }), /another account/)
    await assert.rejects(S.changeTrip(trip.token, other.id, { op: 'remove', item: 'd1-1' }))
  })
})
