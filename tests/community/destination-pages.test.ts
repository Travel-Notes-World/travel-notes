/**
 * Destination pages from the CMS (/destinations and /destinations/<path>): published content only,
 * child places with content, redirects for old and miscased paths, robots rule and sitemap.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { payload, places, setup, unique, type Any } from './helpers'

let D: Any, SITEMAP: Any
let writer: Any, osaka: Any

const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

const guide = (title: string, destination: Any, status: 'published' | 'draft') =>
  payload.create({
    collection: 'articles',
    data: { slug: unique('guide-'), title, deck: 'Deck', excerpt: 'Excerpt', type: 'destination-guide', body: lexical(title), primaryAuthor: writer.id, primaryDestination: destination.id, seo: { title, description: 'Description' }, _status: status } as Any,
    draft: status === 'draft',
  })

const place = (data: Any, status: 'published' | 'draft' = 'published') =>
  payload.create({ collection: 'destinations', data: { summary: `${data.name} summary.`, seo: { title: data.name, description: 'D' }, kind: 'city', _status: status, ...data } as Any, draft: status === 'draft' })

/** Load a destination page the way the route does, by path. */
const pageFor = async (path: string) => {
  const resolved = await D.resolveDestination(payload, path)
  assert.equal(resolved?.kind, 'found', `${path} should resolve`)
  return D.loadDestinationPage(payload, resolved.doc)
}

before(async () => {
  await setup()
  D = await import('../../src/lib/content/destinations')
  SITEMAP = await import('../../src/lib/content/sitemap')
  writer = await payload.create({ collection: 'authors', data: { name: 'Guide writer', slug: unique('writer-'), biography: 'Bio' } as Any })
  osaka = await place({ name: 'Osaka', slug: 'osaka', parent: places.japan.id }, 'draft')

  await guide('Kyoto in three days', places.kyoto, 'published')
  await guide('Kyoto draft guide', places.kyoto, 'draft')
  await guide('Osaka guide on a draft destination', osaka, 'published')
  await guide('Bangkok draft guide', places.bangkok, 'draft')
  // Bangkok has no published guide, but an editor wrote its introduction.
  await payload.update({ collection: 'destinations', id: places.bangkok.id, data: { body: lexical('Bangkok introduction'), _status: 'published' } as Any })
})

describe('destination pages: published content only', () => {
  it('shows published guides and never draft guides', async () => {
    const kyoto = await pageFor('japan/kyoto')
    assert.deepEqual(kyoto.guides.map((g: Any) => g.title), ['Kyoto in three days'])
    assert.equal(kyoto.guideTotal, 1)
    const bangkok = await pageFor('thailand/bangkok')
    assert.deepEqual(bangkok.guides, [], 'a draft guide is not shown')
    assert.ok(bangkok.body, 'the published body is shown')
  })

  it('a draft destination has no page and is never listed', async () => {
    assert.equal(await D.resolveDestination(payload, 'japan/osaka'), null)
    const japan = await pageFor('japan')
    assert.ok(!japan.places.some((p: Any) => p.name === 'Osaka'), 'not in "Places in Japan"')
    assert.ok(!japan.guides.some((g: Any) => g.title.startsWith('Osaka')), 'its guides do not count for the country')
    assert.ok(!(await D.listDestinationsWithContent(payload)).some((p: Any) => p.name === 'Osaka'), 'not on the index')
  })

  it('a country page includes guides about places inside it, and builds the breadcrumb trail', async () => {
    const japan = await pageFor('japan')
    assert.deepEqual(japan.guides.map((g: Any) => g.title), ['Kyoto in three days'])
    assert.deepEqual(japan.ancestors, [])
    const kyoto = await pageFor('japan/kyoto')
    assert.deepEqual(kyoto.ancestors.map((a: Any) => a.path), ['japan'])
  })
})

