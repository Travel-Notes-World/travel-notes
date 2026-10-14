/**
 * Trip budget (Phase A): the budget is worked out in code from the traveller's own set-up and saved,
 * sourced price checks. Family quantities use the right adult and child counts, bookings are
 * counted once, costs without a checked price are listed but never added, and the day subtotals
 * plus one-time costs add up to the total. Government travel advice is shown for overseas trips,
 * and a "Do not travel" country cannot be paid for.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { newMember, payload, places, rejects, setup, type Any } from './helpers'

let B: Any, C: Any, PR: Any, ADV: Any, P: Any, DET: Any, TB: Any, AI: Any, PAY: Any, STRIPE: Any

const TEST_ABN = '51 824 753 556'
const NOW = new Date('2026-10-14T00:00:00Z')

/** A price check for the engine tests, in cents. */
const price = (item: string, over: Any = {}) => ({
  id: `${item}-${over.placeId ?? 'k'}`, item, name: '', placeId: 'kyoto', placeName: 'Kyoto', toPlaceId: null,
  lowCents: 1000, highCents: 1000, childLowCents: null, childHighCents: null, childMaxAge: null, freeUnderAge: null,
  currency: 'AUD', basis: 'person', kind: 'estimate', sourceName: 'Test source', sourceUrl: 'https://example.test/prices', checkedAt: '2026-09-01T00:00:00.000Z',
  includes: '', excludes: '', bookingUrl: null, ...over,
})
const finder = (list: Any[]) => (item: string, placeId: string, match?: Any) => list.find((p) => p.item === item && (p.placeId === placeId || p.placeId === 'any') && (!match?.toPlaceId || p.toPlaceId === match.toPlaceId)) ?? null
const days = (n: number, placeId = 'kyoto') => Array.from({ length: n }, (_, i) => ({ date: `2026-11-0${i + 2}`, placeId }))
const PLACES = [{ id: 'kyoto', name: 'Kyoto' }, { id: 'osaka', name: 'Osaka' }]
const sumLines = (budget: Any) => budget.lines.filter((l: Any) => l.status !== 'unavailable').reduce((a: number, l: Any) => a + l.lowCents, 0)

before(async () => {
  await setup()
  B = await import('../../src/lib/planner/budget')
  C = await import('../../src/lib/planner/costs')
  PR = await import('../../src/lib/planner/prices')
  ADV = await import('../../src/lib/planner/advice')
  P = await import('../../src/lib/community/plans')
  DET = await import('../../src/lib/planner/details')
  TB = await import('../../src/lib/planner/trip-budget')
  AI = await import('../../src/lib/planner/ai')
  PAY = await import('../../src/lib/planner/payments')
  STRIPE = await import('../../src/lib/community/payments/stripe')
})

