/**
 * Topic pages from the CMS (/topics/<slug>), travel styles on guides in search, and the removal of
 * the sample content.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { before, describe, it } from 'node:test'

import { payload, setup, unique, type Any } from './helpers'

let T: Any, S: Any, SITEMAP: Any
let writer: Any, budget: Any, draftTopic: Any
const ids: Record<string, string> = {}

const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

const guide = async (key: string, status: 'published' | 'draft', extra: Any = {}) => {
  const doc = await payload.create({
    collection: 'articles',
    data: { slug: unique(`${key}-`), title: key, deck: 'Deck', excerpt: 'Excerpt', type: 'practical-advice', body: lexical(key), primaryAuthor: writer.id, seo: { title: key, description: 'Description' }, _status: status, ...extra } as Any,
    draft: status === 'draft',
  })
  ids[key] = doc.id
  return doc
}

const topic = (data: Any, status: 'published' | 'draft' = 'published') =>
  payload.create({ collection: 'topics', data: { introduction: 'How to travel well for less.', seo: { title: `${data.name} travel guides`, description: 'D' }, _status: status, ...data } as Any, draft: status === 'draft' })

const pageFor = async (slug: string) => T.loadTopicPage(payload, await T.findTopic(payload, slug))
const titles = (stories: Any[]) => stories.map((s) => s.title)

before(async () => {
  await setup()
  T = await import('../../src/lib/content/topics')
  S = await import('../../src/lib/community/search')
  SITEMAP = await import('../../src/lib/content/sitemap')
  writer = await payload.create({ collection: 'authors', data: { name: 'Guide writer', slug: unique('writer-'), biography: 'Bio' } as Any })
  budget = await topic({ name: 'Budget travel', slug: 'budget' })
  draftTopic = await topic({ name: 'Secret topic', slug: 'secret' }, 'draft')

  await guide('cheap-eats', 'published', { topics: [budget.id], travelStyles: ['budget', 'food'] })
  await guide('hostel-tips', 'published', { topics: [budget.id], travelStyles: ['backpacking'] })
  await guide('budget-draft', 'draft', { topics: [budget.id], travelStyles: ['budget'] })
  await guide('free-museums', 'published', { travelStyles: ['budget'] })
  await guide('luxury-draft', 'draft', { travelStyles: ['luxury'] })
  // Featured on the topic page without being tagged: one published, one draft.
  await guide('editors-pick', 'published')
  await guide('pick-draft', 'draft')
  budget = await payload.update({ collection: 'topics', id: budget.id, data: { featuredArticles: [ids['pick-draft'], ids['editors-pick']], _status: 'published' } as Any })
})

describe('topic pages: published content only', () => {
  it('a draft, unknown or malformed topic has no page', async () => {
    assert.equal(await T.findTopic(payload, 'secret'), null)
    assert.equal(await T.findTopic(payload, 'nope'), null)
    assert.equal(await T.findTopic(payload, '../etc'), null)
    assert.ok(await T.findTopic(payload, 'budget'))
  })

  it('shows published featured articles in the editor\'s order, then other published guides, never drafts', async () => {
    const page = await pageFor('budget')
    assert.deepEqual(titles(page.featured), ['editors-pick'], 'the draft pick is left out')
    assert.deepEqual(titles(page.guides).sort(), ['cheap-eats', 'hostel-tips'], 'the draft guide is left out, the featured one is not repeated')
    assert.equal(page.guideTotal, 3, 'featured and tagged guides, each counted once')
  })

  it('lists published topics only, for links elsewhere on the site', async () => {
    assert.deepEqual((await T.listTopics(payload)).map((t: Any) => t.slug), ['budget'])
  })
})

describe('topic pages: indexing and sitemap', () => {
  it('is indexable only with an introduction, at least MIN_GUIDES_FOR_INDEXING (3) published guides and noindex not ticked', () => {
    assert.equal(T.MIN_GUIDES_FOR_INDEXING, 3)
    assert.equal(T.topicIndexable({ introduction: 'Intro', guideTotal: 3, noindex: false }), true)
    assert.equal(T.topicIndexable({ introduction: 'Intro', guideTotal: 2, noindex: false }), false, 'too few guides')
    assert.equal(T.topicIndexable({ introduction: '   ', guideTotal: 5, noindex: false }), false, 'no introduction')
    assert.equal(T.topicIndexable({ introduction: 'Intro', guideTotal: 5, noindex: true }), false, 'noindex ticked')
  })

  it('a topic page is noindex until it qualifies, and the sitemap follows the same rule', async () => {
    await payload.update({ collection: 'articles', id: ids['free-museums'], data: { topics: [budget.id], _status: 'published' } as Any })
    let page = await pageFor('budget')
    assert.equal(page.guideTotal, 4)
    assert.equal(T.topicRobots(page), undefined, 'qualifies: no robots rule of its own, so the site-wide rule applies')
    assert.deepEqual((await T.indexableTopicPaths(payload)).map((e: Any) => e.path), ['/topics/budget'])
    assert.ok((await SITEMAP.editorialSitemap()).some((e: Any) => e.path === '/topics/budget'))

    await payload.update({ collection: 'topics', id: budget.id, data: { seo: { ...budget.seo, noindex: true }, _status: 'published' } as Any })
    page = await pageFor('budget')
    assert.deepEqual(T.topicRobots(page), { index: false, follow: true })
    assert.deepEqual(await T.indexableTopicPaths(payload), [])
    await payload.update({ collection: 'topics', id: budget.id, data: { seo: { ...budget.seo, noindex: false }, _status: 'published' } as Any })
  })

  it('a draft topic is never in the sitemap, however many guides it has', async () => {
    for (const key of ['cheap-eats', 'hostel-tips', 'free-museums']) {
      const doc: Any = await payload.findByID({ collection: 'articles', id: ids[key], depth: 0 })
      await payload.update({ collection: 'articles', id: ids[key], data: { topics: [...(doc.topics ?? []), draftTopic.id], _status: 'published' } as Any })
    }
    assert.ok(!(await T.indexableTopicPaths(payload)).some((e: Any) => e.path === '/topics/secret'))
  })
})

describe('travel styles in search', () => {
  const guideTitles = async (input: Any) => (await S.search(input)).guides.map((g: Any) => g.path.replace(/^\/stories\//, '').replace(/-[a-z0-9]+$/, '')).sort()

  it('a style alone lists published guides with that style, never drafts', async () => {
    assert.deepEqual(await guideTitles({ style: 'budget' }), ['cheap-eats', 'free-museums'])
    assert.deepEqual(await guideTitles({ style: 'budget', type: 'guide' }), ['cheap-eats', 'free-museums'])
    assert.deepEqual(await guideTitles({ style: 'luxury', type: 'guide' }), [], 'the only luxury guide is a draft')
  })

  it('combines a style with the words typed', async () => {
    assert.deepEqual(await guideTitles({ q: 'museums', style: 'budget' }), ['free-museums'])
    assert.deepEqual(await guideTitles({ q: 'museums', style: 'food' }), [])
  })

  it('ignores an unknown style instead of matching nothing', async () => {
    assert.deepEqual(await guideTitles({ q: 'museums', style: 'not-a-style' }), ['free-museums'])
  })
})

describe('sample content is gone', () => {
  it('nothing in src imports the old sample content', () => {
    const root = path.resolve(import.meta.dirname, '../../src')
    assert.ok(!fs.existsSync(path.join(root, 'content/sample.ts')))
    assert.ok(!fs.existsSync(path.join(root, 'content/data/sample-media.json')))
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(entry.name) && /content\/sample|sample-media/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full))
      }
    }
    walk(root)
    assert.deepEqual(offenders, [])
  })

  it('every licensed image left is used and has a credit', async () => {
    const media = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/content/data/images.json'), 'utf8'))
    const home = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/content/data/home.json'), 'utf8'))
    assert.deepEqual(Object.keys(media.images), [home.hero.image], 'only the homepage hero image is left')
    for (const image of Object.values(media.images) as Any[]) {
      assert.ok(image.author && media.licenses[image.license]?.licenseUrl, 'author and licence are recorded')
    }
  })
})
