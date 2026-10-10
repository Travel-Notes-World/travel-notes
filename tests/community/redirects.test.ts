/**
 * Redirects: rule normalisation and validation, one-step chains without loops, automatic rules when
 * a published article or topic changes address or is deleted, and the proxy that serves them
 * (308/307 with the query string kept, 410, fail open).
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { payload, setup, unique, type Any } from './helpers'

let R: Any, L: Any, proxy: Any, NextRequest: Any
let writer: Any

const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

const article = (slug: string, status: 'published' | 'draft' = 'published') =>
  payload.create({
    collection: 'articles',
    data: { slug, title: slug, deck: 'Deck', excerpt: 'Excerpt', type: 'practical-advice', body: lexical(slug), primaryAuthor: writer.id, seo: { title: slug, description: 'D' }, _status: status } as Any,
    draft: status === 'draft',
  })

const rule = async (from: string) => (await payload.find({ collection: 'redirects', where: { from: { equals: from } }, limit: 1 })).docs[0] ?? null
const rules = async () => (await payload.find({ collection: 'redirects', limit: 0, pagination: false, sort: 'from' })).docs.map((r: Any) => [r.from, r.type === 'gone' ? 410 : r.to])
const addRule = (data: Any) => payload.create({ collection: 'redirects', data })
const clearRules = () => payload.delete({ collection: 'redirects', where: { id: { exists: true } } })

/** Run a request through the proxy with freshly loaded rules. */
const request = async (url: string) => {
  await L.resetRedirectCache()
  const res = await proxy(new NextRequest(new URL(url, 'https://travelnotes.test')))
  return { status: res.status, location: res.headers.get('location'), passes: res.headers.get('x-middleware-next') === '1', rewrite: res.headers.get('x-middleware-rewrite') }
}

before(async () => {
  await setup()
  R = await import('../../src/lib/redirects/rules')
  L = await import('../../src/lib/redirects/loader')
  ;({ proxy } = await import('../../src/proxy'))
  ;({ NextRequest } = await import('next/server'))
  writer = await payload.create({ collection: 'authors', data: { name: 'Writer', slug: unique('writer-'), biography: 'Bio' } as Any })
})

after(async () => {
  await L?.resetRedirectCache()
})

describe('redirects: normalising and validating addresses', () => {
  it('normalises paths the same way for saving and matching', () => {
    assert.equal(R.normalisePath('/Stories/Old-Name/'), '/stories/old-name')
    assert.equal(R.normalisePath('/stories//old'), '/stories/old')
    assert.equal(R.normalisePath('/'), '/')
    for (const bad of ['stories/old', '//evil.com', '/a?b=1', '/a#b', '/a/../b', 'https://x.com/a']) assert.equal(R.normalisePath(bad), null, bad)
  })

  it('refuses the homepage, the CMS, the API and Next.js files as a source', () => {
    for (const bad of ['/', '/admin', '/admin/x', '/api/articles', '/_next/static/x']) assert.equal(R.validFrom(bad), null, bad)
    assert.equal(R.validFrom('/Old/'), '/old')
  })

  it('accepts site paths and https:// addresses only as a target', () => {
    assert.equal(R.validTo('/Stories/New/'), '/stories/new')
    assert.equal(R.validTo('/search?q=Kyoto'), '/search?q=Kyoto', 'a target may carry its own query string')
    assert.equal(R.validTo('https://example.com/page'), 'https://example.com/page')
    for (const bad of ['http://example.com', 'javascript:alert(1)', '//example.com', 'ftp://x', 'https://user:pw@x.com', 'https://x.com/#frag', 'stories/new']) assert.equal(R.validTo(bad), null, bad)
  })

  it('matches in any letter case and with a trailing slash, and keeps the query string', () => {
    const index = R.indexRules([
      { from: '/old', to: '/new', type: 'permanent' },
      { from: '/promo', to: '/search?q=kyoto', type: 'temporary' },
      { from: '/removed', to: null, type: 'gone' },
      { from: '/away', to: 'https://example.com/x', type: 'permanent' },
    ])
    assert.deepEqual(R.matchRule(index, '/OLD/', '?utm=1'), { status: 308, location: '/new?utm=1' })
    assert.deepEqual(R.matchRule(index, '/promo', '?utm=1'), { status: 307, location: '/search?q=kyoto&utm=1' })
    assert.deepEqual(R.matchRule(index, '/removed', ''), { status: 410 })
    assert.deepEqual(R.matchRule(index, '/away', '?a=b'), { status: 308, location: 'https://example.com/x?a=b' })
    assert.equal(R.matchRule(index, '/other', ''), null)
  })
})

