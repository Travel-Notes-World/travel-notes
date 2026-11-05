/**
 * Single-form Trip Planner: the rules that need no database.
 *
 *   npm run test:trip
 *
 * Covers dates and nights, the form, price checks against search results, the budget arithmetic
 * (solo, couple and family; bookings, included meals and missing prices), activity changes, and
 * what the free preview may send to the browser.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { amountFor, calculateBudget, FLIGHT_BACK, FLIGHT_OUT, foodKey, localKey, mealsOn, selectedItems, stayKey, structuralNeeds } from '../../src/lib/planner/trip/calc'
import { departureFor, readTripForm, roomsFor, tripDates, tripDays, tripNights, type TripForm } from '../../src/lib/planner/trip/form'
import { applyChange, tripView } from '../../src/lib/planner/trip/gate'
import { DEFAULT_SELECTION, priceBasisText, readItinerary, readPrices, type PriceFact, type TripPlan } from '../../src/lib/planner/trip/plan'

const TODAY = '2026-11-05'

const baseForm = (over: Partial<Record<string, string | string[]>> = {}) => ({
  origin: 'Singapore', destination: 'Australia', arrive: '2026-12-01', depart: '2026-12-04', by: 'dates', travellerType: 'solo', adults: '1', children: '0', budget: '4000', currency: 'AUD', ...over,
})

const fact = (key: string, over: Partial<PriceFact> = {}): PriceFact => ({
  key, label: key, category: 'food', type: 'estimate', currency: 'AUD', low: 10, high: 10, working: 10, unit: 'per_person',
  childLow: null, childHigh: null, childMaxAge: null, freeUnderAge: null, familyPass: null, vehicleSeats: null, sampleSize: 5,
  method: '', route: '', inclusions: '', searchDates: '', sourceName: 'Test', sourceUrl: 'https://example.test/p', checkedAt: '2026-11-05T00:00:00Z', assumptions: '', ...over,
})

/** A small plan in one base (Sydney), with every structural price at A$10 unless given. */
function plan(days: number, over: Partial<TripPlan> = {}, prices: Record<string, Partial<PriceFact>> = {}): TripPlan {
  const p: TripPlan = {
    summary: 'Test trip', why: 'Fits', gateway: { needsFlight: true, arrivalAirport: 'SYD', departureAirport: 'SYD', note: '' },
    bases: [{ name: 'Sydney', region: 'NSW', nights: days - 1, fromDay: 1, toDay: days, reason: '', airport: 'SYD' }],
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1, date: `2026-12-0${i + 1}`, base: 'Sydney', overnight: i + 1 === days ? '' : 'Sydney', kind: days === 1 ? 'arrival_departure' : i === 0 ? 'arrival' : i + 1 === days ? 'departure' : 'full', title: `Day ${i + 1}`,
      items: [
        { id: `d${i + 1}-1`, slot: 'morning', kind: 'activity', title: `Museum ${i + 1}`, place: 'Museum', area: 'Sydney NSW', minutes: 120, travel: null, reason: '', costKey: 'ticket-museum', note: '' },
        { id: `d${i + 1}-2`, slot: 'afternoon', kind: 'activity', title: `Bondi Beach walk ${i + 1}`, place: 'Bondi Beach', area: 'Bondi Beach, Sydney NSW', minutes: 120, travel: { mode: 'bus', minutes: 30 }, reason: '', costKey: null, note: '' },
      ],
    })),
    alternatives: [{ id: 'alt-1', day: 1, replaces: 'd1-1', optional: false, slot: 'morning', kind: 'activity', title: 'Free beach swim', place: 'Bondi Beach', area: 'Sydney', minutes: 120, travel: null, reason: '', costKey: null, note: '' }],
    assumptions: [], checks: [], prices: {}, rates: {}, ...over,
  }
  const keys = [FLIGHT_OUT, FLIGHT_BACK, stayKey('Sydney'), foodKey('breakfast', 'Sydney'), foodKey('lunch', 'Sydney'), foodKey('dinner', 'Sydney'), foodKey('coffee', 'Sydney'), foodKey('snacks', 'Sydney'), foodKey('water', 'Sydney'), localKey('Sydney'), 'ticket-museum']
  for (const k of keys) p.prices[k] = fact(k, { unit: k === stayKey('Sydney') ? 'per_room_night' : k.startsWith('coffee') ? 'per_item' : 'per_person', category: k.startsWith('flight') ? 'flights' : k.startsWith('stay') ? 'accommodation' : k.startsWith('ticket') ? 'activities' : k.startsWith('local') ? 'local_transport' : 'food', ...prices[k] })
  return p
}