describe('destination pages: child places with content', () => {
  it('lists child places that have published guides, with their guide count', async () => {
    const japan = await pageFor('japan')
    assert.deepEqual(japan.places.map((p: Any) => [p.name, p.guides]), [['Kyoto', 1]])
    assert.equal(japan.placeTotal, 1)
  })

  it('lists child places that have a body but no guides, and leaves out empty ones', async () => {
    const thailand = await pageFor('thailand')
    assert.deepEqual(thailand.places.map((p: Any) => [p.name, p.guides]), [['Bangkok', 0]])
    await place({ name: 'Chiang Mai', slug: 'chiang-mai', parent: places.thailand.id })
    assert.equal((await pageFor('thailand')).places.length, 1, 'a child with no guide and no body is not listed')
  })

  it('caps the list and reports the total, so the page can link to the full list', async () => {
    const japan = await D.loadDestinationPage(payload, (await D.resolveDestination(payload, 'japan')).doc, 0)
    assert.deepEqual(japan.places, [])
    assert.equal(japan.placeTotal, 1)
  })

  it('the index lists only destinations with a published guide or a body', async () => {
    const listed = (await D.listDestinationsWithContent(payload)).map((p: Any) => p.path).sort()
    assert.deepEqual(listed, ['japan/kyoto', 'thailand/bangkok'])
    const kyoto = (await D.listDestinationsWithContent(payload)).find((p: Any) => p.path === 'japan/kyoto')
    assert.equal(kyoto.parentName, 'Japan')
  })
})

describe('destination pages: addresses', () => {
  it('redirects a path in the wrong letter case to the canonical one', async () => {
    assert.deepEqual(await D.resolveDestination(payload, 'Japan/Kyoto'), { kind: 'redirect', path: 'japan/kyoto' })
  })

  it('redirects an old published path to the current one, without loops', async () => {
    const nara = await place({ name: 'Nara', slug: 'nara', parent: places.japan.id })
    await payload.update({ collection: 'destinations', id: nara.id, data: { slug: 'nara-city', _status: 'published' } as Any })
    assert.deepEqual(await D.resolveDestination(payload, 'japan/nara'), { kind: 'redirect', path: 'japan/nara-city' })
    assert.equal((await D.resolveDestination(payload, 'japan/nara-city'))?.kind, 'found', 'the current path is served, not redirected')
  })

  it('ignores paths that only ever existed in a draft, and old paths of a destination that is no longer published', async () => {
    const kobe = await place({ name: 'Kobe', slug: 'kobe', parent: places.japan.id })
    await payload.update({ collection: 'destinations', id: kobe.id, data: { slug: 'kobe-draft' } as Any, draft: true })
    assert.equal(await D.resolveDestination(payload, 'japan/kobe-draft'), null, 'a draft-only path is unknown')
    assert.equal((await D.resolveDestination(payload, 'japan/kobe'))?.kind, 'found', 'the published path still works')

    const himeji = await place({ name: 'Himeji', slug: 'himeji', parent: places.japan.id })
    await payload.update({ collection: 'destinations', id: himeji.id, data: { slug: 'himeji-castle', _status: 'published' } as Any })
    await payload.update({ collection: 'destinations', id: himeji.id, data: { _status: 'draft' } as Any })
    assert.equal(await D.resolveDestination(payload, 'japan/himeji'), null, 'never redirects to an unpublished destination')
  })

  it('returns nothing for unknown or malformed paths', async () => {
    assert.equal(await D.resolveDestination(payload, 'japan/atlantis'), null)
    assert.equal(await D.resolveDestination(payload, '../etc/passwd'), null)
    assert.equal(await D.resolveDestination(payload, 'a/b/c/d/e'), null)
  })
})

describe('destination pages: indexing and sitemap', () => {
  it('is noindex unless hubIndexable is ticked', async () => {
    const kyoto = await pageFor('japan/kyoto')
    assert.equal(kyoto.place.hubIndexable, false)
    assert.deepEqual(D.destinationRobots(kyoto.place), { index: false, follow: true })
    assert.equal(D.destinationRobots({ hubIndexable: true }), undefined, 'indexable pages follow the site-wide rule')
  })

  it('the sitemap lists only indexable published destinations', async () => {
    assert.deepEqual(await D.indexableDestinationPaths(payload), [])
    await payload.update({ collection: 'destinations', id: places.kyoto.id, data: { hubIndexable: true, _status: 'published' } as Any })
    await payload.update({ collection: 'destinations', id: osaka.id, data: { hubIndexable: true } as Any, draft: true })
    assert.deepEqual((await D.indexableDestinationPaths(payload)).map((e: Any) => e.path), ['/destinations/japan/kyoto'])
    const editorial = (await SITEMAP.editorialSitemap()).map((e: Any) => e.path).filter((p: string) => p.startsWith('/destinations/'))
    assert.deepEqual(editorial, ['/destinations/japan/kyoto'])
  })
})