describe('redirects: saving rules', () => {
  it('stores the source normalised', async () => {
    await clearRules()
    const doc = await addRule({ from: '/Stories/Old-Name/', to: '/stories/new-name' })
    assert.equal(doc.from, '/stories/old-name')
    assert.equal(doc.type, 'permanent')
  })

  it('refuses invalid sources and targets, including http://', async () => {
    await assert.rejects(addRule({ from: '/admin/x', to: '/a' }))
    await assert.rejects(addRule({ from: '/x', to: 'http://example.com' }))
    await assert.rejects(addRule({ from: '/x', to: 'javascript:alert(1)' }))
    await assert.rejects(addRule({ from: '/x' }), 'a redirect needs a target')
    assert.ok(await addRule({ from: '/x', to: 'https://example.com/ok' }))
    assert.ok(await addRule({ from: '/removed', type: 'gone' }), 'a gone rule needs no target')
  })

  it('refuses a rule that leads back to itself, directly or through another rule', async () => {
    await clearRules()
    await assert.rejects(addRule({ from: '/a', to: '/A/' }))
    await addRule({ from: '/a', to: '/b' })
    await assert.rejects(addRule({ from: '/b', to: '/a' }), 'b → a would loop with a → b')
  })

  it('keeps every chain one step, whichever rule is saved first', async () => {
    await clearRules()
    await addRule({ from: '/b', to: '/c' })
    await addRule({ from: '/a', to: '/b' })
    assert.equal((await rule('/a')).to, '/c', 'saved after b → c: stored as a → c')
    await addRule({ from: '/c', to: '/d' })
    assert.deepEqual(await rules(), [['/a', '/d'], ['/b', '/d'], ['/c', '/d']], 'saved before c → d: moved on to d')
  })

  it('a rule pointing at an address that becomes gone is gone too', async () => {
    await clearRules()
    await addRule({ from: '/a', to: '/b' })
    await addRule({ from: '/b', type: 'gone' })
    assert.deepEqual(await rules(), [['/a', 410], ['/b', 410]])
    await assert.rejects(addRule({ from: '/c', to: '/b' }), 'cannot redirect to a gone address')
  })
})

describe('redirects: automatic rules for articles and topics', () => {
  before(clearRules)

  it('a slug change on a published article creates one 308 from the old address', async () => {
    const doc = await article('first-name')
    await payload.update({ collection: 'articles', id: doc.id, data: { slug: 'second-name', _status: 'published' } as Any })
    const r = await rule('/stories/first-name')
    assert.equal(r.to, '/stories/second-name')
    assert.equal(r.type, 'permanent')
    assert.equal(r.source, 'automatic')
  })

  it('a slug changed in a draft redirects once that draft is published, still one step', async () => {
    const [doc] = (await payload.find({ collection: 'articles', where: { slug: { equals: 'second-name' } } })).docs
    await payload.update({ collection: 'articles', id: doc.id, data: { slug: 'third-name' } as Any, draft: true })
    assert.equal(await rule('/stories/second-name'), null, 'nothing changes while it is a draft')
    await payload.update({ collection: 'articles', id: doc.id, data: { _status: 'published' } as Any })
    assert.equal((await rule('/stories/second-name')).to, '/stories/third-name')
    assert.equal((await rule('/stories/first-name')).to, '/stories/third-name', 'the older redirect moved on too')
  })

  it('changing the slug back does not loop: the live address is never redirected', async () => {
    const [doc] = (await payload.find({ collection: 'articles', where: { slug: { equals: 'third-name' } } })).docs
    await payload.update({ collection: 'articles', id: doc.id, data: { slug: 'first-name', _status: 'published' } as Any })
    assert.equal(await rule('/stories/first-name'), null)
    assert.equal((await rule('/stories/second-name')).to, '/stories/first-name')
    assert.equal((await rule('/stories/third-name')).to, '/stories/first-name')
  })

  it('an unpublished article is simply not found (404): no rule is made', async () => {
    const doc = await article('withdrawn')
    await payload.update({ collection: 'articles', id: doc.id, data: { _status: 'draft' } as Any })
    assert.equal(await rule('/stories/withdrawn'), null)
  })

  it('deleting a published article marks its address gone, and old addresses for it too', async () => {
    const [doc] = (await payload.find({ collection: 'articles', where: { slug: { equals: 'first-name' } } })).docs
    await payload.delete({ collection: 'articles', id: doc.id })
    assert.equal((await rule('/stories/first-name')).type, 'gone')
    assert.equal((await rule('/stories/second-name')).type, 'gone', 'no redirect into a 410')
  })

  it('publishing at a gone address brings it back', async () => {
    await article('first-name')
    assert.equal(await rule('/stories/first-name'), null)
  })

  it('deleting a draft that was never published leaves no rule', async () => {
    const doc = await article('never-live', 'draft')
    await payload.delete({ collection: 'articles', id: doc.id })
    assert.equal(await rule('/stories/never-live'), null)
  })

  it('an editor\'s own redirect on a deleted address is kept', async () => {
    const doc = await article('has-manual')
    await addRule({ from: '/stories/has-manual', to: '/guides' })
    await payload.delete({ collection: 'articles', id: doc.id })
    assert.equal((await rule('/stories/has-manual')).to, '/guides')
  })

  it('topics get the same automatic rules', async () => {
    const topic = await payload.create({ collection: 'topics', data: { name: 'Gear', slug: 'gear', introduction: 'I', seo: { title: 'T', description: 'D' }, _status: 'published' } as Any })
    await payload.update({ collection: 'topics', id: topic.id, data: { slug: 'travel-gear', _status: 'published' } as Any })
    assert.equal((await rule('/topics/gear')).to, '/topics/travel-gear')
    await payload.delete({ collection: 'topics', id: topic.id })
    assert.equal((await rule('/topics/travel-gear')).type, 'gone')
  })
})