const form = (over: Partial<Record<string, string | string[]>> = {}): TripForm => {
  const r = readTripForm(baseForm(over), TODAY)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  return r.form
}

describe('dates and nights', () => {
  it('counts the arrival and departure days, with one fewer night', () => {
    assert.equal(tripDays('2026-12-01', '2026-12-04'), 4)
    assert.equal(tripNights(4), 3)
    assert.equal(tripDays('2026-12-01', '2026-12-01'), 1)
    assert.equal(tripNights(1), 0)
  })
  it('works out the departure date from arrival plus days, across months and years', () => {
    assert.equal(departureFor('2026-12-30', 4), '2027-01-02')
    assert.equal(departureFor('2028-02-27', 3), '2028-02-29')
    assert.deepEqual(tripDates('2026-12-31', 2), ['2026-12-31', '2027-01-01'])
  })
  it('keeps dates and days in sync whichever the traveller entered', () => {
    const byDays = readTripForm(baseForm({ by: 'days', days: '10', depart: '' }), TODAY)
    assert.equal(byDays.ok, true)
    assert.equal(byDays.form.depart, '2026-12-10')
    assert.equal(byDays.form.nights, 9)
    const byDates = readTripForm(baseForm({ depart: '2026-12-10' }), TODAY)
    assert.equal(byDates.form.days, 10)
  })
  it('rejects a departure before arrival, a past arrival and over-long trips, keeping what was typed', () => {
    const r = readTripForm(baseForm({ depart: '2026-11-30' }), TODAY)
    assert.equal(r.ok, false)
    assert.ok(r.errors.depart)
    assert.equal(r.form.destination, 'Australia')
    assert.ok(readTripForm(baseForm({ arrive: '2026-11-01' }), TODAY).errors.arrive)
    assert.ok(readTripForm(baseForm({ depart: '2027-01-30' }), TODAY).errors.depart)
  })
})

describe('the form', () => {
  it('accepts a country on its own', () => {
    assert.equal(form({ destination: 'Australia' }).destination, 'Australia')
  })
  it('asks for child ages for a family and checks the party matches the traveller type', () => {
    assert.ok(readTripForm(baseForm({ travellerType: 'family', adults: '2', children: '0' }), TODAY).errors.childAges)
    assert.ok(readTripForm(baseForm({ travellerType: 'family', adults: '2', children: '2', childAge: ['6', '20'] }), TODAY).errors.childAges)
    const f = form({ travellerType: 'family', adults: '2', children: '2', childAge: ['6', '9'] })
    assert.deepEqual(f.childAges, [6, 9])
    assert.ok(readTripForm(baseForm({ travellerType: 'couple', adults: '3' }), TODAY).errors.adults)
  })
  it('needs a budget and reads amounts typed with commas and symbols', () => {
    assert.ok(readTripForm(baseForm({ budget: '' }), TODAY).errors.budget)
    assert.equal(form({ budget: '$12,500' }).budget, 12500)
  })
  it('works out rooms: one per two adults unless the traveller says', () => {
    assert.equal(roomsFor({ adults: 1, childAges: [], rooms: null }), 1)
    assert.equal(roomsFor({ adults: 2, childAges: [6, 9], rooms: null }), 1)
    assert.equal(roomsFor({ adults: 4, childAges: [], rooms: null }), 2)
    assert.equal(roomsFor({ adults: 2, childAges: [], rooms: 2 }), 2)
  })
})

