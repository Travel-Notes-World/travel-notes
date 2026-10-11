/**
 * Guides: the guide page's photo, sources, corrections and related guides, and the /guides list
 * with its filters, page numbers and featured guide. Published guides only.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { before, describe, it } from 'node:test'

import { payload, places, setup, unique, type Any } from './helpers'

let L: Any, S: Any
let writer: Any, photo: Any
const users: Record<string, Any> = {}
const as = (user: Any) => ({ overrideAccess: false, user: { ...user, collection: 'staff' } })
const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

let day = 0
const guide = (title: string, extra: Any = {}, status: 'published' | 'draft' = 'published') =>
  payload.create({
    collection: 'articles',
    data: {
      slug: unique('g-'), title, deck: 'Deck', excerpt: 'Excerpt', type: 'destination-guide', body: lexical(title), primaryAuthor: writer.id,
      seo: { title, description: 'D' }, _status: status, firstPublishedAt: new Date(Date.UTC(2026, 0, 1 + day++)).toISOString(), ...extra,
    } as Any,
    draft: status === 'draft',
  })

const F = (x: Any = {}) => ({ type: '', country: '', style: '', page: 1, ...x })

before(async () => {
  await setup()
  L = await import('../../src/lib/content/guidesList')
  S = await import('../../src/lib/content/stories')
  photo = await payload.create({ collection: 'images', filePath: path.resolve('src/content/images/tasmania.jpg'), data: { alt: 'Boat shed', credit: 'Thennicke', licence: 'own', rightsConfirmed: true } as Any })
  writer = await payload.create({ collection: 'authors', data: { name: 'Guide Writer', slug: unique('gw-'), biography: 'Writes about Japan.', photo: photo.id } as Any })
  for (const role of ['editor', 'publisher'] as const) {
    users[role] = await payload.create({ collection: 'staff', data: { name: role, email: `${role}-${unique('g')}@example.test`, password: 'x'.repeat(16), role } as Any })
  }
  await guide('Kyoto temples', { primaryDestination: places.kyoto.id, travelStyles: ['slow'] })
  await guide('Japan rail basics', { primaryDestination: places.japan.id, type: 'practical-advice', travelStyles: ['budget'] })
  await guide('Bangkok street food', { primaryDestination: places.bangkok.id, travelStyles: ['food', 'budget'] })
  await guide('Packing light', { type: 'practical-advice' })
  await guide('Kyoto draft', { primaryDestination: places.kyoto.id }, 'draft')
})

describe('the guides list', () => {
  it('lists published guides only, newest first', async () => {
    const page = await L.loadGuidesPage(payload, F())
    assert.deepEqual(page.guides.map((g: Any) => g.title), ['Packing light', 'Bangkok street food', 'Japan rail basics', 'Kyoto temples'])
    assert.equal(page.total, 4)
  })

  it('filters by country (including places inside it), type and style, and combines them', async () => {
    const titles = async (f: Any) => (await L.loadGuidesPage(payload, F(f))).guides.map((g: Any) => g.title).sort()
    assert.deepEqual(await titles({ country: 'japan' }), ['Japan rail basics', 'Kyoto temples'])
    assert.deepEqual(await titles({ type: 'practical-advice' }), ['Japan rail basics', 'Packing light'])
    assert.deepEqual(await titles({ style: 'budget' }), ['Bangkok street food', 'Japan rail basics'])
    assert.deepEqual(await titles({ country: 'japan', style: 'budget' }), ['Japan rail basics'])
    assert.deepEqual(await titles({ country: 'nowhere' }), [])
  })

  it('offers only filter choices that find something, with counts', async () => {
    const o = await L.loadGuideOptions(payload)
    assert.deepEqual(o.countries.map((c: Any) => [c.value, c.count]), [['japan', 2], ['thailand', 1]])
    assert.deepEqual(o.types.map((t: Any) => [t.value, t.count]), [['destination-guide', 2], ['practical-advice', 2]])
    assert.ok(o.styles.some((s: Any) => s.value === 'budget' && s.count === 2))
    assert.ok(!o.styles.some((s: Any) => s.value === 'luxury'))
  })

  it('reads filters safely from the address', () => {
    assert.deepEqual(L.readGuideFilters({ type: 'itinerary', country: 'Japan', style: 'food', page: '3' }), { type: 'itinerary', country: 'japan', style: 'food', page: 3 })
    assert.deepEqual(L.readGuideFilters({ type: 'nonsense', country: "x'; drop", style: 'x', page: '-4' }), { type: '', country: '', style: '', page: 1 })
    assert.equal(L.guidesHref({ country: 'japan', page: 2 }), '/guides?country=japan&page=2')
    assert.equal(L.guidesHref({ page: 1 }), '/guides')
  })

  it('puts the newest featured guide on top of the first unfiltered page, and not twice', async () => {
    const all = await payload.find({ collection: 'articles', where: { title: { equals: 'Japan rail basics' } }, draft: false })
    await payload.update({ collection: 'articles', id: all.docs[0].id, data: { featured: true } as Any })
    const first = await L.loadGuidesPage(payload, F())
    assert.equal(first.featured?.title, 'Japan rail basics')
    assert.ok(!first.guides.some((g: Any) => g.title === 'Japan rail basics'))
    assert.equal(first.total, 4)
    const filtered = await L.loadGuidesPage(payload, F({ country: 'japan' }))
    assert.equal(filtered.featured, null, 'no featured guide on a filtered list')
    assert.ok(filtered.guides.some((g: Any) => g.title === 'Japan rail basics'))
  })

  it('only a publisher can feature a guide', async () => {
    const g = await guide('Feature attempt')
    const byEditor = await payload.update({ collection: 'articles', id: g.id, data: { featured: true } as Any, ...as(users.editor) })
    assert.equal(byEditor.featured, false, 'the editor’s change to "featured" is ignored')
    const byPublisher = await payload.update({ collection: 'articles', id: g.id, data: { featured: true } as Any, ...as(users.publisher) })
    assert.equal(byPublisher.featured, true)
    await payload.update({ collection: 'articles', id: g.id, data: { featured: false } as Any })
  })

  it('splits long lists into pages', async () => {
    const page = await L.loadGuidesPage(payload, F({ page: 2 }))
    assert.equal(page.guides.length, 0)
    assert.equal(L.GUIDES_PER_PAGE, 24)
  })
})

describe('the guide page', () => {
  it('carries the photo, sources, corrections (newest first) and review date', async () => {
    const g = await guide('Kyoto in autumn', {
      primaryDestination: places.kyoto.id,
      heroImage: photo.id,
      reviewedAt: '2026-10-11T00:00:00.000Z',
      sources: [{ name: 'JR West', url: 'https://www.westjr.co.jp/global/en/', note: 'Ticket prices' }],
      corrections: [{ date: '2026-02-01T00:00:00.000Z', text: 'Fixed a train time.' }, { date: '2026-03-01T00:00:00.000Z', text: 'Updated a price.' }],
    })
    const story = await S.getStory(g.slug).catch(() => null) ?? (await S.findStories(payload, { id: { equals: g.id } }, 1))[0]
    assert.equal(story.photo.alt, 'Boat shed')
    assert.equal(story.sources[0].note, 'Ticket prices')
    assert.deepEqual(story.corrections.map((c: Any) => c.text), ['Updated a price.', 'Fixed a train time.'])
    assert.equal(story.reviewedAt.slice(0, 10), '2026-10-11')
    assert.equal(story.author.biography, 'Writes about Japan.')
  })

  it('a source must be an https link', async () => {
    await assert.rejects(guide('Bad source', { sources: [{ name: 'X', url: 'http://example.com' }] }))
  })

  it('related guides: same destination first, then the newest, never itself, never drafts', async () => {
    const kyoto = (await payload.find({ collection: 'articles', where: { title: { equals: 'Kyoto temples' } }, draft: false })).docs[0]
    const docs = await S.relatedDocs(payload, kyoto.id, [places.kyoto.id], [], 3)
    const titles = docs.map((d: Any) => d.title)
    assert.equal(titles[0], 'Kyoto in autumn', 'the other Kyoto guide comes first')
    assert.ok(!titles.includes('Kyoto temples'))
    assert.ok(!titles.includes('Kyoto draft'))
    assert.equal(titles.length, 3, 'topped up with the newest guides')
  })
})
