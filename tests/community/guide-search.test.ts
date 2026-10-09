/**
 * Guide search: plain text from the Lexical body, ranked full-text search (title first), published
 * content only, filters, stable pagination, query syntax, junk input, and that the query plan uses
 * the GIN index. Timing is not tested here; see `npm run bench:search`.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { payload, places, setup, unique, type Any } from './helpers'

let G: Any, S: Any, P: Any
let writer: Any

const text = (t: string) => ({ type: 'text', text: t, format: 0, style: '', mode: 'normal', detail: 0, version: 1 })
const para = (...children: Any[]) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children })
const doc = (...children: Any[]) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } })

const article = async (title: string, body: string, extra: Any = {}, status: 'published' | 'draft' = 'published') =>
  payload.create({
    collection: 'articles',
    data: { slug: unique('g-'), title, deck: extra.deck ?? 'Deck', excerpt: extra.excerpt ?? 'Excerpt', type: 'practical-advice', body: doc(para(text(body))), primaryAuthor: writer.id, seo: { title, description: 'D' }, _status: status, ...extra } as Any,
    draft: status === 'draft',
  })

const titles = async (q: string, extra: Any = {}) => (await G.searchGuides(payload, { q, ...extra })).items.map((h: Any) => h.title)

before(async () => {
  await setup()
  G = await import('../../src/lib/content/guideSearch')
  S = await import('../../src/lib/community/search')
  P = await import('../../src/lib/content/plainText')
  writer = await payload.create({ collection: 'authors', data: { name: 'Writer', slug: unique('w-'), biography: 'Bio' } as Any })
})

describe('guide search: plain text from the body', () => {
  it('keeps only the words a reader sees, never JSON keys or link addresses', () => {
    const body = doc(
      { type: 'heading', tag: 'h2', format: '', indent: 0, version: 1, direction: 'ltr', children: [text('Getting there')] },
      para(text('Take the '), { type: 'link', fields: { url: 'https://secret-tracker.example/ref', newTab: true }, format: '', indent: 0, version: 3, direction: 'ltr', children: [text('night train')] }, text(' from Tokyo.'), { type: 'linebreak', version: 1 }, text('Book early.')),
      { type: 'list', listType: 'bullet', tag: 'ul', start: 1, format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'listitem', value: 1, format: '', indent: 0, version: 1, direction: 'ltr', children: [text('Rail pass')] }] },
    )
    const plain = P.lexicalPlainText(body)
    assert.equal(plain, 'Getting there\nTake the night train from Tokyo.\nBook early.\nRail pass')
    for (const leak of ['secret-tracker', 'https', 'paragraph', 'listitem', 'version', 'ltr']) assert.ok(!plain.includes(leak), leak)
    assert.equal(P.lexicalPlainText(null), '')
  })

  it('stores it on save, and never returns it to readers', async () => {
    const a = await article('Plain text check', 'Lantern festival in Hoi An')
    const { run, sql } = await import('../../src/lib/community/db')
    const row = (await run(payload, sql`SELECT "search_text" FROM "articles" WHERE "id" = ${a.id}::uuid`)).rows[0] as Any
    assert.equal(row.search_text, 'Lantern festival in Hoi An')
    const read: Any = await payload.findByID({ collection: 'articles', id: a.id, overrideAccess: false })
    assert.equal(read.searchText, undefined)
  })
})

describe('guide search: ranking and published content only', () => {
  before(async () => {
    await article('Temples of Kyoto', 'A slow walk past shrines and gardens.')
    await article('Eating in Osaka', 'Street food. Day trip to the temples nearby.')
    await article('Rail passes explained', 'Which pass to buy.', { excerpt: 'Temples, castles and the passes that reach them' })
    await article('Draft about temples', 'Temples temples temples.', {}, 'draft')
  })

  it('ranks a title match above a summary match above a body match', async () => {
    assert.deepEqual(await titles('temples'), ['Temples of Kyoto', 'Rail passes explained', 'Eating in Osaka'])
  })

  it('never finds a draft, or the wording of a pending draft of a published guide', async () => {
    assert.ok(!(await titles('temples')).includes('Draft about temples'))
    const live = await article('Hakone hot springs', 'Onsen etiquette.')
    await payload.update({ collection: 'articles', id: live.id, data: { title: 'Hakone ryokan secrets' } as Any, draft: true })
    assert.deepEqual(await titles('ryokan'), [], 'the pending draft title is not searchable')
    assert.deepEqual(await titles('hakone'), ['Hakone hot springs'], 'the published version still is')
  })

  it('updates when a published guide is edited and republished', async () => {
    const a = await article('Ferry guide', 'The slow ferry to Koh Tao.')
    assert.deepEqual(await titles('Koh Tao'), ['Ferry guide'])
    await payload.update({ collection: 'articles', id: a.id, data: { body: doc(para(text('The fast catamaran to Koh Samui.'))), _status: 'published' } as Any })
    assert.deepEqual(await titles('"Koh Tao"'), [], 'the old body text is gone from the index')
    assert.deepEqual(await titles('catamaran'), ['Ferry guide'])
  })

  it('drops a guide from results when it is unpublished', async () => {
    const a = await article('Gondola ride', 'Cable car views.')
    assert.deepEqual(await titles('gondola'), ['Gondola ride'])
    await payload.update({ collection: 'articles', id: a.id, data: { _status: 'draft' } as Any })
    assert.deepEqual(await titles('gondola'), [])
  })

  it('understands quotes, "or" and -word', async () => {
    assert.deepEqual(await titles('"street food"'), ['Eating in Osaka'])
    assert.deepEqual((await titles('temples -osaka')).sort(), ['Rail passes explained', 'Temples of Kyoto'])
    assert.deepEqual((await titles('gardens or castles')).sort(), ['Rail passes explained', 'Temples of Kyoto'])
  })
})

describe('guide search: filters and results', () => {
  before(async () => {
    await article('Kyoto by bicycle', 'Cycling routes.', { primaryDestination: places.kyoto.id, travelStyles: ['budget'] })
    await article('Bangkok by boat', 'Cycling is hard here; take the river boat.', { primaryDestination: places.bangkok.id, travelStyles: ['family'] })
  })

  it('filters by destination, including places inside it, and by travel style', async () => {
    const { withDescendants } = await import('../../src/lib/community/destinations')
    assert.deepEqual(await titles('cycling', { destinationIds: await withDescendants(places.japan.id) }), ['Kyoto by bicycle'])
    assert.deepEqual(await titles('cycling', { style: 'family' }), ['Bangkok by boat'])
    assert.deepEqual(await titles('', { style: 'budget' }), ['Kyoto by bicycle'], 'a filter alone lists guides without words')
  })

  it('shows the destination and the date with each result', async () => {
    const [hit] = (await G.searchGuides(payload, { q: 'bicycle' })).items
    assert.deepEqual(hit.destination, { name: 'Kyoto', path: 'japan/kyoto' })
    assert.ok(!Number.isNaN(Date.parse(hit.date)))
    assert.match(hit.path, /^\/stories\//)
  })

  it('pages through results in a stable order with the right totals', async () => {
    for (let i = 0; i < 25; i++) await article(`Island hopping part ${i}`, 'Archipelago notes.')
    const first = await G.searchGuides(payload, { q: 'archipelago', page: 1 })
    const second = await G.searchGuides(payload, { q: 'archipelago', page: 2 })
    assert.equal(first.total, 25)
    assert.equal(first.totalPages, 2)
    assert.equal(first.items.length, 20)
    assert.equal(second.items.length, 5)
    const all = [...first.items, ...second.items].map((h: Any) => h.title)
    assert.equal(new Set(all).size, 25, 'no result appears on two pages')
    assert.deepEqual((await G.searchGuides(payload, { q: 'archipelago', page: 1 })).items.map((h: Any) => h.title), first.items.map((h: Any) => h.title), 'same order every time')
    const past = await G.searchGuides(payload, { q: 'archipelago', page: 9 })
    assert.deepEqual([past.items.length, past.total], [0, 25], 'a page past the end is empty but keeps the total')
  })
})

describe('guide search: the search page input', () => {
  it('caps the search text at 200 characters, cut at a whole word', async () => {
    assert.equal(S.SEARCH_QUERY_MAX, 200)
    const result = await S.search({ q: 'archipelago '.repeat(40), type: 'guide' })
    assert.ok(result.query.length <= 200)
    assert.match(result.query, /archipelago$/, 'no half word at the end')
    assert.equal(result.guides.total, 25, 'the capped text still finds the guides')
    const long = await S.search({ q: 'x'.repeat(500), type: 'guide' })
    assert.equal(long.query.length, 200, 'one very long word is cut, not refused')
    assert.equal(long.guideError, false)
  })

  it('treats junk or empty input as no results, never an error', async () => {
    for (const q of ['!!!', '&&||', ':*', '"', '-', '()', "'; drop table articles; --", '', '   ']) {
      const result = await S.search({ q, type: 'guide' })
      assert.equal(result.guideError, false, q)
      assert.deepEqual(result.guides.items, [], q)
    }
  })

  it('"Everything" shows the top guides with the total; "Editorial guides" pages through them', async () => {
    const everything = await S.search({ q: 'archipelago' })
    assert.equal(everything.guides.items.length, S.GUIDES_ON_EVERYTHING)
    assert.equal(everything.guides.total, 25)
    const guides = await S.search({ q: 'archipelago', type: 'guide', page: 2 })
    assert.equal(guides.guides.items.length, 5)
  })
})

describe('guide search: query plan', () => {
  it('uses the GIN index on search_vector', async () => {
    const query = G.rankedGuideSql('temples', { destinationIds: [places.kyoto.id], style: 'budget' }, 20, 0)
    const { sql: text, params } = (payload.db as Any).drizzle.dialect.sqlToQuery(query)
    const client = await (payload.db as Any).pool.connect()
    try {
      // Steady state, as autovacuum keeps it on a real database: fresh statistics, and new rows
      // moved out of the GIN index's pending list.
      await client.query('VACUUM ANALYZE "articles"')
      await client.query('BEGIN')
      // With a few dozen rows the planner may prefer a sequential or plain index scan; turning
      // those off shows whether the GIN index can serve this exact query, the same answer every time.
      await client.query('SET LOCAL enable_seqscan = off')
      await client.query('SET LOCAL enable_indexscan = off')
      const plan = (await client.query(`EXPLAIN ${text}`, params)).rows.map((r: Any) => r['QUERY PLAN']).join('\n')
      assert.match(plan, /articles_search_vector_idx/, plan)
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
