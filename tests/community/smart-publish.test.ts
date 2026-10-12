/**
 * Smart publishing: established members' clean posts and answers go live straight away; first
 * posts, activities and anything the spam checks flag wait for a moderator; widely reported
 * content is hidden automatically.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { reviewReasons } from '../../src/lib/community/spam'
import { activityInput, moderator, newMember, openCommunity, payload, published, questionInput, setup, type Any } from './helpers'

let C: Any, M: Any, R: Any, REP: Any

before(async () => {
  await setup()
  C = await import('../../src/lib/community/contributions')
  M = await import('../../src/lib/community/moderation')
  R = await import('../../src/lib/community/replies')
  REP = await import('../../src/lib/community/reports')
  await openCommunity({ review: { smartPublish: true, smartPublishMinApproved: 1, autoHideReports: 3 } })
})

const load = (id: string): Promise<Any> => payload.findByID({ collection: 'contributions', id, depth: 0 })
const lastAudit = async (contribution: string): Promise<Any[]> => (await payload.find({ collection: 'moderation-actions', where: { contribution: { equals: contribution } }, sort: '-createdAt', limit: 5, depth: 0 })).docs

describe('spam checks', () => {
  it('flag links, contact details, spam words, shouting and repeated characters', () => {
    assert.deepEqual(reviewReasons({ title: 'Ferry times', body: 'See https://example.com for the timetable.' }), ['contains_link'])
    assert.deepEqual(reviewReasons({ body: 'Call me on +61 412 345 678 for a tour.' }), ['contact_details'])
    assert.deepEqual(reviewReasons({ body: 'Email me at someone@example.com please.' }), ['contact_details'])
    assert.ok(reviewReasons({ body: 'Best casino deals near the airport hotels.' }).includes('spam_words'))
    assert.ok(reviewReasons({ title: 'CHEAP FLIGHTS TO BALI NOW', body: 'Normal text here for the body of the post.' }).includes('shouting'))
    assert.ok(reviewReasons({ body: 'Amazing trip!!!!!!!!!!!! would go again.' }).includes('repeated_characters'))
  })
  it('leave normal travel writing alone, including dates, prices and years', () => {
    assert.deepEqual(reviewReasons({ title: 'Is the 2025-2026 ski pass worth it?', body: 'We travel on 2026-10-12 and the budget is $1,599 AUD for 14 days. The ferry costs 1 500 000 VND.' }), [])
    assert.deepEqual(reviewReasons({ title: 'Canberra to Sydney Airport for an early flight', body: 'Driving, the coach or staying the night before: which worked best for you?' }), [])
  })
  it('let trusted members share links', () => {
    assert.deepEqual(reviewReasons({ body: 'Timetable: https://example.com' }, { allowLinks: true }), [])
  })
})

describe('posts', () => {
  it('a new member’s first question waits for review and says why', async () => {
    const member = await newMember('First Timer')
    const saved = await C.saveContribution(member, { type: 'question', input: questionInput(), intent: 'submit' })
    assert.equal(saved.state, 'pending')
    assert.equal(saved.autoPublished, undefined)
    const submit = (await lastAudit(saved.id)).find((a: Any) => a.action === 'submit')
    assert.match(submit.reason, /first contribution/)
  })

  it('after one approval, a clean question is published straight away and logged as automatic', async () => {
    const member = await newMember('Regular')
    await published(member, 'question', questionInput({ title: 'Which side of the river is quieter at night?' }))
    const saved = await C.saveContribution(member, { type: 'question', input: questionInput({ title: 'Is the night market worth a second visit?' }), intent: 'submit' })
    assert.equal(saved.state, 'published')
    assert.equal(saved.autoPublished, true)
    assert.ok(saved.path?.startsWith('/community/questions/'))
    const doc = await load(saved.id)
    assert.equal(doc.state, 'published')
    assert.ok(doc.publishedAt)
    assert.equal(doc.pendingRevision, null)
    const approve = (await lastAudit(saved.id)).find((a: Any) => a.action === 'approve')
    assert.equal(approve.actorType, 'system')
    const fresh = await payload.findByID({ collection: 'members', id: member.id, depth: 0 })
    assert.equal(fresh.publishedCount, 2)
  })

  it('an established member’s post with a link, a phone number or spam words still waits', async () => {
    const member = await newMember('Linker')
    await published(member, 'question', questionInput({ title: 'Where do the airport buses stop in town?' }))
    for (const body of [
      'The timetable is at https://example.com but is it still right for this month?',
      'A driver offered a tour, his number is 0412 345 678. Has anyone used him before?',
      'Is it true there is a casino bus from the airport to the old town at night?',
    ]) {
      const saved = await C.saveContribution(member, { type: 'question', input: questionInput({ title: `Question ${Math.random().toString(36).slice(2, 8)} about the buses`, body }), intent: 'submit' })
      assert.equal(saved.state, 'pending', body)
    }
  })

  it('activities are always reviewed', async () => {
    const member = await newMember('Organiser')
    await published(member, 'question', questionInput({ title: 'Is the pier open on public holidays?' }))
    const saved = await C.saveContribution(member, { type: 'activity', input: activityInput({ organiserContact: 'Ask at the gate' }), intent: 'submit' })
    assert.equal(saved.state, 'pending')
    const submit = (await lastAudit(saved.id)).find((a: Any) => a.action === 'submit')
    assert.match(submit.reason, /activities are always reviewed/)
  })

  it('a clean edit by an established member goes live; an edit that adds a link waits', async () => {
    const member = await newMember('Editor')
    const doc = await published(member, 'question', questionInput({ title: 'How early should we reach the temple gates?' }))
    const clean = await C.saveContribution(member, { id: doc.id, type: 'question', input: questionInput({ title: 'How early should we reach the main temple gates?' }), intent: 'submit' })
    assert.equal(clean.autoPublished, true)
    assert.equal((await load(doc.id)).title, 'How early should we reach the main temple gates?')
    const linked = await C.saveContribution(member, { id: doc.id, type: 'question', input: questionInput({ title: 'How early should we reach the main temple gates?', body: 'The official page https://example.com says 6am. Is it really that early for good light?' }), intent: 'submit' })
    assert.equal(linked.editPending, true)
    const after = await load(doc.id)
    assert.ok(after.pendingRevision, 'the edit waits for review')
    assert.doesNotMatch(after.body, /example\.com/, 'the public version is unchanged')
  })

  it('switching smart publishing off sends everything to review', async () => {
    const member = await newMember('Paused')
    await published(member, 'question', questionInput({ title: 'Are the trains busy on Sunday mornings?' }))
    await openCommunity({ review: { smartPublish: false } })
    try {
      const saved = await C.saveContribution(member, { type: 'question', input: questionInput({ title: 'Are the trains busy on Saturday evenings?' }), intent: 'submit' })
      assert.equal(saved.state, 'pending')
    } finally {
      await openCommunity({ review: { smartPublish: true, smartPublishMinApproved: 1, autoHideReports: 3 } })
    }
  })
})

describe('answers', () => {
  it('a new member’s first answer waits; an established member’s clean answer is published', async () => {
    const asker = await newMember('Asker')
    const question = await published(asker, 'question', questionInput({ title: 'Is the old town walkable in summer heat?' }))
    const newcomer = await newMember('Newcomer')
    const first = await R.postReply(newcomer, { contributionId: question.id, body: 'Go early in the morning and rest in the afternoon, it gets very hot.' })
    assert.equal(first.state, 'pending')
    const regular = await newMember('Helper')
    await published(regular, 'question', questionInput({ title: 'Do the river boats run after dark?' }))
    const answer = await R.postReply(regular, { contributionId: question.id, body: 'Yes, but carry water and plan indoor stops between eleven and three.' })
    assert.equal(answer.state, 'published')
    const linked = await R.postReply(regular, { contributionId: question.id, body: 'There is a heat map here: https://example.com that helps a lot.' })
    assert.equal(linked.state, 'pending')
  })
})

describe('reports', () => {
  it('a post reported by three different members is hidden automatically; two reports are not enough', async () => {
    const author = await newMember('Reported')
    const doc = await published(author, 'question', questionInput({ title: 'Is the hill viewpoint open every day?' }))
    for (let i = 0; i < 2; i++) await REP.createReport(await newMember(`Reporter ${i}`), { targetType: 'contribution', targetId: doc.id, category: 'spam' })
    assert.equal((await load(doc.id)).state, 'published')
    await REP.createReport(await newMember('Reporter 3'), { targetType: 'contribution', targetId: doc.id, category: 'spam' })
    const hidden = await load(doc.id)
    assert.equal(hidden.state, 'hidden')
    const hide = (await lastAudit(doc.id)).find((a: Any) => a.action === 'hide')
    assert.equal(hide.actorType, 'system')
    // A moderator can bring it back.
    await M.setVisibility(moderator(), doc.id, { action: 'unhide' })
    assert.equal((await load(doc.id)).state, 'published')
  })
})

describe('sexual content and photos', () => {
  it('sexual or adult-services words are held, without catching ordinary words', () => {
    assert.ok(reviewReasons({ body: 'Looking for escorts near the hotel tonight.' }).includes('sexual_content'))
    assert.ok(reviewReasons({ title: 'Is the nude beach family friendly?', body: 'We want to avoid it with the kids, which part of the coast is it on?' }).includes('sexual_content'))
    assert.deepEqual(reviewReasons({ title: 'Day trips from London to Sussex and Essex', body: 'Which towns are worth a full day by train in the summer holidays?' }), [])
  })

  it('an established member’s post with a new photo waits; one that only keeps approved photos does not', async () => {
    const { decidePublishing } = await import('../../src/lib/community/spam')
    const base = { enabled: true, minApproved: 1, text: { title: 'Kyoto in spring', body: 'Five slow days, here is what it cost.' } }
    assert.deepEqual(decidePublishing({ ...base, member: { trusted: false, approvedCount: 3 }, newPhotos: 1 }), { publish: false, reasons: ['has new photos'] })
    assert.deepEqual(decidePublishing({ ...base, member: { trusted: false, approvedCount: 3 }, newPhotos: 0 }), { publish: true })
    assert.deepEqual(decidePublishing({ ...base, member: { trusted: true, approvedCount: 0 }, newPhotos: 2 }), { publish: true })
  })

  it('members can report sexual or adult content', async () => {
    const author = await newMember('Poster')
    const doc = await published(author, 'question', questionInput({ title: 'Which beach is quietest in the early morning?' }))
    const result = await REP.createReport(await newMember('Reporter S'), { targetType: 'contribution', targetId: doc.id, category: 'sexual_content' })
    assert.equal(result.alreadyReported, false)
  })
})
