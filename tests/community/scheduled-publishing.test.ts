/**
 * Scheduled publishing ("Publish at") for guides and travel updates: who can schedule, what
 * cancels a schedule, and the publish job.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { payload, setup, unique, type Any } from './helpers'

let SCH: Any, JOBS: Any
let writer: Any
const users: Record<string, Any> = {}

const as = (user: Any) => ({ overrideAccess: false, user: user ? { ...user, collection: 'staff' } : undefined })
const lexical = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }] } })

const MIN = 60_000
const inMinutes = (n: number) => new Date(Date.now() + n * MIN).toISOString()

const updateData = (title: string, extra: Any = {}) => ({
  title,
  slug: unique('sched-'),
  summary: `${title} summary.`,
  category: 'closures',
  sources: [{ name: 'Official source', url: 'https://example.gov/notice' }],
  author: writer.id,
  ...extra,
})

const draftUpdate = (title: string, extra: Any = {}, who: Any = null) =>
  payload.create({ collection: 'travel-updates', data: updateData(title, extra) as Any, draft: true, ...(who ? as(who) : {}) })

const read = (collection: string, id: string, draft = true) => payload.findByID({ collection: collection as Any, id, draft, depth: 0 })
const publicCopy = async (collection: string, id: string) => (await payload.find({ collection: collection as Any, where: { id: { equals: id } }, draft: false, overrideAccess: false, depth: 0 })).docs[0] ?? null

/** Pretend the scheduled time has passed, without waiting: move "Publish at" into the past directly. */
const makeDue = (collection: string, id: string) => payload.update({ collection: collection as Any, id, draft: true, data: { publishAt: new Date(Date.now() - MIN).toISOString() } as Any, overrideAccess: true, context: {} })

before(async () => {
  await setup()
  SCH = await import('../../src/lib/content/schedule')
  JOBS = await import('../../src/lib/community/jobs')
  writer = await payload.create({ collection: 'authors', data: { name: 'Schedule writer', slug: unique('w-'), biography: 'Bio' } as Any })
  for (const role of ['contributor', 'editor', 'publisher'] as const) {
    users[role] = await payload.create({ collection: 'staff', data: { name: role, email: `${role}-${unique('s')}@example.test`, password: 'x'.repeat(16), role } as Any })
  }
})

describe('scheduling: who can schedule', () => {
  it('a publisher can set "Publish at" on a draft; it stays a draft until then', async () => {
    const doc = await draftUpdate('Publisher schedules', {}, users.publisher)
    const when = inMinutes(60)
    const saved = await payload.update({ collection: 'travel-updates', id: doc.id, data: { publishAt: when } as Any, draft: true, ...as(users.publisher) })
    assert.equal(new Date(saved.publishAt as string).toISOString(), when)
    assert.equal((await read('travel-updates', doc.id))._status, 'draft')
    assert.equal(await publicCopy('travel-updates', doc.id), null, 'readers cannot see it yet')
  })

  it('an editor cannot schedule', async () => {
    const doc = await draftUpdate('Editor tries', {}, users.editor)
    await assert.rejects(payload.update({ collection: 'travel-updates', id: doc.id, data: { publishAt: inMinutes(30) } as Any, draft: true, ...as(users.editor) }), /publishAt/)
    await assert.rejects(draftUpdate('Editor creates scheduled', { publishAt: inMinutes(30) }, users.editor), /publishAt/)
  })

  it('refuses a time in the past', async () => {
    const doc = await draftUpdate('Past time', {}, users.publisher)
    await assert.rejects(payload.update({ collection: 'travel-updates', id: doc.id, data: { publishAt: new Date(Date.now() - 60 * MIN).toISOString() } as Any, draft: true, ...as(users.publisher) }))
  })

  it('an editor saving the draft afterwards cancels the schedule', async () => {
    const doc = await draftUpdate('Edited after scheduling', {}, users.publisher)
    await payload.update({ collection: 'travel-updates', id: doc.id, data: { publishAt: inMinutes(60) } as Any, draft: true, ...as(users.publisher) })
    await payload.update({ collection: 'travel-updates', id: doc.id, data: { summary: 'Unreviewed change.' } as Any, draft: true, ...as(users.editor) })
    const after = await read('travel-updates', doc.id)
    assert.equal(after.summary, 'Unreviewed change.')
    assert.equal(after.publishAt ?? null, null, 'the schedule is gone')
  })

  it('publishing by hand clears the schedule', async () => {
    const doc = await draftUpdate('Published by hand', {}, users.publisher)
    await payload.update({ collection: 'travel-updates', id: doc.id, data: { publishAt: inMinutes(60) } as Any, draft: true, ...as(users.publisher) })
    const live = await payload.update({ collection: 'travel-updates', id: doc.id, data: { _status: 'published' } as Any, ...as(users.publisher) })
    assert.equal(live.publishAt ?? null, null)
  })
})

