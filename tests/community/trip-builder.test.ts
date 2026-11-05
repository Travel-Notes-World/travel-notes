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

/** A fake model: a valid itinerary for the requested days, and sourced prices for every key asked. */
const SOURCE = 'https://www.example.test/prices'
let itineraryMode: 'ok' | 'bad' | 'throw' = 'ok'
let priceMode: 'ok' | 'none' | 'throw' = 'ok'
let routeCalls = 0
let dayCalls: [number, number][] = []
let priceCalls = 0
const fakeAi = {
  async generate(request: Any) {
    if (itineraryMode === 'throw') throw new Error('model down')
    const days = Number(/Days at the destination: (\d+)/.exec(request.prompt)![1])
    if (itineraryMode === 'bad') return { text: '{"days": []}', inputTokens: 10, outputTokens: 10, stopReason: 'end_turn' }
    const answer = {
      summary: 'A relaxed Sydney stay.', why: 'One base keeps travel short.',
      gateway: { needsFlight: true, arrivalAirport: 'Sydney (SYD)', departureAirport: 'Sydney (SYD)', note: '' },
      bases: [{ name: 'Sydney', region: 'NSW', nights: days - 1, fromDay: 1, toDay: days, reason: 'Harbour, beaches and easy transport.', airport: 'SYD' }],
      days: Array.from({ length: days }, (_, i) => ({ day: i + 1, base: 'Sydney', overnight: 'Sydney', kind: 'full', title: `Sydney day ${i + 1}`, items: [
        { slot: 'morning', kind: 'activity', title: `Secret garden ${i + 1}`, place: 'Royal Botanic Garden Sydney', area: 'Sydney NSW', minutes: 90, travel: { mode: 'none', minutes: 0 }, reason: 'Easy start.', costKey: '', note: '' },
        { slot: 'afternoon', kind: 'activity', title: `Opera House tour ${i + 1}`, place: 'Sydney Opera House', area: 'Sydney NSW', minutes: 60, travel: { mode: 'walk', minutes: 15 }, reason: 'Iconic.', costKey: 'ticket-opera-tour', note: '' },
      ] })),
      alternatives: [{ day: 1, replaces: 'd1-2', optional: false, slot: 'afternoon', kind: 'activity', title: 'Bondi to Coogee walk', place: 'Bondi Beach', area: 'Bondi Beach, Sydney NSW', minutes: 150, travel: { mode: 'bus', minutes: 40 }, reason: 'Free coastal walk.', costKey: '', note: '' }],
      costNeeds: [{ key: 'ticket-opera-tour', label: 'Opera House tour', category: 'activities', unit: 'per_person', detail: 'Standard guided tour' }],
      assumptions: ['Economy flights with one checked bag.'], checks: ['Check tour times.'],
    }
    // The planner asks for the route first, then the days in groups.
    let reply: Any = answer
    if (request.prompt.includes('STEP 1 OF 2')) {
      routeCalls++
      reply = { ...answer, days: answer.days.map((d: Any) => ({ day: d.day, base: d.base, overnight: d.overnight, kind: d.kind, title: d.title })) }
      delete reply.alternatives
      delete reply.costNeeds
    } else if (request.prompt.includes('STEP 2 OF 2')) {
      const [, from, to] = /days (\d+) to (\d+) only/.exec(request.prompt)!.map(Number)
      dayCalls.push([from, to])
      reply = { days: Object.fromEntries(answer.days.filter((d: Any) => d.day >= from && d.day <= to).map((d: Any) => [`d${d.day}`, d.items])), alternatives: answer.alternatives.filter((a: Any) => a.day >= from && a.day <= to), costNeeds: from === 1 ? answer.costNeeds : [] }
    }
    return { text: JSON.stringify(reply), inputTokens: 2000, outputTokens: 3000, stopReason: 'end_turn' }
  },
  async research(request: Any) {
    priceCalls++
    if (priceMode === 'throw') throw new Error('search down')
    const keys = [...request.prompt.matchAll(/^- ([a-z0-9:@_-]+):/gm)].map((m: Any) => m[1])
    const prices = priceMode === 'none' ? [] : keys.map((key: string) => ({ key, type: 'estimate', currency: 'AUD', low: key.startsWith('flight') ? 400 : 20, high: key.startsWith('flight') ? 600 : 30, working: key.startsWith('flight') ? 500 : 25, unit: key.startsWith('stay') ? 'per_room_night' : key.startsWith('coffee') ? 'per_item' : 'per_person', sampleSize: 4, sourceUrl: SOURCE, sourceName: 'Example' }))
    return { text: '```json\n' + JSON.stringify({ prices, rates: [] }) + '\n```', sources: [{ url: SOURCE, title: 'Example prices', pageAge: null }], inputTokens: 5000, outputTokens: 2000, searches: 3, stopReason: 'end_turn' }
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
    assert.ok(trip.plan.days.every((d: Any) => d.items.length === 2), 'every day has its items')
    assert.equal(trip.plan.days[12].items[0].id, 'd13-1')
    assert.equal(priceCalls, 4, 'flights and stays, food and transport in groups of six, then activities')
    const budget = CALC.calculateBudget(trip.form, trip.plan, trip.selection)
    assert.equal(budget.incomplete, false)
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
