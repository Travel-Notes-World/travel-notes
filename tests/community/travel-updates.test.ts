/**
 * Travel updates: who can write and publish them, the official-source rule, published-only reads,
 * the list and its filters, the "What's changed" box on destination pages, redirects on an address
 * change, 410 on deletion, the sitemap and the RSS feed.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { payload, places, setup, unique, type Any } from './helpers'

let U: Any, D: Any, SITEMAP: Any, FEED: Any
let writer: Any
const users: Record<string, Any> = {}

const as = (user: Any) => ({ overrideAccess: false, user: user ? { ...user, collection: 'staff' } : undefined })
const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

const DAY = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

const data = (title: string, extra: Any = {}) => ({
  title,
  slug: unique('upd-'),
  summary: `${title}: what changed and from when.`,
  category: 'entry-rules',
  sources: [{ name: 'Smartraveller', url: 'https://www.smartraveller.gov.au/destinations/asia/japan' }],
  author: writer.id,
  ...extra,
})

const publish = (title: string, extra: Any = {}) => payload.create({ collection: 'travel-updates', data: { ...data(title, extra), _status: 'published' } as Any })
const draft = (title: string, extra: Any = {}) => payload.create({ collection: 'travel-updates', data: { ...data(title, extra), _status: 'draft' } as Any, draft: true })
const titles = (items: Any[]) => items.map((u) => u.title)

before(async () => {
  await setup()
  U = await import('../../src/lib/content/updates')
  D = await import('../../src/lib/content/destinations')
  SITEMAP = await import('../../src/lib/content/sitemap')
  FEED = await import('../../src/lib/content/updatesFeed')
  await payload.delete({ collection: 'redirects', where: { id: { exists: true } } })
  writer = await payload.create({ collection: 'authors', data: { name: 'Updates writer', slug: unique('writer-'), biography: 'Bio' } as Any })
  for (const role of ['contributor', 'editor', 'publisher'] as const) {
    users[role] = await payload.create({ collection: 'staff', data: { name: role, email: `${role}-${unique('u')}@example.test`, password: 'x'.repeat(16), role } as Any })
  }
})

describe('travel updates: writing and publishing', () => {
  it('a contributor cannot create one; an editor can save a draft but cannot publish', async () => {
    await assert.rejects(payload.create({ collection: 'travel-updates', data: data('By contributor') as Any, draft: true, ...as(users.contributor) }))
    const doc = await payload.create({ collection: 'travel-updates', data: data('By editor') as Any, draft: true, ...as(users.editor) })
    await assert.rejects(payload.update({ collection: 'travel-updates', id: doc.id, data: { _status: 'published' }, ...as(users.editor) }), 'only publishers publish')
    const published = await payload.update({ collection: 'travel-updates', id: doc.id, data: { _status: 'published' }, ...as(users.publisher) })
    assert.equal(published._status, 'published')
    assert.ok(published.firstPublishedAt, 'the first publication time is stamped')
    await assert.rejects(payload.delete({ collection: 'travel-updates', id: doc.id, ...as(users.editor) }), 'only publishers delete')
  })

  it('needs at least one official source, with a full https:// address', async () => {
    await assert.rejects(publish('No source', { sources: [] }))
    for (const url of ['http://example.com/rule', 'javascript:alert(1)', 'www.example.com', 'https://user:pw@example.com/x', 'https://localhost/x']) {
      await assert.rejects(publish(`Bad source ${url}`, { sources: [{ name: 'Source', url }] }), url)
    }
  })

  it('refuses the reserved address "weekly" and an end date before the start date', async () => {
    await assert.rejects(publish('Reserved', { slug: 'weekly' }))
    await assert.rejects(publish('Backwards', { effectiveDate: '2026-12-01T12:00:00.000Z', endDate: '2026-11-01T12:00:00.000Z' }))
  })

  it('keeps the first publication time when the update is edited later', async () => {
    const created = await publish('Stamped once')
    // Published three days ago, so today's correction is clearly later.
    const doc = await payload.update({ collection: 'travel-updates', id: created.id, data: { firstPublishedAt: daysAgo(3) } as Any })
    const later = await payload.update({ collection: 'travel-updates', id: doc.id, data: { summary: 'Changed wording.', editorialUpdatedAt: new Date().toISOString(), updateNote: 'The start date moved.' } as Any })
    assert.equal(later.firstPublishedAt, doc.firstPublishedAt)
    const view = await U.findUpdate(payload, doc.slug)
    assert.ok(view.updated, 'a real change shows as updated')
    assert.equal(view.updateNote, 'The start date moved.')
    const same = await publish('Same moment', { editorialUpdatedAt: new Date().toISOString() })
    assert.equal((await U.findUpdate(payload, same.slug)).updated, null, 'an "Updated on" at first publication is not an update')
  })
})

describe('travel updates: readers see published updates only', () => {
  it('a draft has no page and is in no list; a pending draft of a published update shows the published wording', async () => {
    const hidden = await draft('Secret draft')
    assert.equal(await U.findUpdate(payload, hidden.slug), null)
    await assert.rejects(payload.findByID({ collection: 'travel-updates', id: hidden.id, ...as(null) }))
    assert.ok(!titles((await U.listUpdates(payload, { pageSize: 50 })).items).includes('Secret draft'))

    const live = await publish('Live wording')
    await payload.update({ collection: 'travel-updates', id: live.id, data: { title: 'Pending wording' } as Any, draft: true })
    assert.equal((await U.findUpdate(payload, live.slug)).title, 'Live wording')
  })

  it('shows only https sources and only published destinations', async () => {
    const hiddenPlace = await payload.create({ collection: 'destinations', data: { name: 'Hidden place', slug: unique('hidden-'), kind: 'city', parent: places.japan.id, timeZone: 'Asia/Tokyo', summary: 'S', seo: { title: 'H', description: 'H' }, _status: 'draft' } as Any, draft: true })
    const doc = await publish('Places shown', { destinations: [places.kyoto.id, hiddenPlace.id] })
    const view = await U.findUpdate(payload, doc.slug)
    assert.deepEqual(view.destinations.map((d: Any) => d.name), ['Kyoto'])
    assert.equal(view.sources[0].url, 'https://www.smartraveller.gov.au/destinations/asia/japan')
    assert.equal(await U.findUpdate(payload, '../etc'), null, 'a malformed address is simply not found')
  })
})

describe('travel updates: the list', () => {
  it('lists newest first, filters by category, ignores an unknown category, and pages with stable order', async () => {
    await payload.delete({ collection: 'travel-updates', where: { id: { exists: true } } })
    for (let i = 0; i < 23; i++) await publish(`Route ${i}`, { category: 'flights-routes' })
    await publish('Park closed', { category: 'closures' })

    const all = await U.listUpdates(payload)
    assert.equal(all.total, 24)
    assert.equal(all.items[0].title, 'Park closed', 'newest first')
    assert.equal(all.items.length, 20)
    const second = await U.listUpdates(payload, { page: 2 })
    assert.equal(second.items.length, 4)
    const seen = new Set([...all.items, ...second.items].map((u: Any) => u.id))
    assert.equal(seen.size, 24, 'no update appears on two pages')

    assert.deepEqual(titles((await U.listUpdates(payload, { category: 'closures' })).items), ['Park closed'])
    assert.equal((await U.listUpdates(payload, { category: 'not-a-category' })).total, 24, 'an unknown category is ignored')
  })

  it('the weekly list has only updates first published in the last 7 days', async () => {
    const old = await publish('Old news')
    await payload.update({ collection: 'travel-updates', id: old.id, data: { firstPublishedAt: daysAgo(10) } as Any })
    const recent = titles(await U.updatesSince(payload, 7))
    assert.ok(recent.includes('Park closed'))
    assert.ok(!recent.includes('Old news'))
  })
})

describe('travel updates: "What\'s changed" on destination pages', () => {
  it('shows current updates for the place, places inside it and the country it is in; never ended, old or other places', async () => {
    await payload.delete({ collection: 'travel-updates', where: { id: { exists: true } } })
    await publish('Japan visa rule', { destinations: [places.japan.id] })
    await publish('Kyoto bus change', { destinations: [places.kyoto.id] })
    await publish('Thailand only', { destinations: [places.thailand.id] })
    await publish('Ended closure', { destinations: [places.kyoto.id], endDate: daysAgo(2) })
    await publish('Still closed', { destinations: [places.kyoto.id], endDate: new Date(Date.now() + 5 * DAY).toISOString() })
    const old = await publish('Last year', { destinations: [places.kyoto.id] })
    await payload.update({ collection: 'travel-updates', id: old.id, data: { firstPublishedAt: daysAgo(400) } as Any })
    await draft('Kyoto draft', { destinations: [places.kyoto.id] })

    const kyoto = await D.loadDestinationPage(payload, places.kyoto)
    assert.deepEqual(titles(kyoto.updates).sort(), ['Japan visa rule', 'Kyoto bus change', 'Still closed'])

    const japan = await D.loadDestinationPage(payload, places.japan)
    assert.ok(titles(japan.updates).includes('Kyoto bus change'), 'a place inside the country counts')
    assert.ok(!titles(japan.updates).includes('Thailand only'))
    assert.ok(japan.updates.length <= U.UPDATES_ON_DESTINATION)
  })
})

describe('travel updates: addresses, sitemap and feed', () => {
  it('an address change redirects the old address; deleting a published update makes it gone (410)', async () => {
    const doc = await publish('Moving update', { slug: 'old-update-name' })
    await payload.update({ collection: 'travel-updates', id: doc.id, data: { slug: 'new-update-name' } as Any })
    const moved = (await payload.find({ collection: 'redirects', where: { from: { equals: '/updates/old-update-name' } } })).docs[0]
    assert.equal(moved?.to, '/updates/new-update-name')
    await payload.delete({ collection: 'travel-updates', id: doc.id })
    const gone = (await payload.find({ collection: 'redirects', where: { from: { equals: '/updates/new-update-name' } } })).docs[0]
    assert.equal(gone?.type, 'gone')
  })

  it('the sitemap lists published updates and /updates, never drafts or noindex ones', async () => {
    const listed = await publish('In the sitemap')
    const hidden = await publish('Not indexed', { seo: { noindex: true } })
    const secret = await draft('Draft for sitemap')
    const paths = (await SITEMAP.editorialSitemap()).map((e: Any) => e.path)
    assert.ok(paths.includes('/updates'))
    assert.ok(paths.includes(`/updates/${listed.slug}`))
    assert.ok(!paths.includes(`/updates/${hidden.slug}`))
    assert.ok(!paths.includes(`/updates/${secret.slug}`))
  })

  it('the RSS feed is valid XML with editor text escaped', async () => {
    await publish('Fees <rise> & "change"', { summary: 'Fares go up 5% <b>today</b> & more.' })
    const xml = FEED.renderUpdatesFeed((await U.listUpdates(payload, { pageSize: U.FEED_SIZE })).items)
    assert.ok(xml.includes('<title>Fees &lt;rise&gt; &amp; &quot;change&quot;</title>'))
    assert.ok(!xml.includes('<b>today</b>'), 'markup in a summary is escaped')
    assert.ok(xml.trim().endsWith('</rss>'))
  })
})