describe('scheduling: the publish job', () => {
  it('publishes a due travel update and a due guide, and leaves future ones alone', async () => {
    const due = await draftUpdate('Due update')
    const later = await draftUpdate('Later update')
    await payload.update({ collection: 'travel-updates', id: later.id, data: { publishAt: inMinutes(120) } as Any, draft: true })
    await makeDue('travel-updates', due.id)

    const guide = await payload.create({
      collection: 'articles',
      data: { slug: unique('sched-guide-'), title: 'Due guide', deck: 'Deck', excerpt: 'Excerpt', type: 'practical-advice', body: lexical('Body'), primaryAuthor: writer.id, seo: { title: 'Due guide', description: 'D' } } as Any,
      draft: true,
    })
    await makeDue('articles', guide.id)

    const report = await SCH.publishDue(payload)
    assert.ok(report.published.some((p: string) => p.startsWith('travel-updates/')))
    assert.ok(report.published.some((p: string) => p.startsWith('articles/')))
    assert.equal(report.failed.length, 0)

    const live = await publicCopy('travel-updates', due.id)
    assert.ok(live, 'readers can see the due update')
    assert.ok(live.firstPublishedAt, 'first publication time stamped')
    assert.equal((await read('travel-updates', due.id)).publishAt ?? null, null, 'schedule cleared')
    assert.ok(await publicCopy('articles', guide.id), 'the due guide is live')
    assert.equal(await publicCopy('travel-updates', later.id), null, 'the future one waits')

    const again = await SCH.publishDue(payload)
    assert.ok(!again.published.some((p: string) => p.includes(due.slug)), 'running again changes nothing')
  })

  it('publishes a scheduled change to a page that is already live', async () => {
    const doc = await payload.create({ collection: 'travel-updates', data: { ...updateData('Live title'), _status: 'published' } as Any })
    await payload.update({ collection: 'travel-updates', id: doc.id, data: { title: 'New title from Monday' } as Any, draft: true })
    await makeDue('travel-updates', doc.id)
    assert.equal((await publicCopy('travel-updates', doc.id)).title, 'Live title', 'the live page is unchanged until the time comes')
    await SCH.publishDue(payload)
    assert.equal((await publicCopy('travel-updates', doc.id)).title, 'New title from Monday')
  })

  it('a document that cannot be published is not retried forever: the schedule is cleared and the reason shown', async () => {
    // A guide without its required search title cannot be published.
    const guide = await payload.create({
      collection: 'articles',
      data: { slug: unique('broken-'), title: 'Broken guide', deck: 'Deck', excerpt: 'Excerpt', type: 'practical-advice', body: lexical('Body'), primaryAuthor: writer.id } as Any,
      draft: true,
    })
    await makeDue('articles', guide.id)
    const report = await SCH.publishDue(payload)
    assert.ok(report.failed.some((p: string) => p.includes(guide.slug)))
    const after = await read('articles', guide.id)
    assert.equal(after._status, 'draft')
    assert.equal(after.publishAt ?? null, null)
    assert.match(after.scheduleNote, /^Not published at /)
    assert.equal((await SCH.publishDue(payload)).failed.length, 0, 'it is not tried again')
  })

  it('runs as the "publish" job, and an empty run is not recorded', async () => {
    assert.ok('publish' in JOBS.JOBS)
    await payload.delete({ collection: 'job-runs', where: { job: { equals: 'publish' } } })
    const empty = await JOBS.runJob('publish')
    assert.equal(empty.ok, true)
    assert.equal(empty.summary, 'nothing due')
    assert.equal((await payload.count({ collection: 'job-runs', where: { job: { equals: 'publish' } } })).totalDocs, 0)

    const doc = await draftUpdate('Job publishes')
    await makeDue('travel-updates', doc.id)
    const result = await JOBS.runJob('publish')
    assert.match(result.summary, /^published travel-updates\//)
    assert.equal((await payload.count({ collection: 'job-runs', where: { job: { equals: 'publish' } } })).totalDocs, 1)
  })
})