describe('itinerary answers', () => {
  const answer = (over: Record<string, unknown> = {}) => JSON.stringify({
    summary: 's', why: 'w', gateway: { needsFlight: true, arrivalAirport: 'SYD', departureAirport: 'SYD', note: '' },
    bases: [{ name: 'Sydney', region: 'NSW', nights: 2, fromDay: 1, toDay: 3, reason: '', airport: 'SYD' }],
    days: [1, 2, 3].map((d) => ({ day: d, base: 'Sydney', overnight: 'Sydney', kind: 'full', title: '', items: [{ slot: 'morning', kind: 'activity', title: 'Opera House tour', place: 'Sydney Opera House', area: 'Sydney NSW', minutes: 60, travel: { mode: 'none', minutes: 0 }, reason: '', costKey: 'ticket-opera', note: '' }] })),
    alternatives: [], costNeeds: [{ key: 'ticket-opera', label: 'Tour', category: 'activities', unit: 'per_person', detail: '' }], assumptions: [], checks: [], ...over,
  })
  it('accepts a route whose nights match the trip, and numbers the items', () => {
    const r = readItinerary(answer(), { arrive: '2026-12-01', days: 3 })
    assert.equal(r.days.length, 3)
    assert.equal(r.days[0].kind, 'arrival')
    assert.equal(r.days[2].kind, 'departure')
    assert.equal(r.days[0].items[0].id, 'd1-1')
    assert.equal(r.days[2].date, '2026-12-03')
  })
  it('refuses a route whose nights do not add up, or missing days', () => {
    assert.throws(() => readItinerary(answer({ bases: [{ name: 'Sydney', nights: 5, fromDay: 1, toDay: 3 }] }), { arrive: '2026-12-01', days: 3 }))
    assert.throws(() => readItinerary(answer({ days: [] }), { arrive: '2026-12-01', days: 3 }))
    assert.throws(() => readItinerary('not json', { arrive: '2026-12-01', days: 3 }))
  })
})

describe('prices from research', () => {
  const needs = [{ key: 'ticket-opera', label: 'Opera House tour', category: 'activities' as const, unit: 'per_person' as const, detail: '' }, { key: 'flight:outbound', label: 'Flight', category: 'flights' as const, unit: 'per_person' as const, detail: '' }]
  const sources = [{ url: 'https://www.sydneyoperahouse.com/tours', title: 'Tours' }]
  it('keeps a price only when its source was in the search results', () => {
    const r = readPrices({ prices: [{ key: 'ticket-opera', type: 'published', currency: 'AUD', low: 45, high: 45, working: 45, sourceUrl: 'https://www.sydneyoperahouse.com/tours' }, { key: 'flight:outbound', currency: 'AUD', low: 400, high: 600, working: 500, sourceUrl: 'https://made-up.example/flights' }] }, sources, needs, '2026-11-05')
    assert.equal(r.prices['ticket-opera'].type, 'published')
    assert.equal(r.prices['flight:outbound'].type, 'unavailable')
  })
  it('never calls a single price an average', () => {
    const r = readPrices({ prices: [{ key: 'ticket-opera', type: 'estimate', currency: 'AUD', low: 40, high: 50, working: 45, sampleSize: 1, sourceUrl: 'https://www.sydneyoperahouse.com/tours' }] }, sources, needs, '2026-11-05')
    assert.match(priceBasisText(r.prices['ticket-opera']), /Single price/)
    assert.match(priceBasisText({ ...r.prices['ticket-opera'], sampleSize: 6 }), /6 comparable/)
  })
  it('rejects nonsense numbers and keeps only sourced exchange rates', () => {
    const r = readPrices({ prices: [{ key: 'ticket-opera', currency: 'AUD', low: 50, high: 10, working: 20, sourceUrl: 'https://www.sydneyoperahouse.com/tours' }], rates: [{ currency: 'USD', perAud: 0.65, sourceUrl: 'https://www.sydneyoperahouse.com/tours' }, { currency: 'EUR', perAud: 0.6, sourceUrl: 'https://nope.example' }] }, sources, needs, '2026-11-05')
    assert.equal(r.prices['ticket-opera'].type, 'unavailable')
    assert.ok(r.rates.USD)
    assert.equal(r.rates.EUR, undefined)
  })
})

