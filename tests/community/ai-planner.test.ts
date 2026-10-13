/**
 * AI Trip Planner: switched off by default; fills a plan's days from Travel Notes content first,
 * labelling anything else as an unchecked AI idea; one free plan per member, then paid per plan
 * (which also unlocks printing); failures never use the allowance; a daily spending limit.
 * The model and Stripe are replaced by fakes, so no network is used.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { newMember, payload, places, rejects, setup, type Any } from './helpers'

let AI: Any, P: Any, PAY: Any, L: Any, STRIPE: Any

const TEST_ABN = '51 824 753 556' // A valid ABN checksum, used only in tests.
const requests: Any[] = []
let nextAnswer: () => Any = () => goodAnswer()

const goodAnswer = () => ({
  text: JSON.stringify({
    summary: 'Two easy days in Kyoto, starting with temples and ending with gardens.',
    days: [
      { day: 1, title: 'Temples', stops: [
        { title: 'Walk around Kyoto', place: 'Kyoto', notes: 'Start with the area our guide covers.', source: '/destinations/japan/kyoto' },
        { title: 'Made-up tea house', place: 'Gion', notes: 'A quiet stop.', source: '/stories/does-not-exist' },
        { title: 'Philosopher’s Path walk', place: 'Higashiyama', notes: 'Go early.', source: '' },
      ] },
      { day: 2, title: 'Gardens', stops: [{ title: 'Garden morning', place: 'Kyoto', notes: 'Allow time.', source: '' }] },
    ],
    checks: ['Check entry rules for Australians with Smartraveller.'],
  }),
  inputTokens: 4000,
  outputTokens: 1000,
  stopReason: 'end_turn',
})

const fakeAi = {
  async generate(request: Any) {
    requests.push(request)
    const answer = nextAnswer()
    if (answer instanceof Error) throw answer
    return answer
  },
}

const sessions = new Map<string, Any>()
let counter = 0
const fakeStripe = {
  async createCheckout(input: Any) {
    const id = `cs_test_ai_${++counter}`
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
      planner: { aiEnabled: true, model: 'claude-sonnet-5-5', dailyBudgetUsd: 5, freePlans: 1, priceAud: 4.99, ...planner },
      listings: { enabled: false, feeAud: 5, priceLabel: 'Launch price', gstRegistered: true, sellerName: 'Test Seller', sellerAbn: TEST_ABN },
    } as Any,
  })

const twoDayPlan = async (member: Any, extraDays = 0) => {
  const days = [{ title: 'Kyoto', date: '2026-11-02' }, { title: 'Kyoto', date: '2026-11-03' }, ...Array.from({ length: extraDays }, () => ({ title: 'Kyoto', date: null }))]
  const { id } = await P.createPlanFromPlanner(member, { title: 'Kyoto, November 2026', start: '2026-11-02', days, placeIds: [places.kyoto.id], party: 'couple', pace: 'balanced' })
  return id as string
}
const runsOf = async (planId: string) => (await payload.find({ collection: 'ai-runs', where: { plan: { equals: planId } }, sort: 'createdAt', depth: 0 })).docs as Any[]

before(async () => {
  await setup()
  AI = await import('../../src/lib/planner/ai')
  P = await import('../../src/lib/community/plans')
  PAY = await import('../../src/lib/planner/payments')
  L = await import('../../src/lib/community/listings')
  STRIPE = await import('../../src/lib/community/payments/stripe')
  await payload.delete({ collection: 'ai-runs', where: { id: { exists: true } } })
  await payload.delete({ collection: 'listing-payments', where: { id: { exists: true } } })
  await payload.updateGlobal({ slug: 'community-settings', data: { planner: { aiEnabled: false } } as Any })
})
after(() => {
  AI.setAiGatewayForTests(null)
  STRIPE.setPaymentGatewayForTests(null)
})

describe('switched off', () => {
  it('does nothing until an administrator turns it on and a key is set', async () => {
    const member = await newMember('Early Bird')
    const id = await twoDayPlan(member)
    const status = await AI.aiStatus(member, id)
    assert.equal(status.available, false)
    assert.match(status.reason, /not switched on/)
    await rejects(AI.generateAiPlan(member, id), 'closed')
    AI.setAiGatewayForTests(fakeAi)
    STRIPE.setPaymentGatewayForTests(fakeStripe)
    await configure()
    assert.equal((await AI.aiStatus(member, id)).available, true)
  })
})

describe('writing a plan', () => {
  it('fills the days, links stops to Travel Notes pages it was given, and labels the rest as AI ideas', async () => {
    const member = await newMember('Planner')
    const id = await twoDayPlan(member)
    await P.updatePlan(member, id, { title: 'Kyoto, November 2026', startDate: '2026-11-02', notes: 'PRIVATE NOTE 123', days: [
      { title: 'Kyoto', date: '2026-11-02', stops: [{ title: 'Dinner with friends', origin: 'own' }] },
      { title: 'Kyoto', date: '2026-11-03', stops: [] },
    ] })
    requests.length = 0
    const result = await AI.generateAiPlan(member, id)
    assert.equal(result.free, true)

    const sent = requests[0]
    assert.equal(sent.model, 'claude-sonnet-5-5')
    assert.match(sent.prompt, /\/destinations\/japan\/kyoto/)
    assert.ok(!sent.prompt.includes('PRIVATE NOTE 123') && !sent.prompt.includes('Dinner with friends') && !sent.prompt.includes('@example.test'), 'no notes, own stops or email are sent')
    assert.match(sent.system, /Never state prices/)

    const view = await P.getPlan(member, id)
    const day1 = view.days[0].stops
    assert.deepEqual(day1.map((s: Any) => [s.title, s.origin, s.sourcePath]), [
      ['Walk around Kyoto', 'travel_notes', '/destinations/japan/kyoto'],
      ['Made-up tea house', 'ai_idea', null],
      ['Philosopher’s Path walk', 'ai_idea', null],
      ['Dinner with friends', 'own', null],
    ])
    assert.equal(view.days[1].stops[0].origin, 'ai_idea')
    assert.match(view.ai.summary, /Two easy days/)
    assert.match(view.ai.summary, /Smartraveller/)
    assert.equal(view.ai.unlocked, false, 'a free plan cannot be printed')

    const [run] = await runsOf(id)
    assert.equal(run.status, 'ok')
    assert.equal(run.free, true)
    assert.equal(run.costMicroUsd, 4000 * 2 + 1000 * 10)

    // Writing again replaces the AI stops and keeps the member's own.
    const status = await AI.aiStatus(member, id)
    assert.equal(status.freeLeft, 0)
    await rejects(AI.generateAiPlan(member, id), 'forbidden')
  })

  it('a second plan is paid for once, which also unlocks printing', async () => {
    const member = await newMember('Payer')
    const first = await twoDayPlan(member)
    await AI.generateAiPlan(member, first)
    const second = await twoDayPlan(member)
    await rejects(AI.generateAiPlan(member, second), 'forbidden')

    const { url } = await PAY.startAiPlanCheckout(member, second, { base: 'https://travelnotes.test' })
    const sessionId = new URL(url).pathname.slice(1)
    assert.equal((await L.confirmListingPayment(sessionId)).status, 'unpaid')
    sessions.get(sessionId).paymentStatus = 'paid'
    sessions.get(sessionId).paymentIntentId = `pi_${sessionId}`
    const confirmed = await L.confirmListingPayment(sessionId)
    assert.deepEqual(confirmed, { status: 'paid', planId: second })
    await L.confirmListingPayment(sessionId) // the webhook and the browser can both confirm

    const payments = (await payload.find({ collection: 'listing-payments', where: { plan: { equals: second } }, depth: 0 })).docs as Any[]
    assert.equal(payments.length, 1)
    assert.equal(payments[0].purpose, 'ai_plan')
    assert.equal(payments[0].amountMinor, 499)
    assert.equal(payments[0].gstMinor, 45)
    assert.equal((await P.getPlan(member, second)).ai.unlocked, true, 'paid plans can be printed')

    let status = await AI.aiStatus(member, second, { canPay: true })
    assert.equal(status.paidCredit, true)
    const result = await AI.generateAiPlan(member, second)
    assert.equal(result.free, false)
    const runs = await runsOf(second)
    assert.equal(runs.at(-1).payment, payments[0].id)
    status = await AI.aiStatus(member, second)
    assert.equal(status.paidCredit, false, 'one payment covers one AI plan')
    assert.equal((await P.getPlan(member, second)).ai.unlocked, true)

    const invoice = await L.getInvoice({ member, staff: null }, payments[0].id)
    assert.equal(invoice.planId, second)
  })

  it('a failed or unfinished answer never uses the free plan', async () => {
    const member = await newMember('Unlucky')
    const id = await twoDayPlan(member)
    nextAnswer = () => new Error('network down')
    await rejects(AI.generateAiPlan(member, id), 'unavailable')
    nextAnswer = () => ({ ...goodAnswer(), stopReason: 'max_tokens', text: '{"summary":' })
    await rejects(AI.generateAiPlan(member, id), 'unavailable')
    nextAnswer = () => ({ ...goodAnswer(), text: 'not json' })
    await rejects(AI.generateAiPlan(member, id), 'unavailable')
    const runs = await runsOf(id)
    assert.deepEqual(runs.map((r: Any) => r.status), ['failed', 'failed', 'failed'])
    assert.equal(runs[1].costMicroUsd, 4000 * 2 + 1000 * 10, 'the cost of an unfinished answer still counts towards the daily limit')
    assert.equal((await AI.aiStatus(member, id)).freeLeft, 1)
    nextAnswer = () => goodAnswer()
    assert.equal((await AI.generateAiPlan(member, id)).free, true)
  })

  it('refuses plans that are too long, without places, or belong to someone else', async () => {
    const member = await newMember('Long Tripper')
    const long = await twoDayPlan(member, 13)
    await rejects(AI.generateAiPlan(member, long), 'validation')
    const manual = (await P.createPlan(member, { title: 'Hand-made plan', days: [{ title: 'Day one', stops: [] }] })).id
    await rejects(AI.generateAiPlan(member, manual), 'validation')
    const stranger = await newMember('Stranger')
    await rejects(AI.generateAiPlan(stranger, long), 'not_found')
  })
})

describe('the daily spending limit', () => {
  it('pauses AI plans for the rest of the Sydney day once the limit is reached', async () => {
    await configure({ dailyBudgetUsd: 0.5 })
    const member = await newMember('Late Comer')
    const id = await twoDayPlan(member)
    await payload.create({ collection: 'ai-runs', data: { status: 'ok', model: 'claude-sonnet-5-5', costMicroUsd: 600_000 } as Any })
    const status = await AI.aiStatus(member, id)
    assert.equal(status.available, false)
    assert.match(status.reason, /paused until midnight/)
    await rejects(AI.generateAiPlan(member, id), 'closed')
    await configure()
  })

  it('works out midnight in Sydney, with daylight saving', () => {
    assert.equal(AI.sydneyDayStart(new Date('2026-10-13T02:00:00Z')).toISOString(), '2026-10-12T13:00:00.000Z')
    assert.equal(AI.sydneyDayStart(new Date('2026-07-01T05:00:00Z')).toISOString(), '2026-06-30T14:00:00.000Z')
  })

  it('estimates cost from the published prices', () => {
    assert.equal(AI.costMicroUsd('claude-sonnet-5-5', 1_000_000, 0), 2_000_000)
    assert.equal(AI.costMicroUsd('claude-haiku-5-5', 1_000_000, 1_000_000), 600_000)
  })
})
