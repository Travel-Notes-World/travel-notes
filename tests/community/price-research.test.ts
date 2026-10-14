/**
 * AI price research: typical prices are looked up online and saved with their source, but only when
 * the source is a page the searches really returned and the numbers are sensible. Prices in another
 * currency are converted at a cited rate. The model is a fake, so no network is used.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { newMember, payload, places, setup, type Any } from './helpers'

let AI: Any, R: Any, PR: Any, P: Any, TB: Any

const NOW = new Date('2026-10-14T00:00:00Z')
const SOURCES = [{ url: 'https://www.example-guide.test/kyoto-costs', title: 'Kyoto costs 2026', pageAge: null }, { url: 'https://zoo.example.test/tickets/', title: 'Zoo tickets', pageAge: null }, { url: 'https://bank.example.test/rates', title: 'Rates', pageAge: null }]
let reply: Any = {}
let calls = 0
const fake = {
  async generate() { throw new Error('not used') },
  async research(r: Any) {
    calls++
    lastPrompt = r.prompt
    return { text: `Here is what I found.\n\`\`\`json\n${JSON.stringify(reply)}\n\`\`\``, sources: SOURCES, inputTokens: 20000, outputTokens: 800, searches: 4, stopReason: 'end_turn' }
  },
}
let lastPrompt = ''
const price = (item: string, low: number, high: number, over: Any = {}) => ({ item, low, high, basis: 'person', sourceUrl: SOURCES[0].url, sourceName: 'Kyoto costs', quote: `${item} costs about ${low}`, ...over })

before(async () => {
  await setup()
  AI = await import('../../src/lib/planner/ai')
  R = await import('../../src/lib/planner/research')
  PR = await import('../../src/lib/planner/prices')
  P = await import('../../src/lib/community/plans')
  TB = await import('../../src/lib/planner/trip-budget')
  AI.setAiGatewayForTests(fake)
  await payload.updateGlobal({ slug: 'community-settings', data: { planner: { aiEnabled: true, model: 'claude-sonnet-5-5', dailyBudgetUsd: 5, freePlans: 1, priceAud: 9.99, revisionsPerPlan: 2 } } as Any })
})
after(() => AI.setAiGatewayForTests(null))

describe('researching a place', () => {
  it('saves sourced, sensible prices and converts them at a cited rate', async () => {
    reply = {
      currency: 'JPY',
      prices: [
        price('lunch', 1000, 1800),
        price('dinner', 2500, 4000, { sourceUrl: 'https://made-up.test/page' }),
        price('coffee', 400, 9000, { basis: 'item' }),
        price('stay_mid', 15000, 25000, { basis: 'room_night', sourceUrl: 'https://www.example-guide.test/kyoto-costs/' }),
        price('not_an_item', 1, 2),
      ],
      exchangeRate: { perAud: 100, sourceUrl: SOURCES[2].url, sourceName: 'Bank' },
    }
    const result = await R.researchPlace(payload, places.kyoto.id, { now: NOW })
    assert.equal(result.saved, 2, 'lunch and the hotel; not the made-up source, the silly range or the unknown item')
    const { find } = await PR.loadPriceFinder(payload, [places.kyoto.id])
    const lunch = find('lunch', places.kyoto.id)
    assert.deepEqual([lunch.lowCents, lunch.highCents, lunch.method, lunch.fx.currency], [1000, 1800, 'ai_research', 'JPY'], '¥1,000 at ¥100 = A$10')
    assert.equal(find('dinner', places.kyoto.id), null)
    assert.equal(find('stay_mid', places.kyoto.id).basis, 'room_night')
    const runs = (await payload.find({ collection: 'ai-runs', where: { kind: { equals: 'research' } }, depth: 0 })).docs as Any[]
    assert.equal(runs[0].status, 'ok')
    assert.equal(runs[0].searches, 4)
    assert.ok(runs[0].costMicroUsd >= 40_000, 'searches are counted in the cost')
  })

  it('does not research again within a day, unless asked, and replaces an old result', async () => {
    const before = calls
    assert.equal((await R.researchPlace(payload, places.kyoto.id, { now: NOW })).skipped, 'researched recently')
    assert.equal(calls, before)
    reply = { currency: 'JPY', prices: [price('dinner', 2500, 4000)], exchangeRate: null }
    await R.researchPlace(payload, places.kyoto.id, { now: NOW, force: true })
    assert.match(lastPrompt, /dinner/)
    assert.doesNotMatch(lastPrompt, /- lunch:/, 'only what is still missing is asked for')
    const { find } = await PR.loadPriceFinder(payload, [places.kyoto.id])
    assert.equal(find('dinner', places.kyoto.id).lowCents, 2500)
  })

  it('skips items an editor has priced for the country, and stops at the daily limit', async () => {
    await payload.create({ collection: 'price-checks', data: { destination: places.thailand.id, item: 'coffee', amount: 3, basis: 'item', currency: 'AUD', kind: 'estimate', sourceName: 'Editor', sourceUrl: 'https://example.test/c', checkedAt: '2026-10-01T00:00:00.000Z' } as Any })
    const missing = await R.missingCoreItems(payload, places.bangkok.id, NOW)
    assert.ok(!missing.includes('coffee'))
    assert.ok(missing.includes('lunch'))
    const big = await payload.create({ collection: 'ai-runs', data: { model: 'claude-sonnet-5-5', kind: 'detailed', status: 'ok', costMicroUsd: 5_000_000 } as Any })
    assert.equal((await R.researchPlace(payload, places.bangkok.id, { now: NOW })).skipped, 'daily AI limit reached')
    await payload.delete({ collection: 'ai-runs', id: big.id })
  })
})

describe('researching a plan', () => {
  it('finds entry prices for the activity options and links them, so the budget counts them', async () => {
    const member = await newMember('Researcher')
    const plan = await P.createPlanFromPlanner(member, { title: 'Kyoto', start: '2026-11-02', days: [0, 1, 2].map((i) => ({ title: 'Kyoto', date: `2026-11-0${i + 2}` })), placeIds: [places.kyoto.id], party: 'couple', pace: 'balanced', purpose: 'holiday' })
    const opt = (id: string, title: string) => ({ id, title, place: 'Kyoto', notes: '', origin: 'ai_idea', sourcePath: null, priceId: null, minutes: 60 })
    await payload.update({ collection: 'plans', id: plan.id, data: { choices: { days: [0, 1, 2].map(() => ({ dayTrip: null, slots: [{ time: 'afternoon', selected: 'a', options: [opt('a', 'City Zoo'), opt('b', 'Unknown thing')] }] })) } } as Any })
    reply = { currency: 'JPY', prices: [], attractions: [{ title: 'City Zoo', name: 'City Zoo adult entry', low: 600, high: 600, childLow: 200, childMaxAge: 15, freeUnderAge: 6, free: false, sourceUrl: SOURCES[1].url, sourceName: 'City Zoo', quote: 'Adults ¥600' }] }
    await R.researchForPlan(payload, plan.id, NOW)
    assert.match(lastPrompt, /City Zoo/)
    const view = await P.getPlan(member, plan.id)
    const [zoo, unknown] = view.choices.days[1].slots[0].options
    assert.ok(zoo.priceId)
    assert.deepEqual([zoo.researched, unknown.researched, unknown.priceId], [true, true, null])
    const { budget } = await TB.planBudget(payload, view, NOW)
    const line = budget.lines.find((l: Any) => l.id === 'activity-d1-afternoon')
    assert.equal(line.lowCents, 2 * 600, '2 adults × ¥600 at ¥100 = A$12')
    const before = calls
    await R.researchForPlan(payload, plan.id, NOW)
    assert.equal(calls, before, 'nothing is looked up twice')
  })

  it('does nothing while AI is switched off', async () => {
    await payload.updateGlobal({ slug: 'community-settings', data: { planner: { aiEnabled: false } } as Any })
    assert.equal((await R.researchPlace(payload, places.bangkok.id, { now: NOW })).skipped, 'AI is switched off')
    await payload.updateGlobal({ slug: 'community-settings', data: { planner: { aiEnabled: true } } as Any })
  })

  it('reads the JSON at the end of an answer', () => {
    assert.deepEqual(R.parseResearch('text ```json\n{"currency":"AUD"}\n```'), { currency: 'AUD' })
    assert.equal(R.parseResearch('no json here'), null)
  })
})
