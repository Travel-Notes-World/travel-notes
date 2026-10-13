/**
 * Trip Planner: reading the page address, sharing days between places, the months and dates of a
 * trip, and the draft built from published content only (checked months, sourced facts, updates,
 * guides, trip reports and activities on the dates). Saving a draft makes a private plan.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { activityInput, newMember, payload, places, published, setup, tripInput, type Any } from './helpers'

let I: Any, L: Any, D: Any, P: Any

before(async () => {
  await setup()
  I = await import('../../src/lib/planner/input')
  L = await import('../../src/lib/planner/load')
  D = await import('../../src/lib/content/destinations')
  P = await import('../../src/lib/community/plans')
})

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

describe('reading the planner address', () => {
  it('uses safe defaults and ignores anything it does not recognise', () => {
    const { input, errors, submitted } = I.readPlannerInput({})
    assert.equal(submitted, false)
    assert.deepEqual(errors, {})
    assert.equal(input.days, 7)
    assert.equal(input.pace, 'balanced')
    assert.equal(input.party, null)
    const odd = I.readPlannerInput({ to: ['not-an-id', U1], with: 'aliens', pace: 'warp', month: 'Smarch' })
    assert.deepEqual(odd.input.placeIds, [U1])
    assert.equal(odd.input.party, null)
    assert.equal(odd.input.pace, 'balanced')
    assert.equal(odd.input.month, null)
  })

  it('checks dates and the number of days', () => {
    assert.equal(I.readPlannerInput({ start: '2026-02-30' }).errors.start, 'Enter a valid start date.')
    assert.match(I.readPlannerInput({ days: '45' }).errors.days, /between 1 and 30/)
    assert.match(I.readPlannerInput({ days: '2.5' }).errors.days, /between 1 and 30/)
    const withStart = I.readPlannerInput({ start: '2026-05-01', month: 'dec' }).input
    assert.equal(withStart.month, null, 'an exact date wins over a month')
    assert.equal(I.readPlannerInput({ month: 'October' }).input.month, 'oct')
  })

  it('plans up to five places and says so when more are chosen', () => {
    const ids = Array.from({ length: 7 }, (_, i) => `${i}${U1.slice(1)}`)
    const { input, errors } = I.readPlannerInput({ to: ids.join(',') })
    assert.equal(input.placeIds.length, 5)
    assert.match(errors.to, /up to 5/)
  })

  it('shares days between places evenly, or as the traveller asked', () => {
    assert.deepEqual(I.evenSplit(7, 2), [4, 3])
    assert.deepEqual(I.readPlannerInput({ to: [U1, U2], days: '7' }).input.split, [4, 3])
    const asked = I.readPlannerInput({ to: [U1, U2], days: '7', split: '2,6' }).input
    assert.deepEqual(asked.split, [2, 6])
    assert.equal(asked.days, 8, 'the total follows the days chosen for each place')
    const zero = I.readPlannerInput({ to: [U1, U2], days: '6', split: '0,6' })
    assert.deepEqual(zero.input.split, [3, 3])
    assert.match(zero.errors.split, /at least one day/)
    const tooLong = I.readPlannerInput({ to: [U1, U2], split: '20,20' })
    assert.match(tooLong.errors.split, /up to 30 days/)
    assert.equal(I.readPlannerInput({ to: [U1, U2], days: '1' }).input.days, 2, 'every place gets at least one day')
  })

  it('writes short, shareable addresses that read back the same', () => {
    const { input } = I.readPlannerInput({ to: [U1, U2], start: '2026-05-01', days: '9', with: 'couple', pace: 'relaxed' })
    const href = I.plannerHref(input)
    assert.equal(href, `/trip-planner?to=${U1}&to=${U2}&start=2026-05-01&days=9&split=5%2C4&with=couple&pace=relaxed`)
    const back = I.readPlannerInput(Object.fromEntries([...new URLSearchParams(href.split('?')[1])].reduce((m: Map<string, string[]>, [k, v]) => m.set(k, [...(m.get(k) ?? []), v]), new Map())))
    assert.deepEqual(back.input, input)
    assert.equal(I.plannerHref({ placeIds: [] }), '/trip-planner')
  })

  it('lays out days with dates and the months the trip touches', () => {
    const days = I.planDays({ start: '2026-04-29', split: [2, 2] })
    assert.deepEqual(days.map((d: Any) => d.date), ['2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02'])
    assert.deepEqual(days.map((d: Any) => d.placeIndex), [0, 0, 1, 1])
    assert.equal(days[2].firstInPlace, true)
    assert.deepEqual(I.tripMonths({ start: '2026-04-29', month: null, days: 4 }), ['apr', 'may'])
    assert.deepEqual(I.tripMonths({ start: null, month: 'nov', days: 4 }), ['nov'])
    assert.equal(I.planDays({ start: null, split: [3] })[2].date, null)
    assert.equal(I.addDays('2028-02-28', 1), '2028-02-29', 'leap years are calendar days')
  })
})

describe('the draft plan', () => {
  before(async () => {
    await payload.update({
      collection: 'destinations',
      id: places.kyoto.id,
      data: { bestMonths: ['apr', 'oct'], goodMonths: ['may'], whenToGo: 'Spring and autumn are mild and colourful, and also the busiest times of year.', timeNeeded: '3 to 4 days', _status: 'published' } as Any,
    })
    await payload.update({
      collection: 'destinations',
      id: places.japan.id,
      data: {
        facts: [
          { kind: 'visa', value: 'Check the rules for Australians.', sourceName: 'Smartraveller', sourceUrl: 'https://www.smartraveller.gov.au/' },
          { kind: 'currency', value: 'Japanese yen (JPY)' },
        ],
        factsCheckedAt: '2026-10-11T00:00:00.000Z',
        _status: 'published',
      } as Any,
    })
  })

  const pageFor = (doc: Any) => D.loadDestinationPage(payload, doc)
  const plan = (params: Any, community = true) => {
    const { input } = I.readPlannerInput(params)
    return L.loadPlanner(payload, input, { pageFor, months: I.tripMonths(input), community })
  }

  it('rates the travel months from the editor’s months only', async () => {
    const may = await plan({ to: places.kyoto.id, start: '2026-04-28', days: '5' })
    const kyoto = may.places[0]
    assert.deepEqual(kyoto.timing, [{ month: 'apr', rating: 'best' }, { month: 'may', rating: 'good' }])
    assert.equal(L.timingSummary(kyoto.timing), 'good')
    assert.equal(kyoto.timeNeeded, '3 to 4 days')
    const bangkok = (await plan({ to: places.bangkok.id, month: 'jan' })).places[0]
    assert.equal(bangkok.timing, null, 'no months rated: nothing is guessed')
  })

  it('lists sourced checks for the country, everyday facts apart, and no unsourced checks', async () => {
    const result = await plan({ to: places.kyoto.id })
    assert.equal(result.countries.length, 1)
    const japan = result.countries[0]
    assert.equal(japan.name, 'Japan')
    assert.equal(japan.isoCode, 'JP')
    assert.deepEqual(japan.checks.map((f: Any) => f.kind), ['visa'])
    assert.equal(japan.checks[0].source.name, 'Smartraveller')
    assert.deepEqual(japan.handy.map((f: Any) => f.kind), ['currency'])
    assert.ok(japan.checkedAt)
  })

  it('brings in travel updates that apply to the trip, once each', async () => {
    const writer = await payload.create({ collection: 'authors', data: { name: 'Planner writer', slug: `pw-${Date.now()}`, biography: 'Bio' } as Any })
    const update = await payload.create({
      collection: 'travel-updates',
      data: {
        title: 'Test: temple closure in Kyoto', slug: `kyoto-closure-${Date.now()}`, summary: 'A test update about a closure.', category: 'closures', author: writer.id,
        destinations: [places.kyoto.id, places.japan.id], sources: [{ name: 'Official site', url: 'https://example.com/notice' }], _status: 'published',
      } as Any,
    })
    const result = await plan({ to: [places.kyoto.id, places.japan.id] })
    assert.equal(result.updates.filter((u: Any) => u.id === update.id).length, 1)
  })

  it('suggests approved trip reports and only the activities on the trip dates', async () => {
    const member = await newMember('Planner Tester')
    const trip = await published(member, 'trip', tripInput())
    const soon = await published(member, 'activity', activityInput({ title: 'Morning market walk for visitors' }, 10))
    const later = await published(member, 'activity', activityInput({ title: 'Evening river walk for visitors' }, 60))
    const start = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10)

    const kyoto = (await plan({ to: places.kyoto.id })).places[0]
    assert.ok(kyoto.trips.some((c: Any) => c.id === trip.id))
    const bangkok = (await plan({ to: places.bangkok.id, start, days: '5' })).places[0]
    assert.ok(bangkok.activities.some((c: Any) => c.id === soon.id))
    assert.ok(!bangkok.activities.some((c: Any) => c.id === later.id), 'an activity after the trip is not suggested')
    const noDates = (await plan({ to: places.bangkok.id })).places[0]
    assert.equal(noDates.activities.length, 0, 'without dates no activities are matched')
    const closed = (await plan({ to: places.kyoto.id }, false)).places[0]
    assert.equal(closed.trips.length, 0, 'community posts are left out while the community is closed')
  })

  it('leaves out places that are not published and shares their days with the rest', async () => {
    const draft = await payload.create({ collection: 'destinations', data: { name: 'Hidden Draft', slug: `hidden-${Date.now()}`, kind: 'city', parent: places.japan.id, summary: 'Draft.', _status: 'draft' } as Any, draft: true })
    const result = await plan({ to: [places.kyoto.id, draft.id], days: '6' })
    assert.equal(result.missing, 1)
    assert.deepEqual(result.places.map((p: Any) => [p.name, p.days]), [['Kyoto', 6]])
  })
})

describe('saving a plan', () => {
  it('creates a private plan with a day for each trip day, named after its place', async () => {
    const member = await newMember('Saver')
    const days = I.planDays({ start: '2026-05-01', split: [2, 1] }).map((d: Any) => ({ title: d.placeIndex ? 'Bangkok' : 'Kyoto', date: d.date }))
    const { id } = await P.createPlanFromPlanner(member, { title: 'Kyoto and Bangkok, May 2026', start: '2026-05-01', days, placeIds: [places.kyoto.id, places.bangkok.id], party: 'couple', pace: 'relaxed' })
    const view = await P.getPlan(member, id)
    assert.equal(view.title, 'Kyoto and Bangkok, May 2026')
    assert.equal(view.startDate, '2026-05-01')
    assert.equal(view.endDate, '2026-05-03')
    assert.deepEqual(view.days.map((d: Any) => [d.title, d.date]), [['Kyoto', '2026-05-01'], ['Kyoto', '2026-05-02'], ['Bangkok', '2026-05-03']])
    assert.deepEqual(view.planner, { placeIds: [places.kyoto.id, places.bangkok.id], party: 'couple', pace: 'relaxed' })

    const other = await newMember('Someone Else')
    await assert.rejects(P.getPlan(other, id), /could not be found/)
  })

  it('keeps the planner details when the plan is edited later', async () => {
    const member = await newMember('Editor Of Plans')
    const { id } = await P.createPlanFromPlanner(member, { title: 'Kyoto trip', start: null, days: [{ title: 'Kyoto', date: null }], placeIds: [places.kyoto.id], party: null, pace: 'full' })
    await P.updatePlan(member, id, { title: 'Kyoto trip, renamed', days: [{ title: 'Kyoto', stops: [{ title: 'Morning walk' }] }] })
    const view = await P.getPlan(member, id)
    assert.equal(view.days[0].stops[0].title, 'Morning walk')
    assert.deepEqual(view.planner, { placeIds: [places.kyoto.id], party: null, pace: 'full' })
  })

  it('needs a signed-in member', async () => {
    await assert.rejects(P.createPlanFromPlanner(null, { title: 'x', start: null, days: [], placeIds: [], party: null, pace: null }), /sign in/i)
  })
})
