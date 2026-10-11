/**
 * Destination pages, planning parts: editorial photos, key facts with sources, "When to go",
 * questions, and the rules that stop an unsourced fact or an unexplained month from being published.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { before, describe, it } from 'node:test'

import { payload, places, setup, unique, type Any } from './helpers'

let D: Any, F: Any
let writer: Any
const users: Record<string, Any> = {}
const as = (user: Any) => ({ overrideAccess: false, user: { ...user, collection: 'staff' } })
const PHOTO = path.resolve('src/content/images/tasmania.jpg')

const photoData = (extra: Any = {}) => ({ alt: 'Boat shed on Dove Lake', credit: 'Thennicke', licence: 'cc-by-sa', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg', rightsConfirmed: true, ...extra })

const pageFor = async (p: string) => {
  const resolved = await D.resolveDestination(payload, p)
  assert.equal(resolved?.kind, 'found', `${p} should resolve`)
  return D.loadDestinationPage(payload, resolved.doc)
}

before(async () => {
  await setup()
  D = await import('../../src/lib/content/destinations')
  F = await import('../../src/lib/content/destinationFacts')
  writer = await payload.create({ collection: 'authors', data: { name: 'Destination writer', slug: unique('dw-'), biography: 'Bio' } as Any })
  for (const role of ['contributor', 'editor'] as const) {
    users[role] = await payload.create({ collection: 'staff', data: { name: role, email: `${role}-${unique('d')}@example.test`, password: 'x'.repeat(16), role } as Any })
  }
})

describe('month helpers', () => {
  it('joins months into readable ranges, including across the new year', () => {
    assert.equal(F.monthRanges(['mar', 'apr', 'may']), 'March to May')
    assert.equal(F.monthRanges(['mar', 'apr', 'oct', 'nov']), 'March to April and October to November')
    assert.equal(F.monthRanges(['nov', 'dec', 'jan', 'feb']), 'November to February')
    assert.equal(F.monthRanges(['jan', 'jul', 'dec']), 'July and December to January')
    assert.equal(F.monthRanges(F.MONTHS), 'all year')
    assert.equal(F.monthRanges([]), '')
    assert.equal(F.monthRanges(['jun']), 'June')
  })

  it('rates every month, best over good', () => {
    const r = F.monthRatings(['apr'], ['apr', 'may'])
    assert.equal(r.length, 12)
    assert.equal(r.find((m: Any) => m.month === 'apr').rating, 'best')
    assert.equal(r.find((m: Any) => m.month === 'may').rating, 'good')
    assert.equal(r.find((m: Any) => m.month === 'jan').rating, 'other')
  })

  it('shows the UTC offset of a time zone, with daylight saving', () => {
    assert.equal(F.utcOffsetLabel('Asia/Tokyo'), 'UTC+9')
    assert.equal(F.utcOffsetLabel('Asia/Kolkata'), 'UTC+5:30')
    assert.equal(F.utcOffsetLabel('Australia/Sydney', new Date('2026-01-15T00:00:00Z')), 'UTC+11')
    assert.equal(F.utcOffsetLabel('Australia/Sydney', new Date('2026-07-15T00:00:00Z')), 'UTC+10')
    assert.equal(F.utcOffsetLabel('Not/AZone'), '')
  })
})

describe('editorial photos', () => {
  it('an editor can upload a credited photo; it is stored as WebP in several sizes', async () => {
    const img = await payload.create({ collection: 'images', filePath: PHOTO, data: photoData() as Any, ...as(users.editor) })
    assert.equal(img.mimeType, 'image/webp')
    assert.ok(img.sizes?.card?.url && img.sizes?.large?.url && img.sizes?.thumb?.url)
    const photo = D.toPhoto(img)
    assert.match(photo.srcSet, /960w/)
    assert.match(photo.srcSet, /1600w/)
    assert.ok(!/480w/.test(photo.srcSet), 'the 3:2 thumbnail is left out for a photo of another shape')
    assert.ok(photo.srcSet.split(', ').length >= 3, 'several widths to choose from')
    assert.equal(photo.credit, 'Thennicke')
  })

  it('a contributor cannot upload', async () => {
    await assert.rejects(payload.create({ collection: 'images', filePath: PHOTO, data: photoData() as Any, ...as(users.contributor) }))
  })

  it('a photo needs a description, a credit, rights confirmed and, for Creative Commons, a licence link', async () => {
    await assert.rejects(payload.create({ collection: 'images', filePath: PHOTO, data: photoData({ rightsConfirmed: false }) as Any }), /right to use/)
    await assert.rejects(payload.create({ collection: 'images', filePath: PHOTO, data: photoData({ licenceUrl: null }) as Any }), /Licence link/)
    await assert.rejects(payload.create({ collection: 'images', filePath: PHOTO, data: photoData({ alt: '' }) as Any }))
    await assert.rejects(payload.create({ collection: 'images', filePath: PHOTO, data: photoData({ sourceUrl: 'http://insecure.example' }) as Any }), /Where the photo came from/)
    const own = await payload.create({ collection: 'images', filePath: PHOTO, data: photoData({ licence: 'own', licenceUrl: null, sourceUrl: null }) as Any })
    assert.ok(own.id, 'our own photo needs no licence link')
  })
})

describe('publishing rules for planning content', () => {
  const kyoto = () => places.kyoto.id
  const publish = (data: Any) => payload.update({ collection: 'destinations', id: kyoto(), data: { ...data, _status: 'published' } as Any })

  it('a fact a reader may act on cannot be published without an official source', async () => {
    await assert.rejects(publish({ facts: [{ kind: 'visa', value: 'Visa-free for short stays.' }], factsCheckedAt: '2026-10-11T00:00:00.000Z' }), /Source, .*Source link/)
    await assert.rejects(publish({ facts: [{ kind: 'visa', value: 'x', sourceName: 'Smartraveller' }], factsCheckedAt: '2026-10-11T00:00:00.000Z' }), /Source link/)
    await assert.rejects(publish({ facts: [{ kind: 'currency', value: 'Yen' }] }), /Facts checked on/, 'facts need the date they were checked')
    await assert.rejects(publish({ facts: [{ kind: 'other', value: 'x' }], factsCheckedAt: '2026-10-11T00:00:00.000Z' }), /Label/)
    await publish({ facts: [{ kind: 'currency', value: 'Japanese yen (JPY)' }], factsCheckedAt: '2026-10-11T00:00:00.000Z' })
  })

  it('chosen months need an explanation', async () => {
    await assert.rejects(publish({ bestMonths: ['apr'], whenToGo: '' }), /When to go: explanation/)
    await publish({ bestMonths: ['apr'], whenToGo: 'Spring is mild and the blossom season draws big crowds, so book early.' })
  })

  it('a draft can be saved half-finished', async () => {
    await payload.update({ collection: 'destinations', id: kyoto(), draft: true, data: { facts: [{ kind: 'visa', value: 'to check' }] } as Any })
    const live = await pageFor('japan/kyoto')
    assert.ok(!live.planning.facts.some((f: Any) => f.value === 'to check'), 'the unfinished draft is not on the public page')
  })
})

describe('the destination page', () => {
  before(async () => {
    const img = await payload.create({ collection: 'images', filePath: PHOTO, data: photoData({ caption: 'Dove Lake, May 2025' }) as Any })
    await payload.update({
      collection: 'destinations',
      id: places.kyoto.id,
      data: {
        heroImage: img.id,
        author: writer.id,
        latitude: 35.0116,
        longitude: 135.7681,
        source: { name: 'GeoNames (all-the-cities 3.1.0)' },
        goodFor: 'Temples, gardens, food',
        timeNeeded: '3 to 4 days',
        bestMonths: ['mar', 'apr', 'oct', 'nov'],
        goodMonths: ['may', 'apr'],
        whenToGo: 'Spring and autumn are mild and colourful, and also the busiest times of year.',
        facts: [
          { kind: 'visa', value: 'Check the rules for Australians.', sourceName: 'Smartraveller', sourceUrl: 'https://www.smartraveller.gov.au/destinations/asia/japan' },
          { kind: 'currency', value: 'Japanese yen (JPY)' },
        ],
        factsCheckedAt: '2026-10-11T00:00:00.000Z',
        sources: [{ name: 'Smartraveller', url: 'https://www.smartraveller.gov.au/destinations/asia/japan/' }, { name: 'JNTO', url: 'https://www.japan.travel/en/' }],
        faqs: [{ question: 'How many days do you need?', answer: 'Three to four days covers the main areas.' }],
        seo: { title: 'Kyoto travel community', description: 'Traveller questions, trip reports and activities about Kyoto, Japan.' },
        _status: 'published',
      } as Any,
    })
  })

  it('carries the photo, facts with sources, months, questions, author and location', async () => {
    const page = await pageFor('japan/kyoto')
    const p = page.planning
    assert.equal(p.photo.alt, 'Boat shed on Dove Lake')
    assert.equal(p.photo.caption, 'Dove Lake, May 2025')
    assert.deepEqual(p.facts.map((f: Any) => f.label), ['Visa for Australians', 'Currency'])
    assert.equal(p.facts[0].source.name, 'Smartraveller')
    assert.equal(p.facts[1].source, null)
    assert.equal(p.bestRange, 'March to April and October to November')
    assert.equal(p.goodRange, 'May', 'a month in both lists counts once, as best')
    assert.equal(p.months.find((m: Any) => m.month === 'apr').rating, 'best')
    assert.equal(p.faqs.length, 1)
    assert.equal(p.author.name, 'Destination writer')
    assert.deepEqual(p.location, { latitude: 35.0116, longitude: 135.7681, source: 'GeoNames' })
    assert.deepEqual(p.timeZone, { name: 'Asia/Tokyo', offset: 'UTC+9' })
    assert.ok(D.hasOwnContent(page))
  })

  it("does not reuse the importer's community search text", async () => {
    const page = await pageFor('japan/kyoto')
    assert.equal(page.planning.seo.title, null)
    assert.equal(page.planning.seo.description, null)
  })

  it('a place with nothing written has no planning content', async () => {
    const page = await pageFor('thailand')
    assert.equal(D.hasOwnContent(page), false)
    assert.equal(page.planning.photo, null)
    assert.equal(page.planning.months, null)
    assert.equal(page.planning.location, null, 'no coordinates, no map')
  })

  it('the parent page shows the child with its photo', async () => {
    await payload.update({ collection: 'destinations', id: places.kyoto.id, data: { body: { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text: 'Kyoto introduction', format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } } } as Any })
    const japan = await pageFor('japan')
    const kyoto = japan.places.find((p: Any) => p.name === 'Kyoto')
    assert.ok(kyoto, 'Kyoto is listed in Japan')
    assert.ok(kyoto.image?.srcSet, 'with its photo')
    const listed = await D.listDestinationsWithContent(payload)
    assert.ok(listed.find((p: Any) => p.name === 'Kyoto')?.image, 'and on the destinations index')
  })
})