describe('budget arithmetic', () => {
  it('solo: every cost is counted once and the days plus one-time costs reconcile with the total', () => {
    const f = form()
    const b = calculateBudget(f, plan(4), DEFAULT_SELECTION)
    assert.equal(b.incomplete, false)
    const flights = b.lines.filter((l) => l.category === 'flights')
    assert.equal(flights.length, 2)
    const stay = b.lines.filter((l) => l.category === 'accommodation')
    assert.equal(stay.length, 1)
    assert.equal(stay[0].working, 3000, 'A$10 × 1 room × 3 nights')
    const sumDays = b.byDay.reduce((a, d) => a + d.working, 0)
    assert.equal(sumDays + b.oneTime.working + b.contingency.working, b.total.working)
    assert.equal(b.perPerson, b.total.working)
  })
  it('couple: per-person prices double, rooms do not', () => {
    const b = calculateBudget(form({ travellerType: 'couple', adults: '2' }), plan(4), DEFAULT_SELECTION)
    assert.equal(b.lines.find((l) => l.id === FLIGHT_OUT)!.working, 2000)
    assert.equal(b.lines.find((l) => l.category === 'accommodation')!.working, 3000)
    assert.equal(b.perPerson, Math.round(b.total.working / 2))
  })
  it('family: child prices, free under-age children and family passes', () => {
    const f = form({ travellerType: 'family', adults: '2', children: '2', childAge: ['3', '9'] })
    const p = plan(4, {}, { 'ticket-museum': { low: 30, high: 30, working: 30, childLow: 15, childHigh: 15, childMaxAge: 15, freeUnderAge: 4 } })
    const line = calculateBudget(f, p, DEFAULT_SELECTION).lines.find((l) => l.id === 'item-d2-1')!
    assert.equal(line.working, 2 * 3000 + 1500, '2 adults × 30 + one child × 15; the 3-year-old is free')
    assert.match(line.quantity, /2 adults.*1 child.*1 free/)
    const pass = amountFor(fact('x', { low: 30, high: 30, working: 30, childLow: 15, childHigh: 15, familyPass: { amount: 60, adults: 2, children: 2 } }), { adults: 2, childAges: [6, 9] }, { currency: 'AUD', rates: {}, rooms: 1 })!
    assert.equal(pass.working, 6000)
    assert.match(pass.quantity, /Family pass/)
  })
  it('a booked flight replaces the estimate, and paid amounts are shown as paid', () => {
    const f = form({ flightBooked: 'on', flightAmount: '1200', flightPaid: 'on' })
    const b = calculateBudget(f, plan(4), DEFAULT_SELECTION)
    const flights = b.lines.filter((l) => l.category === 'flights')
    assert.equal(flights.length, 1)
    assert.equal(flights[0].status, 'booking')
    assert.equal(b.paid, 120000)
    assert.equal(b.toPay, b.total.working - 120000)
  })
  it('a booked flight without an amount is missing, not zero', () => {
    const b = calculateBudget(form({ flightBooked: 'on' }), plan(4), DEFAULT_SELECTION)
    assert.equal(b.incomplete, true)
  })
  it('breakfast included with the accommodation is not charged on mornings after a night there', () => {
    const f = form({ breakfastIncluded: 'on' })
    const b = calculateBudget(f, plan(4), DEFAULT_SELECTION)
    assert.equal(b.lines.find((l) => l.id === 'd2-breakfast')!.status, 'included')
    assert.equal(b.lines.find((l) => l.id === 'd2-breakfast')!.working, 0)
  })
  it('arrival and departure times change the meals on those days', () => {
    const d = { day: 1, date: '', base: 'Sydney', overnight: '', kind: 'arrival' as const, title: '', items: [] }
    assert.deepEqual(mealsOn(d, { arrivalTime: 'afternoon', departureTime: null, breakfastIncluded: false }).paid, ['dinner'])
    assert.deepEqual(mealsOn({ ...d, day: 4, kind: 'departure' }, { arrivalTime: null, departureTime: 'morning', breakfastIncluded: false }).paid, ['breakfast'])
  })
  it('a missing flight price marks the total incomplete and is never counted as zero', () => {
    const p = plan(4)
    p.prices[FLIGHT_OUT] = { ...p.prices[FLIGHT_OUT], type: 'unavailable' }
    const b = calculateBudget(form(), p, DEFAULT_SELECTION)
    assert.equal(b.incomplete, true)
    assert.ok(b.missing.some((m) => m.category === 'flights'))
    assert.equal(b.lines.find((l) => l.id === FLIGHT_OUT)!.status, 'unavailable')
  })
  it('converts other currencies at a sourced rate, and marks the line missing without one', () => {
    const p = plan(4, {}, { 'ticket-museum': { currency: 'USD', low: 13, high: 13, working: 13 } })
    const without = calculateBudget(form(), p, DEFAULT_SELECTION)
    assert.equal(without.lines.find((l) => l.id === 'item-d2-1')!.status, 'unavailable')
    p.rates.USD = { currency: 'USD', perAud: 0.65, sourceName: 'RBA', sourceUrl: 'https://example.test/rates', checkedAt: '' }
    const withRate = calculateBudget(form(), p, DEFAULT_SELECTION)
    assert.equal(withRate.lines.find((l) => l.id === 'item-d2-1')!.working, 2000, 'US$13 ÷ 0.65 = A$20')
  })
  it('shows the budget remaining or over', () => {
    const b = calculateBudget(form({ budget: '100' }), plan(4), DEFAULT_SELECTION)
    assert.ok(b.remaining! < 0)
  })
  it('asks the research step for flights, each base\'s stay, meals and transport', () => {
    const needs = structuralNeeds(form(), plan(4))
    assert.ok(needs.some((n) => n.key === FLIGHT_OUT))
    assert.ok(needs.some((n) => n.key === stayKey('Sydney')))
    assert.ok(needs.some((n) => n.key === localKey('Sydney')))
    assert.equal(structuralNeeds(form({ flightBooked: 'on' }), plan(4)).some((n) => n.category === 'flights'), false)
  })
})

