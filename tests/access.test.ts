/**
 * Permission-boundary tests (implementation plan §11, launch acceptance).
 *
 * These tests create and delete records, so they only run against a
 * throwaway database named in TEST_DATABASE_URL. They refuse to run against
 * the normal DATABASE_URL.
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/tn_test npm run test:access
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import type { Payload } from 'payload'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set. Refusing to run: these tests write to the database.')
  process.exit(1)
}
process.env.DATABASE_URL = testUrl
process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'test-only-secret'

const lexical = (text: string) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [{
      type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '',
      children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
    }],
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helpers pass loosely typed users and docs
type Any = any
let payload: Payload
const users: Record<string, Any> = {}
let authorId: string
const as = (user: Any) => ({ overrideAccess: false, user: user ? { ...user, collection: 'staff' } : undefined })
const stamp = Date.now()

const articleData = (slug: string, title: string) => ({
  slug, title, deck: 'Deck', excerpt: 'Excerpt', type: 'destination-guide', body: lexical(title),
  primaryAuthor: authorId, seo: { title, description: 'Description' },
})

before(async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  payload = await getPayload({ config })
  await payload.db.migrate()
  for (const collection of ['articles', 'topics', 'destinations', 'authors', 'staff'] as const) {
    await payload.delete({ collection, where: { id: { exists: true } } })
  }
  // The first account is created without a signed-in user, like Payload's first-user screen.
  users.admin = await payload.create({ collection: 'staff', data: { name: 'Admin', email: `admin-${stamp}@example.test`, password: 'x'.repeat(16), role: 'contributor' } as Any })
  for (const [key, role] of [['a', 'contributor'], ['b', 'contributor'], ['editor', 'editor'], ['publisher', 'publisher']] as const) {
    users[key] = await payload.create({ collection: 'staff', data: { name: key, email: `${key}-${stamp}@example.test`, password: 'x'.repeat(16), role } as Any, ...as(users.admin) })
  }
  authorId = (await payload.create({ collection: 'authors', data: { name: 'Author', slug: `author-${stamp}`, biography: 'Bio' }, ...as(users.editor) })).id as string
})

after(async () => {
  await payload?.destroy?.()
})

describe('staff accounts', () => {
  it('makes the first account an administrator and keeps later roles as assigned', () => {
    assert.equal(users.admin.role, 'administrator')
    assert.equal(users.a.role, 'contributor')
    assert.equal(users.publisher.role, 'publisher')
  })
  it('stops a contributor creating staff', async () => {
    await assert.rejects(payload.create({ collection: 'staff', data: { name: 'x', email: `x-${stamp}@example.test`, password: 'x'.repeat(16) } as Any, ...as(users.a) }))
  })
  it('stops a contributor promoting themselves', async () => {
    await payload.update({ collection: 'staff', id: users.a.id, data: { role: 'administrator' } as Any, ...as(users.a) })
    const fresh = await payload.findByID({ collection: 'staff', id: users.a.id })
    assert.equal(fresh.role, 'contributor')
  })
  it('stops a contributor reading or editing other staff, and hides staff from the public', async () => {
    const seen = await payload.find({ collection: 'staff', ...as(users.a) })
    assert.deepEqual(seen.docs.map((d) => d.id), [users.a.id])
    await assert.rejects(payload.update({ collection: 'staff', id: users.b.id, data: { name: 'hacked' }, ...as(users.a) }))
    await assert.rejects(payload.find({ collection: 'staff', ...as(null) }))
  })
  it('treats a suspended account as having no staff access', async () => {
    const suspended = { ...users.editor, active: false }
    await assert.rejects(payload.find({ collection: 'staff', ...as(suspended) }))
    await assert.rejects(payload.create({ collection: 'authors', data: { name: 'x', slug: `x-${stamp}`, biography: 'b' }, ...as(suspended) }))
  })
})

describe('articles', () => {
  let id: string
  const slug = `kyoto-${stamp}`

  it('lets a contributor create a draft and records the owner', async () => {
    const doc = await payload.create({ collection: 'articles', data: articleData(slug, 'Original title') as Any, draft: true, ...as(users.a) })
    id = doc.id as string
    assert.equal(doc._status, 'draft')
    assert.equal(typeof doc.createdBy === 'object' ? (doc.createdBy as Any).id : doc.createdBy, users.a.id)
  })
  it('saves as a draft even when a contributor sends no draft flag', async () => {
    const doc = await payload.create({ collection: 'articles', data: { slug: `noflag-${stamp}`, title: 'No flag' } as Any, ...as(users.a) })
    assert.equal(doc._status, 'draft')
    await assert.rejects(payload.findByID({ collection: 'articles', id: doc.id, ...as(null) }))
  })
  it('ignores an attempt to set a different owner', async () => {
    const doc = await payload.update({ collection: 'articles', id, data: { createdBy: users.b.id } as Any, draft: true, ...as(users.a) })
    assert.equal(typeof doc.createdBy === 'object' ? (doc.createdBy as Any).id : doc.createdBy, users.a.id)
  })
  it('hides the draft from the public and from another contributor', async () => {
    for (const who of [null, users.b]) {
      for (const draft of [false, true]) {
        const found = await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, draft, ...as(who) })
        assert.equal(found.docs.length, 0)
        await assert.rejects(payload.findByID({ collection: 'articles', id, draft, ...as(who) }))
      }
    }
    await assert.rejects(payload.update({ collection: 'articles', id, data: { title: 'hacked' }, draft: true, ...as(users.b) }))
  })
  it('stops contributors and editors publishing', async () => {
    for (const who of [users.a, users.editor]) {
      await assert.rejects(payload.update({ collection: 'articles', id, data: { _status: 'published' }, ...as(who) }))
      await assert.rejects(payload.create({ collection: 'articles', data: { ...articleData(`new-${who.id}`, 'New'), _status: 'published' } as Any, ...as(who) }))
    }
    const doc = await payload.findByID({ collection: 'articles', id, draft: true })
    assert.equal(doc._status, 'draft')
  })
  it('lets only editors and above approve', async () => {
    await assert.rejects(payload.update({ collection: 'articles', id, data: { editorialState: 'approved' }, draft: true, ...as(users.a) }))
    const sent = await payload.update({ collection: 'articles', id, data: { editorialState: 'in-review' }, draft: true, ...as(users.a) })
    assert.equal(sent.editorialState, 'in-review')
    const approved = await payload.update({ collection: 'articles', id, data: { editorialState: 'approved' }, draft: true, ...as(users.editor) })
    assert.equal(approved.editorialState, 'approved')
  })
  it('lets a publisher publish, and readers then see it without staff fields', async () => {
    const doc = await payload.update({ collection: 'articles', id, data: { _status: 'published' }, ...as(users.publisher) })
    assert.equal(doc._status, 'published')
    assert.ok(doc.firstPublishedAt)
    const pub = await payload.findByID({ collection: 'articles', id, ...as(null) })
    assert.equal(pub.title, 'Original title')
    assert.equal((pub as Any).createdBy, undefined)
  })
  it('keeps the published revision unchanged when a contributor or editor saves changes', async () => {
    for (const who of [users.a, users.editor]) {
      // Deliberately sent WITHOUT the draft flag: the guard must still turn it into a draft save.
      await payload.update({ collection: 'articles', id, data: { title: `Changed by ${who.name}` }, ...as(who) })
      for (const draft of [false, true]) {
        const pub = await payload.findByID({ collection: 'articles', id, draft, ...as(null) })
        assert.equal(pub.title, 'Original title')
        assert.equal(pub._status, 'published')
      }
    }
    const latest = await payload.findByID({ collection: 'articles', id, draft: true, ...as(users.editor) })
    assert.equal(latest.title, 'Changed by editor')
  })
  it('stops contributors and editors withdrawing a published article', async () => {
    for (const who of [users.a, users.editor]) {
      await payload.update({ collection: 'articles', id, data: { _status: 'draft' }, ...as(who) }).catch(() => undefined)
      const pub = await payload.findByID({ collection: 'articles', id, ...as(null) })
      assert.equal(pub._status, 'published')
    }
  })
  it('keeps version history private', async () => {
    await assert.rejects(payload.findVersions({ collection: 'articles', ...as(null) }))
    const b = await payload.findVersions({ collection: 'articles', where: { parent: { equals: id } }, ...as(users.b) })
    assert.equal(b.docs.length, 0)
    const a = await payload.findVersions({ collection: 'articles', where: { parent: { equals: id } }, ...as(users.a) })
    assert.ok(a.docs.length > 0)
  })
  it('stops a contributor republishing by restoring an old version', async () => {
    const versions = await payload.findVersions({ collection: 'articles', where: { parent: { equals: id } }, sort: 'createdAt', ...as(users.a) })
    const oldest = versions.docs[0].id as string
    await assert.rejects(payload.restoreVersion({ collection: 'articles', id: oldest, ...as(users.a) }))
    await assert.rejects(payload.restoreVersion({ collection: 'articles', id: oldest, ...as(users.editor) }))
    // "Restore as draft" is allowed and must leave the published revision alone.
    // The Local API has no draft option for restores, so call the same operation the REST route uses.
    const { createLocalReq, restoreVersionOperation } = await import('payload')
    await restoreVersionOperation({
      id: oldest, collection: payload.collections.articles, draft: true, overrideAccess: false,
      req: await createLocalReq({ user: { ...users.a, collection: 'staff' } }, payload),
    } as Any)
    for (const draft of [false, true]) {
      const pub = await payload.findByID({ collection: 'articles', id, draft, ...as(null) })
      assert.equal(pub.title, 'Original title')
      assert.equal(pub._status, 'published')
    }
  })
  it('lets a publisher withdraw, after which readers cannot see it', async () => {
    await payload.update({ collection: 'articles', id, data: { _status: 'draft' }, ...as(users.publisher) })
    await assert.rejects(payload.findByID({ collection: 'articles', id, ...as(null) }))
    await assert.rejects(payload.findByID({ collection: 'articles', id, draft: true, ...as(null) }))
  })
  it('lets only publishers and above delete', async () => {
    for (const who of [null, users.a, users.editor]) {
      await assert.rejects(payload.delete({ collection: 'articles', id, ...as(who) }))
    }
    await payload.delete({ collection: 'articles', id, ...as(users.publisher) })
  })
  it('requires the sponsored disclosure on a sponsored feature', async () => {
    await assert.rejects(payload.create({ collection: 'articles', data: { ...articleData(`sp-${stamp}`, 'Sponsored'), type: 'sponsored-feature', _status: 'published' } as Any, ...as(users.publisher) }))
    await assert.rejects(payload.create({ collection: 'articles', data: { ...articleData(`sp-${stamp}`, 'Sponsored'), type: 'sponsored-feature', disclosure: { kind: 'sponsored' }, _status: 'published' } as Any, ...as(users.publisher) }))
    const ok = await payload.create({ collection: 'articles', data: { ...articleData(`sp-${stamp}`, 'Sponsored'), type: 'sponsored-feature', disclosure: { kind: 'sponsored', sponsorName: 'Example Co' }, _status: 'published' } as Any, ...as(users.publisher) })
    assert.equal(ok._status, 'published')
  })
})

describe('destinations and topics', () => {
  it('builds the canonical path from the parent chain and blocks loops', async () => {
    const japan = await payload.create({ collection: 'destinations', data: { name: 'Japan', slug: `japan-${stamp}`, kind: 'country', summary: 'S', seo: { title: 'T', description: 'D' } } as Any, draft: true, ...as(users.editor) })
    const kyoto = await payload.create({ collection: 'destinations', data: { name: 'Kyoto', slug: 'kyoto', kind: 'city', parent: japan.id, summary: 'S', seo: { title: 'T', description: 'D' } } as Any, draft: true, ...as(users.editor) })
    assert.equal(japan.path, `japan-${stamp}`)
    assert.equal(kyoto.path, `japan-${stamp}/kyoto`)
    await assert.rejects(payload.update({ collection: 'destinations', id: japan.id, data: { parent: kyoto.id } as Any, draft: true, ...as(users.editor) }))
  })
  it('keeps draft hubs and topics private, and stops contributors and editors publishing them', async () => {
    const topic = await payload.create({ collection: 'topics', data: { name: 'Budget', slug: `budget-${stamp}`, introduction: 'I', seo: { title: 'T', description: 'D' } } as Any, draft: true, ...as(users.editor) })
    await assert.rejects(payload.findByID({ collection: 'topics', id: topic.id, ...as(null) }))
    await assert.rejects(payload.create({ collection: 'topics', data: { name: 'x', slug: `x-${stamp}`, introduction: 'I' } as Any, draft: true, ...as(users.a) }))
    await assert.rejects(payload.update({ collection: 'topics', id: topic.id, data: { _status: 'published' }, ...as(users.editor) }))
    const live = await payload.update({ collection: 'topics', id: topic.id, data: { _status: 'published' }, ...as(users.publisher) })
    assert.equal(live._status, 'published')
    assert.equal((await payload.findByID({ collection: 'topics', id: topic.id, ...as(null) })).name, 'Budget')
  })
})