describe('the budget engine', () => {
  it('counts a family with the right adult, child and free quantities', () => {
    const setup = { ...C.DEFAULT_SETUP, adults: 2, childAges: [2, 9, 15], contingency: 0, coffees: 0 }
    const budget = B.computeBudget({
      setup, days: days(3), places: PLACES, now: NOW,
      // Lunch: A$20 adults, A$12 children up to 12, under 4 free. Children over 12 pay the adult price.
      find: finder([price('lunch', { lowCents: 2000, highCents: 2000, childLowCents: 1200, childMaxAge: 12, freeUnderAge: 4 })]),
    })
    const lunch = budget.lines.find((l: Any) => l.id === 'lunch-1')
    assert.equal(lunch.lowCents, 2 * 2000 + 1 * 1200 + 1 * 2000)
    assert.match(lunch.quantity, /2 adults × A\$20 \+ 1 child × A\$12 \+ 1 child \(age 15\) at the adult price \+ 1 child free \(under 4\)/)
    assert.equal(budget.people, 5)
  })

  it('follows arrival, departure and breakfast-included rules for meals', () => {
    const setup = { ...C.DEFAULT_SETUP, arrival: 'evening', departure: 'morning', breakfastIncluded: true }
    assert.deepEqual(B.mealsFor(setup, 0, 3), ['dinner'], 'a late arrival only needs dinner')
    assert.deepEqual(B.mealsFor(setup, 1, 3), ['lunch', 'dinner'], 'breakfast comes with the room')
    assert.deepEqual(B.mealsFor(setup, 2, 3), [], 'leaving in the morning, after breakfast at the hotel')
    assert.deepEqual(B.mealsFor({ ...setup, breakfastIncluded: false }, 2, 3), ['breakfast'])
  })

  it('counts bookings once, keeps paid apart, and never adds a missing price', () => {
    const setup = {
      ...C.DEFAULT_SETUP, adults: 2, rooms: 1, contingency: 10, coffees: 1,
      flights: { status: 'booked', amountCents: 150000, paid: true },
      accommodation: { status: 'not_booked', amountCents: null, paid: false },
    }
    const budget = B.computeBudget({
      setup, days: days(3), places: PLACES, now: NOW,
      find: finder([price('stay_mid', { basis: 'room_night', lowCents: 20000, highCents: 25000 }), price('dinner', { lowCents: 3000, highCents: 4000 })]),
      budget: { amountCents: 400000, currency: 'AUD' },
    })
    const flights = budget.lines.filter((l: Any) => l.category === 'flights')
    assert.equal(flights.length, 1, 'flights counted once')
    assert.equal(flights[0].status, 'booked')
    assert.equal(budget.paid, 150000)
    const stays = budget.lines.filter((l: Any) => l.category === 'accommodation')
    assert.equal(stays.length, 2, '3 days = 2 nights')
    assert.deepEqual([stays[0].lowCents, stays[0].highCents, stays[0].day], [20000, 25000, 0])
    // Lunch, coffee, water… have no price: listed, not added.
    assert.ok(budget.unavailable.some((l: Any) => l.label === 'Lunch'))
    assert.ok(budget.unavailable.every((l: Any) => l.lowCents === 0 && l.highCents === 0))
    // Reconciliation: days + one-time = subtotal; margin only on what is still to pay.
    const dayTotal = budget.byDay.reduce((a: number, d: Any) => a + d.lowCents, 0)
    assert.equal(dayTotal + budget.oneTime.lowCents, budget.subtotal.lowCents)
    assert.equal(sumLines(budget), budget.subtotal.lowCents)
    assert.equal(budget.contingency.lowCents, Math.round((budget.subtotal.lowCents - 150000) * 0.1))
    assert.equal(budget.total.lowCents, budget.subtotal.lowCents + budget.contingency.lowCents)
    assert.equal(budget.budget.remaining.highCents, 400000 - budget.total.lowCents)
  })

  it('does not count flights it has no price for, and shows the booked accommodation once', () => {
    const setup = { ...C.DEFAULT_SETUP, flights: { status: 'not_booked', amountCents: null, paid: false }, accommodation: { status: 'booked', amountCents: 90000, paid: false } }
    const budget = B.computeBudget({ setup, days: days(4), places: PLACES, find: finder([price('stay_mid', { basis: 'room_night' })]), now: NOW })
    const flights = budget.lines.find((l: Any) => l.id === 'flights')
    assert.equal(flights.status, 'unavailable')
    assert.match(flights.note, /not connected yet/)
    const stays = budget.lines.filter((l: Any) => l.category === 'accommodation')
    assert.equal(stays.length, 1)
    assert.equal(stays[0].lowCents, 90000)
    assert.equal(stays[0].day, null, 'a booking is a one-time cost')
  })

  it('treats prices in another currency as unavailable and flags old prices', () => {
    const budget = B.computeBudget({
      setup: { ...C.DEFAULT_SETUP, coffees: 0 }, days: days(2), places: PLACES, now: NOW,
      find: finder([price('dinner', { currency: 'JPY', lowCents: 300000 }), price('water', { checkedAt: '2024-01-01T00:00:00.000Z' })]),
    })
    const dinner = budget.lines.find((l: Any) => l.id === 'dinner-0')
    assert.equal(dinner.status, 'unavailable')
    assert.match(dinner.note, /only have a price in JPY/)
    assert.equal(budget.lines.find((l: Any) => l.id === 'water-0').old, true)
  })

  it('adds travel between places and airport transfers for the group', () => {
    const trip = [...days(2, 'kyoto'), ...days(2, 'osaka')]
    const budget = B.computeBudget({
      setup: { ...C.DEFAULT_SETUP, adults: 2 }, days: trip, places: PLACES, now: NOW,
      find: finder([price('intercity', { toPlaceId: 'osaka', basis: 'journey', lowCents: 600 }), price('airport_transfer', { placeId: 'any', basis: 'group', lowCents: 9000, highCents: 9000 })]),
    })
    const leg = budget.lines.find((l: Any) => l.id === 'intercity-2')
    assert.equal(leg.label, 'Kyoto to Osaka')
    assert.equal(leg.lowCents, 1200)
    assert.equal(budget.lines.filter((l: Any) => l.id.startsWith('transfer-')).reduce((a: number, l: Any) => a + l.lowCents, 0), 18000)
  })
})