describe('redirects: the proxy', () => {
  before(async () => {
    await clearRules()
    await addRule({ from: '/old-page', to: '/guides' })
    await addRule({ from: '/sale', to: '/search?q=deals', type: 'temporary' })
    await addRule({ from: '/removed', type: 'gone' })
    await addRule({ from: '/partner', to: 'https://example.com/partner' })
  })

  it('redirects with 308 or 307, keeping the query string, whatever the case or trailing slash', async () => {
    assert.deepEqual(await request('/Old-Page/?utm_source=x'), { status: 308, location: 'https://travelnotes.test/guides?utm_source=x', passes: false, rewrite: null })
    const sale = await request('/sale?ref=email')
    assert.equal(sale.status, 307)
    assert.equal(sale.location, 'https://travelnotes.test/search?q=deals&ref=email')
    assert.equal((await request('/partner')).location, 'https://example.com/partner')
  })

  it('answers 410 for a gone address', async () => {
    const res = await request('/removed')
    assert.equal(res.status, 410)
    assert.match(res.rewrite ?? '', /\/gone$/)
  })

  it('passes other requests through, and keeps the lower-case and /admin behaviour', async () => {
    assert.equal((await request('/guides')).passes, true)
    assert.equal((await request('/destinations/Japan')).location, 'https://travelnotes.test/destinations/japan')
    const admin = await proxy(new NextRequest('https://travelnotes.test/admin'))
    assert.equal(admin.headers.get('x-pathname'), '/admin')
  })

  it('fails open: if the rules cannot be loaded, every request passes through', async () => {
    const real = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgresql://nobody@127.0.0.1:1/none'
    try {
      const res = await request('/old-page')
      assert.equal(res.status, 200)
      assert.equal(res.passes, true)
    } finally {
      process.env.DATABASE_URL = real
      await L.resetRedirectCache()
    }
    assert.equal((await request('/old-page')).status, 308, 'works again once the database is back')
  })
})

describe('redirects: sitemap', () => {
  it('never lists an address that redirects or is gone', async () => {
    const live = await article('in-sitemap')
    await article('redirected-away')
    await addRule({ from: '/stories/redirected-away', to: '/guides' })
    const before = process.env.NEXT_PUBLIC_INDEXABLE
    process.env.NEXT_PUBLIC_INDEXABLE = 'true'
    try {
      await L.resetRedirectCache()
      const { default: sitemap } = await import('../../src/app/sitemap')
      const urls = (await sitemap()).map((e: Any) => new URL(e.url).pathname)
      assert.ok(urls.includes(`/stories/${live.slug}`))
      assert.ok(!urls.includes('/stories/redirected-away'))
    } finally {
      process.env.NEXT_PUBLIC_INDEXABLE = before
    }
  })
})
