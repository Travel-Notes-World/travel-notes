/**
 * Typo-tolerant search: suggestions as you type and "did you mean" corrections (pg_trgm).
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { payload, places, setup, unique, type Any } from './helpers'

let SG: Any, S: Any
let writer: Any

const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

const guide = (title: string, status: 'published' | 'draft' = 'published', extra: Any = {}) =>
  payload.create({
    collection: 'articles',
    data: { slug: unique('sg-'), title, deck: 'Deck', excerpt: 'Excerpt', type: 'practical-advice', body: lexical(title), primaryAuthor: writer.id, seo: { title, description: 'D' }, _status: status, ...extra } as Any,
    draft: status === 'draft',
  })

const update = (title: string, status: 'published' | 'draft' = 'published') =>
  payload.create({
    collection: 'travel-updates',
    data: { title, slug: unique('sgu-'), summary: 'Summary.', category: 'closures', sources: [{ name: 'Official', url: 'https://example.gov/x' }], author: writer.id, _status: status } as Any,
    draft: status === 'draft',
  })

const labels = (items: Any[]) => items.map((s) => s.label)

before(async () => {
  await setup()
  SG = await import('../../src/lib/content/suggest')
  S = await import('../../src/lib/community/search')
  await payload.delete({ collection: 'travel-updates', where: { id: { exists: true } } })
  writer = await payload.create({ collection: 'authors', data: { name: 'Suggest writer', slug: unique('w-'), biography: 'Bio' } as Any })
  // An unpublished place whose name is close to "Kyoto": it must never be suggested or used as a correction.
  await payload.create({ collection: 'destinations', data: { name: 'Kyotaro', slug: 'kyotaro', kind: 'city', parent: places.japan.id, timeZone: 'Asia/Tokyo', summary: 'S', seo: { title: 'K', description: 'K' }, _status: 'draft' } as Any, draft: true })
  await guide('Temples of Kyoto in autumn', 'published', { primaryDestination: places.kyoto.id })
  await guide('Kyoto secret draft guide', 'draft')
  await update('Kyoto city bus pass ends')
  await update('Kyoto draft update', 'draft')
})

describe('suggestions as you type', () => {
  it('suggests places first, then guides and travel updates, published only', async () => {
    const items = await SG.suggest(payload, 'kyo')
    assert.equal(items[0].type, 'destination')
    assert.equal(items[0].label, 'Kyoto')
    assert.equal(items[0].href, '/destinations/japan/kyoto')
    assert.equal(items[0].detail, 'Destination in Japan')
    assert.ok(labels(items).includes('Temples of Kyoto in autumn'))
    assert.ok(labels(items).includes('Kyoto city bus pass ends'))
    for (const hidden of ['Kyotaro', 'Kyoto secret draft guide', 'Kyoto draft update']) assert.ok(!labels(items).includes(hidden), `${hidden} must not be suggested`)
    const order = items.map((s: Any) => s.type)
    assert.deepEqual(order, [...order].sort((a: string, b: string) => ['destination', 'guide', 'update'].indexOf(a) - ['destination', 'guide', 'update'].indexOf(b)))
  })

  it('tolerates typos: "kyto" finds Kyoto and "japn" finds Japan', async () => {
    assert.equal((await SG.suggest(payload, 'kyto'))[0]?.label, 'Kyoto')
    assert.equal((await SG.suggest(payload, 'japn'))[0]?.label, 'Japan')
    assert.equal((await SG.suggest(payload, 'JAPAN'))[0]?.label, 'Japan', 'case does not matter')
  })

  it('gives nothing, and no error, for empty, short or junk input; wildcards are taken literally', async () => {
    for (const q of ['', ' ', 'k', '%', '%%', '__', "'; DROP TABLE destinations; --", '\u0000\u0001', null, 42, { q: 'x' }]) {
      const items = await SG.suggest(payload, q)
      assert.ok(Array.isArray(items))
      assert.ok(!items.some((s: Any) => s.label === 'Kyotaro'))
    }
    assert.deepEqual(await SG.suggest(payload, '%%%'), [])
    assert.deepEqual(await SG.suggest(payload, 'k%o'), [], '"%" is not a wildcard')
    const long = await SG.suggest(payload, `kyoto ${'x'.repeat(500)}`)
    assert.ok(Array.isArray(long), 'very long text is cut, not refused')
  })

  it('returns at most 8 suggestions', async () => {
    for (let i = 0; i < 6; i++) await guide(`Kyoto day trip number ${i}`)
    assert.ok((await SG.suggest(payload, 'kyoto')).length <= SG.SUGGEST_LIMIT)
    assert.equal(SG.SUGGEST_LIMIT, 8)
  })

})

describe('"did you mean" corrections', () => {
  it('corrects misspelt place names inside a search, and leaves real words and real places alone', async () => {
    assert.equal(await SG.correctQuery(payload, 'kyto'), 'Kyoto')
    assert.equal(await SG.correctQuery(payload, 'best time to visit japn'), 'best time to visit Japan')
    assert.equal(await SG.correctQuery(payload, 'kyoto'), null, 'already a real place')
    assert.equal(await SG.correctQuery(payload, 'visit'), null, 'a common travel word is never turned into a place')
    assert.equal(await SG.correctQuery(payload, 'temples'), null)
    assert.equal(await SG.correctQuery(payload, ''), null)
  })

  it('never corrects to an unpublished place', async () => {
    assert.notEqual(await SG.correctQuery(payload, 'kyotaru'), 'Kyotaro')
  })

  it('the corrected words find guides the misspelt words did not', async () => {
    const wrong = await S.search({ q: 'kyto temples', type: 'guide' })
    assert.equal(wrong.guides.total, 0)
    const corrected = await SG.correctQuery(payload, 'kyto temples')
    assert.equal(corrected, 'Kyoto temples')
    const right = await S.search({ q: corrected, type: 'guide' })
    assert.ok(right.guides.items.some((g: Any) => g.title === 'Temples of Kyoto in autumn'))
  })
})

describe('trigram indexes', () => {
  it('the name match (contains or typo) can use the trigram index', async () => {
    const client = await (payload.db as Any).pool.connect()
    try {
      await client.query('ANALYZE "destinations"')
      await client.query('BEGIN')
      // With a handful of rows the planner prefers other plans; turning them off shows whether the
      // trigram index can serve this exact query, the same answer every time.
      await client.query('SET LOCAL enable_seqscan = off')
      await client.query('SET LOCAL enable_indexscan = off')
      const plan = (await client.query(`EXPLAIN SELECT "id" FROM "destinations" WHERE ("name" ILIKE $1 OR "name" % $2)`, ['%kyo%', 'kyto'])).rows.map((r: Any) => r['QUERY PLAN']).join('\n')
      assert.match(plan, /destinations_name_trgm_idx/, plan)
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