describe('changing activities', () => {
  it('replacing a paid attraction with a free beach removes its charge and updates the totals', () => {
    const p = plan(4)
    const before = calculateBudget(form(), p, DEFAULT_SELECTION)
    const sel = applyChange(p, DEFAULT_SELECTION, { op: 'replace', item: 'd1-1', with: 'alt-1' }, false)
    const after = calculateBudget(form(), p, sel)
    assert.equal(after.lines.some((l) => l.id === 'item-d1-1'), false)
    assert.equal(before.total.working - after.total.working, Math.round(1000 * 1.1), 'A$10 ticket plus its 10% contingency')
    assert.equal(selectedItems(p, sel).get(1)![0].title, 'Free beach swim')
  })
  it('an unselected alternative is not counted', () => {
    const p = plan(4)
    p.alternatives.push({ id: 'alt-2', day: 2, replaces: null, optional: true, slot: 'evening', kind: 'activity', title: 'Harbour cruise', place: '', area: '', minutes: 90, travel: null, reason: '', costKey: 'ticket-museum', note: '' })
    const b = calculateBudget(form(), p, DEFAULT_SELECTION)
    assert.equal(b.lines.some((l) => l.label === 'Harbour cruise'), false)
    const added = calculateBudget(form(), p, applyChange(p, DEFAULT_SELECTION, { op: 'add', alt: 'alt-2' }, false))
    assert.equal(added.lines.find((l) => l.label === 'Harbour cruise')!.category, 'extras')
  })
  it('locked days cannot be changed before payment', () => {
    const p = plan(6)
    assert.throws(() => applyChange(p, DEFAULT_SELECTION, { op: 'remove', item: 'd5-1' }, false))
    assert.doesNotThrow(() => applyChange(p, DEFAULT_SELECTION, { op: 'remove', item: 'd5-1' }, true))
  })
})

describe('the free preview', () => {
  it('shows every day of a trip of three days or fewer', () => {
    const v = tripView(form({ depart: '2026-12-03' }), plan(3), DEFAULT_SELECTION, false)
    assert.equal(v.days.every((d) => !d.locked), true)
  })
  it('sends only the first three days of a longer trip, but the full total', () => {
    const p = plan(7)
    const v = tripView(form({ depart: '2026-12-07' }), p, DEFAULT_SELECTION, false)
    assert.equal(v.days.filter((d) => !d.locked).length, 3)
    const json = JSON.stringify(v)
    assert.equal(json.includes('Museum 5'), false, 'a locked day\'s activity must not be in the data sent to the browser')
    assert.equal(json.includes('Bondi Beach walk 6'), false)
    const full = calculateBudget(form({ depart: '2026-12-07' }), p, DEFAULT_SELECTION)
    assert.equal(v.budget.total.working, full.total.working, 'the preview total matches the full trip')
    assert.equal(v.budget.lines.reduce((a, l) => a + l.working, 0), full.known.working, 'the redacted lines still add up')
  })
  it('shows every day once unlocked', () => {
    const v = tripView(form({ depart: '2026-12-07' }), plan(7), DEFAULT_SELECTION, true)
    assert.equal(v.days.every((d) => !d.locked), true)
    assert.ok(JSON.stringify(v).includes('Museum 5'))
  })
})
