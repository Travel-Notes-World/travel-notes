/**
 * AI Trip Planner MVP: off by default; a free brief plan (one destination, short outline); a paid
 * upgrade per plan (detailed plan, revisions, share link, PDF); failures never use an allowance;
 * visa itineraries mark only the traveller's own bookings as confirmed and are not offered for
 * Australia; personal details are never sent to the AI or shared; a daily spending limit.
 * The model and Stripe are replaced by fakes, so no network is used.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { newMember, payload, places, rejects, setup, type Any } from './helpers'

let AI: Any, P: Any, PAY: Any, L: Any, STRIPE: Any, DET: Any, SHARE: Any, DOC: Any, PDF: Any, EX: Any, PRE: Any, IN: Any

const TEST_ABN = '51 824 753 556' // A valid ABN checksum, used only in tests.
const requests: Any[] = []

const stop = (title: string, source = '', timeOfDay = 'morning') => ({ title, place: 'Kyoto', notes: 'A short note.', source, timeOfDay })
const answer = (over: Any = {}) => ({
  summary: 'A gentle trip through Kyoto.',
  days: [1, 2, 3].map((day) => ({
    day,
    title: `Day ${day} title`,
    overnight: 'Kyoto',
    transport: 'Walk and use local buses.',
    stops: [stop('Walk around Kyoto', '/destinations/japan/kyoto'), stop('Made-up tea house', '/stories/not-real', 'afternoon'), stop('Riverside walk', '', 'afternoon'), stop('Evening market area', '', 'evening'), stop('Fifth stop', '', 'evening'), stop('Sixth stop is cut', '', 'evening')],
  })),
  options: [
    { style: 'budget', summary: 'Saves money.', choices: 'Stay near a station\nEat at markets' },
    { style: 'balanced', summary: 'A mix.', choices: 'Mid-range area' },
    { style: 'premium', summary: 'More comfort.', choices: 'Central hotel area' },
  ],
  checks: ['Check entry rules with Smartraveller.'],
  ...over,
})
let next: () => Any = () => ({ text: JSON.stringify(answer()), inputTokens: 4000, outputTokens: 1000, stopReason: 'end_turn' })
const fakeAi = { async generate(r: Any) { requests.push(r); const a = next(); if (a instanceof Error) throw a; return a } }

const sessions = new Map<string, Any>()
let counter = 0
const fakeStripe = {
  async createCheckout(input: Any) {
    const id = `cs_test_mvp_${++counter}`
    const s = { id, url: `https://checkout.example/${id}`, paymentStatus: 'unpaid', paymentIntentId: null, customerEmail: input.customerEmail, metadata: input.metadata }
    sessions.set(id, s)
    return s
  },
  async getCheckout(id: string) { return sessions.get(id) },
  async refund() {},
  verifyWebhook() { throw new Error('not used') },
}

const configure = (planner: Any = {}) =>
  payload.updateGlobal({
    slug: 'community-settings',
    data: {
      planner: { aiEnabled: true, model: 'claude-sonnet-5-5', dailyBudgetUsd: 5, freePlans: 1, priceAud: 9.99, revisionsPerPlan: 2, ...planner },
      listings: { enabled: false, feeAud: 5, priceLabel: 'Launch price', gstRegistered: true, sellerName: 'Test Seller', sellerAbn: TEST_ABN },
    } as Any,
  })

const newPlan = async (member: Any, placeIds: string[] = [places.kyoto.id], purpose = 'holiday', count = 3) => {
  const days = Array.from({ length: count }, (_, i) => ({ title: 'Kyoto', date: `2026-11-0${i + 2}` }))
  return (await P.createPlanFromPlanner(member, { title: 'Kyoto, November 2026', start: '2026-11-02', days, placeIds, party: 'couple', pace: 'balanced', purpose })).id as string
}
const upgrade = async (member: Any, planId: string) => {
  const { url } = await PAY.startAiPlanCheckout(member, planId, { base: 'https://travelnotes.test' })
  const id = new URL(url).pathname.slice(1)
  sessions.get(id).paymentStatus = 'paid'
  sessions.get(id).paymentIntentId = `pi_${id}`
  return L.confirmListingPayment(id)
}
const runsOf = async (planId: string) => (await payload.find({ collection: 'ai-runs', where: { plan: { equals: planId } }, sort: 'createdAt', depth: 0 })).docs as Any[]

before(async () => {
  await setup()
  AI = await import('../../src/lib/planner/ai')
  P = await import('../../src/lib/community/plans')
  PAY = await import('../../src/lib/planner/payments')
  L = await import('../../src/lib/community/listings')
  STRIPE = await import('../../src/lib/community/payments/stripe')
  DET = await import('../../src/lib/planner/details')
  SHARE = await import('../../src/lib/planner/share')
  DOC = await import('../../src/lib/planner/document')
  PDF = await import('../../src/lib/planner/pdf')
  EX = await import('../../src/lib/planner/extras')
  PRE = await import('../../src/lib/planner/preview')
  IN = await import('../../src/lib/planner/input')
  await payload.updateGlobal({ slug: 'community-settings', data: { planner: { aiEnabled: false } } as Any })
})
after(() => {
  AI.setAiGatewayForTests(null)
  STRIPE.setPaymentGatewayForTests(null)
})

describe('switched off', () => {
  it('does nothing until an administrator turns it on and a key is set', async () => {
    const member = await newMember('Early Bird')
    const id = await newPlan(member)
    assert.match((await AI.aiStatus(member, id)).reason, /not switched on/)
    await rejects(AI.generateAiPlan(member, id), 'closed')
    AI.setAiGatewayForTests(fakeAi)
    STRIPE.setPaymentGatewayForTests(fakeStripe)
    await configure()
    assert.equal((await AI.aiStatus(member, id)).next, 'brief')
  })
})

describe('the free brief plan', () => {
  it('writes a short outline for one destination, without personal details in the request', async () => {
    const member = await newMember('Free Planner')
    const id = await newPlan(member)
    await DET.updateTripDetails(member, id, { purpose: 'holiday', adults: '2', budgetAmount: '3000', budgetCurrency: 'AUD', interests: ['food', 'bogus'], accessibility: 'Step-free access please', departFrom: 'Sydney' })
    requests.length = 0
    const result = await AI.generateAiPlan(member, id)
    assert.equal(result.kind, 'brief')
    const sent = requests[0]
    assert.match(sent.system, /BRIEF plan/)
    assert.match(sent.system, /Never state prices/)
    assert.match(sent.prompt, /Step-free access please/, 'accessibility needs shape the plan')
    assert.ok(!sent.prompt.includes('@example.test'), 'no email address is sent')

    const view = await P.getPlan(member, id)
    assert.deepEqual(view.details.interests, ['food'], 'unknown interests are dropped')
    assert.equal(view.days[0].stops.length, 2, 'two suggestions a day')
    assert.deepEqual(view.days[0].stops.map((s: Any) => [s.origin, s.sourcePath, s.timeOfDay]), [['travel_notes', '/destinations/japan/kyoto', null], ['ai_idea', null, null]])
    assert.equal(view.days[0].overnight, '', 'brief plans do not plan nights')
    assert.deepEqual(view.ai.options, [], 'no comparison in the free plan')
    assert.equal(view.ai.tier, 'brief')
    const status = await AI.aiStatus(member, id, { canPay: true })
    assert.equal(status.next, null)
    assert.match(status.blocked, /Upgrade/)
    await rejects(AI.generateAiPlan(member, id), 'forbidden')
    const [run] = await runsOf(id)
    assert.equal(run.kind, 'brief')
    assert.equal(run.free, true)
  })

  it('covers several places too', async () => {
    const member = await newMember('Two Places')
    const id = await newPlan(member, [places.kyoto.id, places.bangkok.id])
    assert.equal((await AI.aiStatus(member, id)).next, 'brief')
  })

  it('a failed or unfinished answer never uses the free plan', async () => {
    const member = await newMember('Unlucky')
    const id = await newPlan(member)
    next = () => new Error('network down')
    await rejects(AI.generateAiPlan(member, id), 'unavailable')
    next = () => ({ text: '{"summary":', inputTokens: 4000, outputTokens: 1000, stopReason: 'max_tokens' })
    await rejects(AI.generateAiPlan(member, id), 'unavailable')
    next = () => ({ text: 'not json', inputTokens: 10, outputTokens: 10, stopReason: 'end_turn' })
    await rejects(AI.generateAiPlan(member, id), 'unavailable')
    assert.deepEqual((await runsOf(id)).map((r: Any) => r.status), ['failed', 'failed', 'failed'])
    assert.equal((await AI.aiStatus(member, id)).freeLeft, 1)
    next = () => ({ text: JSON.stringify(answer()), inputTokens: 4000, outputTokens: 1000, stopReason: 'end_turn' })
    assert.equal((await AI.generateAiPlan(member, id)).kind, 'brief')
  })
})

describe('the paid detailed plan', () => {
  it('upgrading unlocks the detailed plan, a comparison and a fixed number of revisions', async () => {
    const member = await newMember('Upgrader')
    const id = await newPlan(member, [places.kyoto.id, places.bangkok.id])
    const confirmed = await upgrade(member, id)
    assert.deepEqual(confirmed, { status: 'paid', planId: id })
    const payment = (await payload.find({ collection: 'listing-payments', where: { plan: { equals: id } }, depth: 0 })).docs[0] as Any
    assert.equal(payment.amountMinor, 999)
    assert.equal(payment.gstMinor, 91)

    assert.equal((await AI.aiStatus(member, id)).next, 'detailed')
    requests.length = 0
    assert.equal((await AI.generateAiPlan(member, id)).kind, 'detailed')
    assert.match(requests[0].system, /DETAILED plan/)
    let view = await P.getPlan(member, id)
    assert.equal(view.ai.tier, 'detailed')
    assert.equal(view.days[0].stops.length, 3, 'one chosen activity for each part of the day')
    assert.deepEqual(view.days[0].stops.map((s: Any) => s.timeOfDay), ['morning', 'afternoon', 'evening'])
    assert.equal(view.choices.days[0].slots.length, 3)
    assert.equal(view.days[0].overnight, 'Kyoto')
    assert.match(view.days[0].transport, /buses/)
    assert.deepEqual(view.ai.options.map((o: Any) => o.style), ['budget', 'balanced', 'premium'])
    const [run] = await runsOf(id)
    assert.equal(run.kind, 'detailed')
    assert.equal(run.free, false)
    assert.equal(run.payment, payment.id)

    requests.length = 0
    assert.equal((await AI.generateAiPlan(member, id, { instruction: 'More food markets please' })).kind, 'revision')
    assert.match(requests[0].prompt, /More food markets please/)
    assert.match(requests[0].prompt, /CURRENT PLAN/)
    assert.equal((await P.getPlan(member, id)).ai.revisionsUsed, 1)
    await AI.generateAiPlan(member, id, { instruction: 'Slower please' })
    const status = await AI.aiStatus(member, id)
    assert.equal(status.revisionsLeft, 0)
    assert.match(status.blocked, /revisions/)
    await rejects(AI.generateAiPlan(member, id), 'forbidden')
    assert.equal((await AI.freePlansUsed(payload, member.id)), 0, 'the paid plan did not touch the free allowance')
    view = await P.getPlan(member, id)
    assert.equal(view.ai.unlocked, true)
  })

  it('gives choices for each part of the day, keeps only checked price ids, and keeps locked choices on revision', async () => {
    const member = await newMember('Chooser')
    const id = await newPlan(member)
    await upgrade(member, id)
    const ticket = await payload.create({ collection: 'price-checks', data: { destination: places.kyoto.id, item: 'attraction', name: 'Temple garden entry', amount: 10, basis: 'person', currency: 'AUD', kind: 'published', sourceName: 'Temple (official)', sourceUrl: 'https://example.test/temple', checkedAt: '2026-10-01T00:00:00.000Z' } as Any })
    const alt = (title: string, priceId = '') => ({ title, place: 'Kyoto', notes: 'Fits.', source: '', priceId, minutes: 90 })
    const withChoices = () => answer({
      days: [1, 2, 3].map((day) => ({
        day, title: `Day ${day}`, overnight: 'Kyoto', transport: 'Walk.',
        stops: [
          { ...stop('Temple garden', '/destinations/japan/kyoto'), priceId: ticket.id, minutes: 120, alternatives: [alt('Free riverside walk'), alt('Made-up price', '00000000-0000-4000-8000-000000000000'), alt('Fourth is cut')] },
          { ...stop('Market', '', 'afternoon'), priceId: '', minutes: 60, alternatives: [] },
          { ...stop('Second morning is ignored'), priceId: '', minutes: 60, alternatives: [] },
        ],
      })),
    })
    next = () => ({ text: JSON.stringify(withChoices()), inputTokens: 4000, outputTokens: 1000, stopReason: 'end_turn' })
    requests.length = 0
    await AI.generateAiPlan(member, id)
    assert.match(requests[0].prompt, /Temple garden entry/, 'checked tickets are offered to the AI by id')
    let view = await P.getPlan(member, id)
    const morning = view.choices.days[1].slots[0]
    assert.equal(morning.time, 'morning')
    assert.deepEqual(morning.options.map((o: Any) => o.title), ['Temple garden', 'Free riverside walk', 'Made-up price'])
    assert.equal(morning.options[0].priceId, ticket.id)
    assert.equal(morning.options[2].priceId, null, 'a price id that was not offered is dropped')
    assert.equal(view.choices.days[1].slots.length, 2)

    const CH = await import('../../src/lib/planner/choose')
    await CH.updateChoice(member, id, { day: 1, time: 'morning', action: 'choose', option: morning.options[1].id })
    view = await P.getPlan(member, id)
    assert.equal(view.days[1].stops[0].title, 'Free riverside walk', 'the chosen option becomes the stop')
    await CH.updateChoice(member, id, { day: 1, time: 'morning', action: 'lock' })
    await rejects(CH.updateChoice(member, id, { day: 1, time: 'morning', action: 'remove' }), 'validation')
    next = () => ({ text: JSON.stringify(withChoices()), inputTokens: 4000, outputTokens: 1000, stopReason: 'end_turn' })
    requests.length = 0
    await AI.generateAiPlan(member, id, { instruction: 'Change everything' })
    assert.match(requests[0].prompt, /lockedByTraveller":\["morning"\]/)
    view = await P.getPlan(member, id)
    assert.equal(view.days[1].stops[0].title, 'Free riverside walk', 'a locked choice survives a revision')
    assert.equal(view.choices.days[1].slots[0].locked, true)
    next = () => ({ text: JSON.stringify(answer()), inputTokens: 4000, outputTokens: 1000, stopReason: 'end_turn' })
  })

  it('keeps a night the traveller booked', async () => {
    const member = await newMember('Booker')
    const id = await newPlan(member)
    await upgrade(member, id)
    const { days } = await P.getPlanForEdit(member, id)
    days[1].overnight = 'My booked hotel, Kyoto'
    days[1].overnightConfirmed = true
    await P.updatePlan(member, id, { title: 'Kyoto trip', startDate: '2026-11-02', days })
    await AI.generateAiPlan(member, id)
    const view = await P.getPlan(member, id)
    assert.equal(view.days[1].overnight, 'My booked hotel, Kyoto')
    assert.equal(view.days[0].overnight, 'Kyoto')
  })
})

describe('visa itineraries', () => {
  it('need arrival and departure dates, never send the traveller’s name, and mark only bookings as confirmed', async () => {
    const member = await newMember('Visa Applicant')
    const id = await newPlan(member, [places.kyoto.id], 'visa')
    await rejects(DET.updateTripDetails(member, id, { purpose: 'visa' }), 'validation')
    await DET.updateTripDetails(member, id, { purpose: 'visa', arrivalDate: '2026-11-02', departureDate: '2026-11-04', travellerName: 'SECRET NAME', accommodation: 'SECRET HOTEL booked', transport: 'Flight booked', funding: 'self', cities: 'Kyoto' })
    await upgrade(member, id)
    requests.length = 0
    await AI.generateAiPlan(member, id)
    assert.ok(!requests[0].prompt.includes('SECRET NAME') && !requests[0].prompt.includes('SECRET HOTEL'), 'name and accommodation are not sent to the AI')
    assert.match(requests[0].system, /visitor visa application/)

    const { days } = await P.getPlanForEdit(member, id)
    days[0].overnightConfirmed = true
    await P.updatePlan(member, id, { title: 'Kyoto trip', startDate: '2026-11-02', days })
    const view = await P.getPlan(member, id)
    assert.deepEqual(view.ai.options, [], 'no holiday comparison on a visa itinerary')
    const doc = DOC.documentModel(view, { budget: null, legs: [], site: 'https://travelnotes.test', now: new Date('2026-10-13T00:00:00Z') })
    assert.equal(doc.layout, 'visa')
    assert.equal(doc.title, 'Proposed travel itinerary')
    assert.ok(doc.facts.some((f: Any) => f.label === 'Traveller' && f.value === 'SECRET NAME'))
    assert.deepEqual(doc.days.map((d: Any) => d.overnightStatus), ['confirmed', 'proposed', 'proposed'])
    assert.match(doc.disclaimer, /does not guarantee that a visa will be granted/)
    const pdf = await PDF.renderPlanPdf(doc)
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
    assert.ok(pdf.length > 2000)
  })

  it('are not offered for Australia', async () => {
    const au = await payload.create({ collection: 'destinations', data: { name: 'Australia', slug: `australia-${Date.now()}`, kind: 'country', isoCountryCode: 'AU', summary: 'Test.', seo: { title: 'Australia', description: 'Test.' }, _status: 'published' } as Any })
    const syd = await payload.create({ collection: 'destinations', data: { name: 'Sydney', slug: `sydney-${Date.now()}`, kind: 'city', parent: au.id, summary: 'Test.', seo: { title: 'Sydney', description: 'Test.' }, _status: 'published' } as Any })
    const member = await newMember('Visitor To Australia')
    const id = await newPlan(member, [syd.id], 'visa')
    await DET.updateTripDetails(member, id, { purpose: 'visa', arrivalDate: '2026-11-02', departureDate: '2026-11-04' })
    const refused = await rejects(AI.generateAiPlan(member, id), 'validation')
    assert.match(refused.message, /Australian visa/)
  })
})

describe('sharing, documents and personal details', () => {
  it('only paid plans can be shared; the shared view hides personal details; turning it off kills the link', async () => {
    const member = await newMember('Sharer')
    const id = await newPlan(member)
    await rejects(SHARE.setSharing(member, id, true), 'forbidden')
    await upgrade(member, id)
    await AI.generateAiPlan(member, id)
    const { days } = await P.getPlanForEdit(member, id)
    days[0].stops.push({ title: 'Dinner with Aunty', place: '', notes: 'Her address is private', savedContribution: null, origin: 'own', sourcePath: null, timeOfDay: null })
    days[1].overnight = 'Hotel Private'
    days[1].overnightConfirmed = true
    await P.updatePlan(member, id, { title: 'Kyoto trip', startDate: '2026-11-02', notes: 'My private notes', days })
    const { token } = await SHARE.setSharing(member, id, true)
    const shared = await SHARE.getSharedPlan(token)
    assert.ok(shared)
    const text = JSON.stringify(shared)
    assert.ok(!text.includes('Her address is private') && !text.includes('Hotel Private') && !text.includes('My private notes'))
    assert.ok(text.includes('Dinner with Aunty'))
    await SHARE.setSharing(member, id, false)
    assert.equal(await SHARE.getSharedPlan(token), null)
    assert.equal(await SHARE.getSharedPlan('short'), null)
  })

  it('builds the holiday PDF with labels, budget arithmetic and distances', async () => {
    const member = await newMember('Printer')
    const id = await newPlan(member)
    await DET.updateTripDetails(member, id, { purpose: 'holiday', adults: '2', budgetAmount: '3000', budgetCurrency: 'AUD' })
    await upgrade(member, id)
    await AI.generateAiPlan(member, id)
    const view = await P.getPlan(member, id)
    const doc = DOC.documentModel(view, { budget: null, legs: [{ from: 'Kyoto', to: 'Osaka', km: 43 }], site: 'https://travelnotes.test' })
    assert.equal(doc.layout, 'holiday')
    assert.ok(doc.days[0].stops.some((s: Any) => s.label.startsWith('AI suggestion')))
    assert.ok(doc.days[0].stops.some((s: Any) => s.link === 'https://travelnotes.test/destinations/japan/kyoto'))
    assert.match(doc.legs[0], /43 km/)
    // The real document carries the itemised budget (nothing priced here, so all of it is "unavailable").
    const full = await (await import('../../src/lib/planner/document-data')).planDocument(member, id)
    assert.match(full.budget[0], /Estimated total for 2 people: A\$0/)
    assert.ok(full.budget.some((l: string) => /Not included because there is no checked price: Return flights/.test(l)))
    assert.equal((await PDF.renderPlanPdf(full)).subarray(0, 4).toString(), '%PDF')
  })

  it('removes personal details on request', async () => {
    const member = await newMember('Private Person')
    const id = await newPlan(member, [places.kyoto.id], 'visa')
    await DET.updateTripDetails(member, id, { purpose: 'visa', arrivalDate: '2026-11-02', departureDate: '2026-11-04', travellerName: 'Name', accommodation: 'Hotel', accessibility: 'Wheelchair', funding: 'self', departFrom: 'Perth' })
    await DET.removePersonalDetails(member, id)
    const view = await P.getPlan(member, id)
    assert.equal(view.visa.travellerName, '')
    assert.equal(view.visa.accommodation, '')
    assert.equal(view.visa.funding, null)
    assert.equal(view.details.accessibility, '')
    assert.equal(view.details.departFrom, '')
    assert.equal(view.visa.arrivalDate, '2026-11-02', 'the trip itself stays')
  })

  it('works out straight-line distances and nearby places from coordinates', async () => {
    assert.equal(Math.round(EX.distanceKm({ latitude: 35.0116, longitude: 135.7681 }, { latitude: 34.6937, longitude: 135.5023 })), 43)
    assert.equal(EX.tripType(120), 'day')
    assert.equal(EX.tripType(200), 'overnight')
    await payload.update({ collection: 'destinations', id: places.kyoto.id, data: { latitude: 35.0116, longitude: 135.7681 } as Any })
    await payload.create({ collection: 'destinations', data: { name: 'Osaka', slug: `osaka-${Date.now()}`, kind: 'city', parent: places.japan.id, latitude: 34.6937, longitude: 135.5023, population: 2700000, summary: 'Test.', seo: { title: 'Osaka', description: 'Test.' }, _status: 'published' } as Any })
    const near = await EX.nearbyPlaces(payload, [places.kyoto.id])
    assert.deepEqual(near.map((n: Any) => [n.name, n.km, n.type]), [['Osaka', 43, 'day']])
  })
})

describe('the instant itinerary for visitors', () => {
  const input = (over: Any = {}) => IN.readPlannerInput({ to: places.kyoto.id, start: '2026-11-02', days: '3', ...over }).input

  it('writes a real itinerary straight away, once per visitor a day, and shows the same one again', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`
    requests.length = 0
    const first = await PRE.writePreview(ip, input())
    assert.equal(first.status, 'ready')
    assert.equal(first.preview.days.length, 3)
    assert.equal(first.preview.days[0].stops.length, 2)
    assert.deepEqual(first.preview.days[0].stops.map((s: Any) => s.origin), ['travel_notes', 'ai_idea'])
    assert.equal(requests.length, 1)
    assert.match(requests[0].system, /BRIEF plan/)

    const again = await PRE.writePreview(ip, input())
    assert.equal(again.status, 'ready')
    assert.equal(requests.length, 1, 'the same plan is not written twice')
    assert.deepEqual(await PRE.findPreview(ip, input()), first.preview)

    assert.equal((await PRE.writePreview(ip, input({ days: '4' }))).status, 'limited', 'one new itinerary per visitor a day')
    assert.equal((await PRE.writePreview(`198.51.100.${Math.floor(Math.random() * 200)}`, input({ days: '4' }))).status, 'ready', 'another visitor can')
    const runs = (await payload.find({ collection: 'ai-runs', where: { member: { exists: false } }, depth: 0, limit: 50 })).docs as Any[]
    assert.ok(runs.some((r: Any) => r.status === 'ok' && r.free && r.kind === 'brief'), 'counted in the daily spending')
  })

  it('is not offered for visa itineraries, without a network address, or while AI is off', async () => {
    assert.equal((await PRE.writePreview('192.0.2.10', input({ for: 'visa' }))).status, 'off')
    await rejects(PRE.writePreview(null, input({ days: '5' })), 'forbidden')
    await configure({ aiEnabled: false })
    assert.equal((await PRE.writePreview('192.0.2.11', input())).status, 'off')
    await configure()
  })

  it('comes with the visitor into their account when they save the plan', async () => {
    const ip = '192.0.2.77'
    const i = input({ days: '2' })
    await PRE.writePreview(ip, i)
    const member = await newMember('Saver Of Previews')
    const id = (await P.createPlanFromPlanner(member, { title: 'Kyoto', start: '2026-11-02', days: [{ title: 'Kyoto', date: '2026-11-02' }, { title: 'Kyoto', date: '2026-11-03' }], placeIds: [places.kyoto.id], party: null, pace: 'balanced', purpose: 'holiday' })).id
    assert.equal(await PRE.attachPreview(member, id, ip, i), true)
    const view = await P.getPlan(member, id)
    assert.equal(view.days[0].stops.length, 2)
    assert.equal(view.ai.tier, 'brief')
    assert.equal((await AI.aiStatus(member, id)).next, null, 'the free plan for this trip is already written')
    assert.equal((await AI.freePlansUsed(payload, member.id)), 0, 'the account’s own free plan is still there for another trip')
  })
})

describe('the daily spending limit', () => {
  it('pauses AI plans for the rest of the Sydney day once the limit is reached', async () => {
    await configure({ dailyBudgetUsd: 0.5 })
    const member = await newMember('Late Comer')
    const id = await newPlan(member)
    await payload.create({ collection: 'ai-runs', data: { status: 'ok', model: 'claude-sonnet-5-5', costMicroUsd: 600_000 } as Any })
    const status = await AI.aiStatus(member, id)
    assert.equal(status.available, false)
    assert.match(status.reason, /paused until midnight/)
    await rejects(AI.generateAiPlan(member, id), 'closed')
    await configure()
  })

  it('works out midnight in Sydney, with daylight saving, and estimates cost from the published prices', () => {
    assert.equal(AI.sydneyDayStart(new Date('2026-10-13T02:00:00Z')).toISOString(), '2026-10-12T13:00:00.000Z')
    assert.equal(AI.sydneyDayStart(new Date('2026-07-01T05:00:00Z')).toISOString(), '2026-06-30T14:00:00.000Z')
    assert.equal(AI.costMicroUsd('claude-sonnet-5-5', 1_000_000, 0), 2_000_000)
    assert.equal(AI.costMicroUsd('claude-haiku-5-5', 1_000_000, 1_000_000), 600_000)
  })
})