describe('saved price checks', () => {
  const save = (data: Any) => payload.create({ collection: 'price-checks', data: { currency: 'AUD', basis: 'person', kind: 'estimate', sourceName: 'Test', sourceUrl: 'https://example.test/p', checkedAt: '2026-09-01T00:00:00.000Z', ...data } as Any })

  it('uses the place’s own price first, then the country’s, and ignores prices waiting for checking', async () => {
    await save({ destination: places.japan.id, item: 'coffee', amount: 5, amountHigh: 7, basis: 'item' })
    await save({ destination: places.kyoto.id, item: 'lunch', amount: 15 })
    await save({ destination: places.japan.id, item: 'lunch', amount: 99 })
    await save({ destination: places.kyoto.id, item: 'dinner', amount: 40, status: 'review' })
    const { find } = await PR.loadPriceFinder(payload, [places.kyoto.id])
    assert.equal(find('coffee', places.kyoto.id).highCents, 700)
    assert.equal(find('coffee', places.kyoto.id).placeName, 'Japan')
    assert.equal(find('lunch', places.kyoto.id).lowCents, 1500)
    assert.equal(find('dinner', places.kyoto.id), null)
  })

  it('refuses a range that goes backwards and an unnamed attraction', async () => {
    await assert.rejects(save({ destination: places.kyoto.id, item: 'dinner', amount: 40, amountHigh: 30 }))
    await assert.rejects(save({ destination: places.kyoto.id, item: 'attraction', amount: 10 }))
  })

  it('works out a saved plan’s budget from the member’s set-up', async () => {
    const member = await newMember('Budget Family')
    const plan = await P.createPlanFromPlanner(member, { title: 'Kyoto', start: '2026-11-02', days: [1, 2, 3].map((i) => ({ title: 'Kyoto', date: `2026-11-0${i + 1}` })), placeIds: [places.kyoto.id], party: 'family', pace: 'balanced', purpose: 'holiday' })
    await DET.updateTripDetails(member, plan.id, { purpose: 'holiday', adults: '2', childAges: '4, 9', rooms: '1', stay: 'mid', coffees: '1', arrival: 'morning', departure: 'evening', flightsStatus: 'booked', flightsAmount: '2,400', flightsPaid: 'yes', stayStatus: 'not_booked', contingency: '10', budgetAmount: '6000', budgetCurrency: 'AUD' })
    const view = await P.getPlan(member, plan.id)
    assert.deepEqual([view.trip.adults, view.trip.childAges, view.details.travellers, view.trip.flights.amountCents, view.trip.flights.paid], [2, [4, 9], 4, 240000, true])
    const { budget } = await TB.planBudget(payload, view, NOW)
    const coffee = budget.lines.find((l: Any) => l.id === 'coffee-0')
    assert.equal(coffee.lowCents, 2 * 500, 'coffee for the 2 adults only')
    assert.equal(budget.paid, 240000)
    assert.ok(budget.unavailable.some((l: Any) => l.category === 'accommodation'), 'no checked hotel price, so it is not in the total')

    await rejects(DET.updateTripDetails(member, plan.id, { purpose: 'holiday', adults: '2', childAges: 'nine' }), 'validation')
    await rejects(DET.updateTripDetails(member, plan.id, { purpose: 'holiday', adults: '0' }), 'validation')
    await rejects(DET.updateTripDetails(member, plan.id, { purpose: 'holiday', adults: '2', flightsStatus: 'booked', flightsAmount: 'lots' }), 'validation')
  })
})

describe('travel advice', () => {
  it('shows the level for overseas countries, and nothing for Australia', async () => {
    await payload.create({ collection: 'travel-advisories', data: { country: places.japan.id, level: '1', url: 'https://www.smartraveller.gov.au/destinations/asia/japan', checkedAt: '2026-08-01T00:00:00.000Z' } as Any })
    const [japan] = await ADV.tripAdvice(payload, [places.kyoto.id], NOW)
    assert.deepEqual([japan.countryName, japan.level, japan.stale], ['Japan', 1, true])
    const [thailand] = await ADV.tripAdvice(payload, [places.bangkok.id], NOW)
    assert.equal(thailand.level, null, 'not recorded yet, still linked to Smartraveller')
    assert.match(thailand.url, /^https:\/\/www\.smartraveller\.gov\.au/)
    assert.deepEqual(await ADV.adviceFor(payload, [{ id: 'x', name: 'Australia', isoCode: 'AU' }]), [])
    await assert.rejects(payload.create({ collection: 'travel-advisories', data: { country: places.thailand.id, level: '2', url: 'https://example.com/thailand', checkedAt: '2026-10-01T00:00:00.000Z' } as Any }))
  })

  it('does not take payment for a trip to a "Do not travel" country', async () => {
    STRIPE.setPaymentGatewayForTests({ async createCheckout() { return { id: 'cs_x', url: 'https://checkout.example/x' } }, async getCheckout() { return null }, async refund() {}, verifyWebhook() { throw new Error('no') } })
    await payload.updateGlobal({ slug: 'community-settings', data: { planner: { aiEnabled: false, priceAud: 9.99, freePlans: 1, revisionsPerPlan: 2, dailyBudgetUsd: 5, model: 'claude-sonnet-5-5' }, listings: { enabled: false, feeAud: 5, gstRegistered: true, sellerName: 'Test Seller', sellerAbn: TEST_ABN } } as Any })
    await payload.create({ collection: 'travel-advisories', data: { country: places.thailand.id, level: '4', url: 'https://www.smartraveller.gov.au/destinations/asia/thailand', checkedAt: '2026-10-10T00:00:00.000Z' } as Any })
    const member = await newMember('Careful Traveller')
    const plan = await P.createPlanFromPlanner(member, { title: 'Bangkok', start: '2026-11-02', days: [{ title: 'Bangkok', date: '2026-11-02' }], placeIds: [places.bangkok.id], party: 'solo', pace: 'balanced', purpose: 'holiday' })
    await rejects(PAY.startAiPlanCheckout(member, plan.id, { base: 'https://travelnotes.test' }), 'closed', 'Do not travel')
    assert.equal((await AI.aiStatus(member, plan.id, { canPay: true })).canPay, false)
    STRIPE.setPaymentGatewayForTests(null)
  })
})
