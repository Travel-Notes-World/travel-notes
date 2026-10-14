/**
 * Activity choices, the daily timeline and day trips (Phase A, part 2): only the chosen option of a
 * part of the day is counted, replacing an activity changes the total straight away, days follow
 * arrival and departure times, and a day trip adds its fare to that day.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { newMember, payload, places, rejects, setup, type Any } from './helpers'

let CH: Any, CHOOSE: Any, TL: Any, TB: Any, P: Any, DET: Any, C: Any

const NOW = new Date('2026-10-14T00:00:00Z')
const priceCheck = (data: Any) => payload.create({ collection: 'price-checks', data: { currency: 'AUD', basis: 'person', kind: 'published', sourceName: 'Official', sourceUrl: 'https://example.test/x', checkedAt: '2026-10-01T00:00:00.000Z', ...data } as Any })
const option = (id: string, title: string, priceId: string | null = null) => ({ id, title, place: 'Kyoto', notes: '', origin: 'ai_idea', sourcePath: null, priceId, minutes: 90 })

async function planWithChoices(member: Any, priceA: string, priceB: string) {
  const plan = await P.createPlanFromPlanner(member, { title: 'Kyoto', start: '2026-11-02', days: [0, 1, 2, 3].map((i) => ({ title: 'Kyoto', date: `2026-11-0${i + 2}` })), placeIds: [places.kyoto.id], party: 'family', pace: 'balanced', purpose: 'holiday' })
  const slots = [
    { time: 'morning', selected: 'a', locked: false, options: [option('a', 'Zoo', priceA), option('b', 'Aquarium', priceB), option('c', 'Park walk')] },
    { time: 'afternoon', selected: 'c', locked: false, options: [option('c', 'Museum'), option('d', 'Garden')] },
  ]
  await payload.update({ collection: 'plans', id: plan.id, data: { choices: { days: [0, 1, 2, 3].map(() => ({ dayTrip: null, slots })) } } as Any })
  await DET.updateTripDetails(member, plan.id, { purpose: 'holiday', adults: '2', childAges: '3, 10', arrival: 'evening', departure: 'morning', contingency: '0' })
  return plan.id as string
}

before(async () => {
  await setup()
  CH = await import('../../src/lib/planner/choices')
  CHOOSE = await import('../../src/lib/planner/choose')
  TL = await import('../../src/lib/planner/timeline')
  TB = await import('../../src/lib/planner/trip-budget')
  P = await import('../../src/lib/community/plans')
  DET = await import('../../src/lib/planner/details')
  C = await import('../../src/lib/planner/costs')
})

describe('the shape of each day', () => {
  it('leaves room only for what fits after arrival and before departure', () => {
    const s = { arrival: 'evening', departure: 'afternoon' }
    assert.deepEqual(TL.activeSlots(s, 'balanced', 0, 4), [], 'a late arrival gets no activities')
    assert.deepEqual(TL.activeSlots(s, 'balanced', 1, 4), ['morning', 'afternoon', 'evening'])
    assert.deepEqual(TL.activeSlots(s, 'relaxed', 1, 4), ['morning', 'afternoon'])
    assert.deepEqual(TL.activeSlots(s, 'balanced', 3, 4), ['morning'])
    assert.deepEqual(TL.activeSlots({ arrival: 'morning', departure: 'evening' }, 'full', 0, 1), ['afternoon'])
  })

  it('builds a timeline with meals, rest, the chosen activity and the night', () => {
    const setup = { ...C.DEFAULT_SETUP, arrival: 'afternoon', departure: 'morning' }
    const choice = { dayTrip: null, slots: [{ id: 'd1-morning', time: 'morning', selected: 'a', locked: false, options: [option('a', 'Zoo')] }] }
    const middle = TL.dayTimeline({ day: 1, days: 3, setup, pace: 'balanced', choice, lines: [], placeName: 'Kyoto' })
    const titles = middle.map((e: Any) => e.title)
    assert.deepEqual(titles.slice(0, 2), ['Breakfast', 'Zoo'])
    assert.ok(titles.indexOf('Lunch') < titles.indexOf('Dinner'))
    assert.ok(titles.includes('Free time or rest'))
    assert.equal(titles.at(-1), 'Back to your accommodation')
    const arrival = TL.dayTimeline({ day: 0, days: 3, setup, pace: 'balanced', choice, lines: [], placeName: 'Kyoto' }).map((e: Any) => e.title)
    assert.equal(arrival[0], 'Arrive in Kyoto')
    assert.ok(!arrival.includes('Zoo'), 'no morning activity on an afternoon arrival')
    const leaving = TL.dayTimeline({ day: 2, days: 3, setup, pace: 'balanced', choice, lines: [], placeName: 'Kyoto' }).map((e: Any) => e.title)
    assert.ok(leaving.includes('Check out and travel to the airport'))
    assert.ok(!leaving.includes('Zoo'))
  })
})

describe('choosing activities', () => {
  it('counts only the chosen option, with family quantities, and updates when it is replaced or removed', async () => {
    const zoo = await priceCheck({ destination: places.kyoto.id, item: 'attraction', name: 'Zoo', amount: 30, childAmount: 15, childMaxAge: 12, freeUnderAge: 4 })
    const aquarium = await priceCheck({ destination: places.kyoto.id, item: 'attraction', name: 'Aquarium', amount: 40, childAmount: 20, childMaxAge: 12 })
    const member = await newMember('Activity Picker')
    const id = await planWithChoices(member, zoo.id, aquarium.id)
    const budgetOf = async () => (await TB.planBudget(payload, await P.getPlan(member, id), NOW)).budget

    let b = await budgetOf()
    const lineDay1 = b.lines.find((l: Any) => l.id === 'activity-d1-morning')
    assert.equal(lineDay1.lowCents, 2 * 3000 + 1500, '2 adults + the 10-year-old; the 3-year-old is free')
    assert.equal(b.lines.filter((l: Any) => l.label === 'Aquarium').length, 0, 'an alternative is not counted')
    assert.equal(b.lines.filter((l: Any) => l.id.startsWith('activity-d0-')).length, 0, 'nothing on an evening-arrival day')
    assert.equal(b.lines.filter((l: Any) => l.id.startsWith('activity-d3-')).length, 0, 'nothing on a morning-departure day')
    const before = b.total.lowCents

    await CHOOSE.updateChoice(member, id, { day: 1, time: 'morning', action: 'choose', option: 'b' })
    b = await budgetOf()
    assert.equal(b.lines.find((l: Any) => l.id === 'activity-d1-morning').lowCents, 2 * 4000 + 2 * 2000, 'no free age at the aquarium')
    assert.equal(b.total.lowCents, before - 7500 + 12000, 'replacing changes the total straight away')

    await CHOOSE.updateChoice(member, id, { day: 1, time: 'morning', action: 'remove' })
    b = await budgetOf()
    assert.equal(b.lines.find((l: Any) => l.id === 'activity-d1-morning'), undefined)
    assert.equal(b.total.lowCents, before - 7500)

    const museum = b.lines.find((l: Any) => l.id === 'activity-d1-afternoon')
    assert.equal(museum.status, 'unavailable', 'an activity without a checked price is listed, not added')
    assert.match(museum.note, /not checked/)
    // Reconciliation still holds.
    assert.equal(b.byDay.reduce((a: number, d: Any) => a + d.lowCents, 0) + b.oneTime.lowCents, b.subtotal.lowCents)

    await rejects(CHOOSE.updateChoice(member, id, { day: 9, time: 'morning', action: 'choose', option: 'a' }), 'validation')
    await rejects(CHOOSE.updateChoice(member, id, { day: 1, time: 'evening', action: 'choose', option: 'a' }), 'not_found')
    await rejects(CHOOSE.updateChoice(member, id, { day: 1, time: 'afternoon', action: 'choose', option: 'zzz' }), 'not_found')
    const stranger = await newMember('Stranger')
    await rejects(CHOOSE.updateChoice(stranger, id, { day: 1, time: 'morning', action: 'choose', option: 'a' }), 'not_found')
  })

  it('reads stored choices safely', () => {
    const c = CH.readChoices({ days: [{ slots: [{ time: 'noon', selected: 'x', options: [{ title: '' }, { id: 'BAD ID', title: 'Ok', origin: 'travel_notes', sourcePath: 'https://evil.test', priceId: 'nope', minutes: 99999 }] }] }] }, 2)
    assert.equal(c.days.length, 2)
    const o = c.days[0].slots[0].options[0]
    assert.deepEqual([o.title, o.origin, o.sourcePath, o.priceId, o.minutes], ['Ok', 'ai_idea', null, null, null])
    assert.equal(c.days[0].slots[0].selected, null)
  })
})

describe('day trips', () => {
  it('adds the fare there and back to that day, and only for a full day', async () => {
    await payload.update({ collection: 'destinations', id: places.kyoto.id, data: { latitude: 35.0116, longitude: 135.7681 } as Any })
    const osaka = await payload.create({ collection: 'destinations', data: { name: 'Osaka', slug: 'osaka', kind: 'city', parent: places.japan.id, summary: 'Test.', seo: { title: 'Osaka', description: 'Test.' }, _status: 'published', latitude: 34.6937, longitude: 135.5023, population: 2700000 } as Any })
    await priceCheck({ destination: places.kyoto.id, toDestination: osaka.id, item: 'intercity', name: 'Kyoto to Osaka train', amount: 10, childAmount: 5, basis: 'journey' })
    const member = await newMember('Day Tripper')
    const id = await planWithChoices(member, '', '')
    await rejects(CHOOSE.setDayTrip(member, id, { day: 0, place: osaka.id }), 'validation')
    await rejects(CHOOSE.setDayTrip(member, id, { day: 1, place: places.bangkok.id }), 'validation')
    await CHOOSE.setDayTrip(member, id, { day: 2, place: osaka.id })
    const view = await P.getPlan(member, id)
    const { budget } = await TB.planBudget(payload, view, NOW)
    const legs = budget.lines.filter((l: Any) => l.id.startsWith('daytrip-2-'))
    assert.equal(legs.length, 2)
    assert.equal(legs[0].day, 2)
    // 2 adults × A$10 + the 10-year-old × A$5 + the 3-year-old × A$5 (no free age given) = A$30 each way.
    assert.equal(legs[0].lowCents, 3000)
    assert.match(legs[1].note, /assumed to cost the same/)
    assert.equal(budget.lines.filter((l: Any) => l.id.startsWith('activity-d2-')).length, 0, 'the day trip replaces that day’s activities')
    await CHOOSE.setDayTrip(member, id, { day: 2, place: '' })
    assert.equal((await P.getPlan(member, id)).choices.days[2].dayTrip, null)
  })
})
