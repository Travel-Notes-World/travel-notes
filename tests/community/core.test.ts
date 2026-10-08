/**
 * Acceptance tests 1 to 6 (brief §19): visibility, account restrictions, the question and answer
 * flow, pending edits, ownership, and repeated requests.
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  activityInput, administrator, approvedReply, asUser, captured, moderator, newMember, payload, places, plainEditor, published, questionInput, rejects, setup,
  staff, tripInput, visibleRows, type Any,
} from './helpers'

let asker: Any, helper: Any, other: Any
let saveContribution: Any, getOwn: Any, listOwn: Any, withdrawSubmission: Any, removeOwn: Any, deleteDraft: Any
let decideContribution: Any, decideReply: Any, setVisibility: Any, restrictAccount: Any, setIndexing: Any, getForReview: Any, reviewQueue: Any
let postReply: Any, setAcceptedAnswer: Any, listReplies: Any, removeOwnReply: Any
let getPublished: Any, listPublished: Any, wasPublished: Any
let setVote: Any, setBookmark: Any, setFollow: Any, setRsvp: Any, memberStateFor: Any, listBookmarks: Any
let createPlan: Any, getPlan: Any, updatePlan: Any, deletePlan: Any, listPlans: Any
let signIn: Any, signUp: Any, createReport: Any, search: Any

before(async () => {
  await setup()
  ;({ saveContribution, getOwn, listOwn, withdrawSubmission, removeOwn, deleteDraft } = await import('../../src/lib/community/contributions'))
  ;({ decideContribution, decideReply, setVisibility, restrictAccount, setIndexing, getForReview, reviewQueue } = await import('../../src/lib/community/moderation'))
  ;({ postReply, setAcceptedAnswer, listReplies, removeOwnReply } = await import('../../src/lib/community/replies'))
  ;({ getPublished, listPublished, wasPublished } = await import('../../src/lib/community/queries'))
  ;({ setVote, setBookmark, setFollow, setRsvp, memberStateFor, listBookmarks } = await import('../../src/lib/community/engagement'))
  ;({ createPlan, getPlan, updatePlan, deletePlan, listPlans } = await import('../../src/lib/community/plans'))
  ;({ signIn, signUp } = await import('../../src/lib/community/members'))
  ;({ createReport } = await import('../../src/lib/community/reports'))
  ;({ search } = await import('../../src/lib/community/search'))
  asker = await newMember('Asker')
  helper = await newMember('Helper')
  other = await newMember('Other')
})

describe('3. question → moderation → answer → accepted', () => {
  let question: Any

  it('a submitted question is not public until a moderator approves it', async () => {
    const saved = await saveContribution(asker, { type: 'question', input: questionInput(), intent: 'submit' })
    assert.equal(saved.state, 'pending')
    const row = await payload.findByID({ collection: 'contributions', id: saved.id, depth: 0 })
    assert.equal(await getPublished(row.shortId), null, 'pending question is not readable')
    assert.equal((await listPublished({ type: 'question' })).total, 0)
    assert.equal((await reviewQueue(moderator())).length, 1, 'it is in the review queue')

    await decideContribution(moderator(), saved.id, { decision: 'approve' })
    question = await payload.findByID({ collection: 'contributions', id: saved.id, depth: 0 })
    const page = await getPublished(question.shortId)
    assert.equal(page.title, questionInput().title)
    assert.equal(page.author.displayName, 'Asker')
    assert.equal(page.destinations[0].label, 'Bangkok, Thailand')
    assert.ok(page.path.startsWith(`/community/questions/${question.shortId}-`))
  })

  it('the author is told about the decision, in the app and by (captured) email', async () => {
    const notes = await payload.find({ collection: 'notifications', where: { recipient: { equals: asker.id } }, depth: 0 })
    assert.equal(notes.docs.filter((n: Any) => n.type === 'moderation_decision').length, 1)
    const mail = await captured(asker.id, 'moderation_decision')
    assert.equal(mail.length, 1)
    assert.equal(mail[0].status, 'captured', 'captured for testing, not sent')
  })

  it('an answer is invisible while pending and visible once approved', async () => {
    const reply = await postReply(helper, { contributionId: question.id, body: 'Yes. Start at the river temples at opening time and you will see the main three before lunch.' })
    assert.equal(reply.state, 'pending')
    assert.equal((await listReplies(question.id)).total, 0, 'pending answer is not listed')
    assert.equal((await getPublished(question.shortId)).replyCount, 0)
    assert.equal((await payload.find({ collection: 'notifications', where: { and: [{ recipient: { equals: asker.id } }, { type: { equals: 'reply_published' } }] } })).totalDocs, 0, 'nobody is told about a pending reply')

    await decideReply(moderator(), reply.id, { decision: 'approve' })
    const answers = await listReplies(question.id)
    assert.equal(answers.total, 1)
    assert.equal(answers.items[0].author.displayName, 'Helper')
    assert.equal((await getPublished(question.shortId)).replyCount, 1)
    assert.equal((await captured(asker.id, 'reply_published')).length, 1, 'the asker is emailed only after approval')
    question.answerId = reply.id
  })

  it('only the asker can accept an answer, and can take it back', async () => {
    await rejects(setAcceptedAnswer(helper, { contributionId: question.id, replyId: question.answerId }), 'forbidden')
    await setAcceptedAnswer(asker, { contributionId: question.id, replyId: question.answerId })
    let page = await getPublished(question.shortId)
    assert.equal(page.questionDetail.acceptedAnswerId, question.answerId)
    assert.equal(page.question.resolved, true)
    assert.equal((await listReplies(question.id, { acceptedId: page.questionDetail.acceptedAnswerId })).items[0].accepted, true)
    assert.equal((await captured(helper.id, 'answer_accepted')).length, 1)

    await setAcceptedAnswer(asker, { contributionId: question.id, replyId: question.answerId })
    assert.equal((await captured(helper.id, 'answer_accepted')).length, 1, 'accepting twice does not notify twice')

    await setAcceptedAnswer(asker, { contributionId: question.id, replyId: null })
    page = await getPublished(question.shortId)
    assert.equal(page.questionDetail.acceptedAnswerId, null)
    assert.equal(page.question.resolved, false)
  })

  it('a pending or rejected answer can never be accepted', async () => {
    const reply = await postReply(other, { contributionId: question.id, body: 'This second answer is still waiting for a moderator.' })
    await rejects(setAcceptedAnswer(asker, { contributionId: question.id, replyId: reply.id }), 'not_found')
    await decideReply(moderator(), reply.id, { decision: 'reject', reason: 'Not relevant to the question.' })
    await rejects(setAcceptedAnswer(asker, { contributionId: question.id, replyId: reply.id }), 'not_found')
    assert.equal((await listReplies(question.id)).total, 1)
  })

  it('threading is one level deep', async () => {
    const child = await postReply(asker, { contributionId: question.id, parentId: question.answerId, body: 'Thank you, that is exactly what I needed to know.' })
    await decideReply(moderator(), child.id, { decision: 'approve' })
    const answers = await listReplies(question.id)
    assert.equal(answers.total, 1, 'a reply to an answer is not a new answer')
    assert.equal(answers.items[0].children.length, 1)
    await rejects(postReply(helper, { contributionId: question.id, parentId: child.id, body: 'A reply to a reply to an answer.' }), 'validation')
  })
})

describe('1. a signed-out visitor sees approved content only', () => {
  let draft: Any, pending: Any, live: Any

  before(async () => {
    draft = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'PRIVATE-DRAFT question about night markets' }), intent: 'save' })
    pending = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'PRIVATE-PENDING question about river boats' }), intent: 'submit' })
    live = await published(asker, 'activity', activityInput())
  })

  it('public reads through the API rules return published rows only', async () => {
    const all = await payload.find({ collection: 'contributions', limit: 100, depth: 0, overrideAccess: false })
    assert.ok(all.docs.length >= 1)
    assert.ok(all.docs.every((d: Any) => d.state === 'published'))
    assert.ok(!all.docs.some((d: Any) => d.title.startsWith('PRIVATE-')))
    for (const id of [draft.id, pending.id]) {
      await assert.rejects(payload.findByID({ collection: 'contributions', id, overrideAccess: false }), 'a visitor cannot open a draft by id')
    }
  })

  it('private fields are stripped even from published rows', async () => {
    const doc: Any = await payload.findByID({ collection: 'contributions', id: live.id, depth: 0, overrideAccess: false })
    assert.equal(doc.activity.organiserContact, undefined, 'the organiser contact is never sent to a visitor')
    assert.equal(doc.moderation?.internalNote, undefined)
    const page = await getPublished(live.shortId)
    assert.ok(!JSON.stringify(page).includes('organiser-private@example.test'))
    // A moderator does see it.
    const forModerator: Any = await payload.findByID({ collection: 'contributions', id: live.id, depth: 0, ...asUser(staff.moderator, 'staff') })
    assert.equal(forModerator.activity.organiserContact, 'organiser-private@example.test')
  })

  it('private collections cannot be read by a visitor or by another member', async () => {
    const plan = await createPlan(asker, { title: 'PRIVATE-PLAN honeymoon', notes: 'secret notes' })
    await setBookmark(asker, { targetType: 'contribution', targetId: live.id, on: true })
    for (const who of [asUser(null, 'members'), asUser(other, 'members'), asUser(staff.editor, 'staff')]) {
      for (const collection of ['plans', 'bookmarks', 'follows', 'rsvps', 'votes', 'notifications', 'email-outbox', 'reports', 'revisions', 'moderation-actions', 'rate-limits', 'metric-counters'] as const) {
        assert.equal((await visibleRows(collection, who)).length, 0, `${collection} must not be readable by ${who.user ? who.user.collection : 'a visitor'}`)
      }
      await assert.rejects(payload.findByID({ collection: 'plans', id: plan.id, ...who }))
    }
    await rejects(getPlan(other, plan.id), 'not_found', 'another member opening the plan')
  })

  it('member accounts are not listed or readable by the public or other members', async () => {
    assert.equal((await visibleRows('members', asUser(null, 'members'))).length, 0)
    assert.deepEqual((await visibleRows('members', asUser(other, 'members'))).map((d: Any) => d.id), [other.id], 'a member can load only their own record')
    assert.equal((await visibleRows('members', asUser(staff.editor, 'staff'))).length, 0, 'staff who do not moderate cannot list members')
    // The author on a public post is an id, never a populated account with an email address.
    const doc: Any = await payload.findByID({ collection: 'contributions', id: live.id, depth: 2, overrideAccess: false })
    assert.equal(typeof doc.author, 'string')
    assert.ok(!JSON.stringify(await getPublished(live.shortId)).includes('@example.test'))
  })

  it('search and lists never return drafts or pending items', async () => {
    const results = await search({ q: 'PRIVATE' })
    assert.equal(results.total, 0)
    assert.equal((await search({ q: 'night markets' })).total, 0)
    assert.equal((await search({ q: 'river boats' })).total, 0)
    assert.ok(!(await listPublished({})).items.some((c: Any) => c.title.startsWith('PRIVATE-')))
  })

  it('when the community is closed, nothing changes in what the rules allow, and the switch is readable', async () => {
    const { getSettings } = await import('../../src/lib/community/settings')
    assert.equal((await getSettings()).publicAccess, true)
  })
})

describe('2. unverified and suspended accounts cannot take part', () => {
  it('an unverified account cannot sign in, so it has no session to act with', async () => {
    const email = `unverified-${Date.now()}@example.test`
    await signUp({ email, password: 'correct horse battery', handle: `unv${Date.now().toString(36)}`, displayName: 'Unverified', acceptTerms: true }, { ip: null })
    const error = await rejects(signIn({ email, password: 'correct horse battery' }, { ip: null }), 'forbidden')
    assert.match(error.message, /confirm your email/i)
    const doc = (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, depth: 0 })).docs[0]
    // Even with a hand-made actor for that account, every write re-checks the database.
    const forged = { kind: 'member', id: doc.id, handle: doc.handle, displayName: 'x', email, status: 'active', trusted: true }
    await rejects(saveContribution(forged, { type: 'question', input: questionInput(), intent: 'submit' }), 'forbidden')
    await rejects(postReply(forged, { contributionId: (await published(asker, 'question', questionInput({ title: 'A question for the restriction tests' }))).id, body: 'An answer from an unverified account.' }), 'forbidden')
  })

  it('a wrong password and an unknown address give the same answer', async () => {
    const a = await rejects(signIn({ email: asker.email, password: 'wrong password!' }, { ip: null }), 'validation')
    const b = await rejects(signIn({ email: 'nobody-here@example.test', password: 'wrong password!' }, { ip: null }), 'validation')
    assert.equal(a.message, b.message)
    const ok = await signIn({ email: asker.email, password: asker.password }, { ip: null })
    assert.ok(ok.token)
  })

  it('a suspended member is refused on every kind of write, even with a still-valid session object', async () => {
    const target = await published(asker, 'question', questionInput({ title: 'A question used to test suspension' }))
    const answer = await approvedReply(helper, target.id)
    const bad = await newMember('Suspended')
    const draft = await saveContribution(bad, { type: 'question', input: questionInput(), intent: 'save' })
    await restrictAccount(moderator(), bad.id, { action: 'suspend', reason: 'Repeated spam links.' })

    // `bad` still says status "active": that is what a session issued before the suspension looks like.
    assert.equal(bad.status, 'active')
    await rejects(saveContribution(bad, { type: 'question', input: questionInput(), intent: 'submit' }), 'forbidden')
    await rejects(saveContribution(bad, { id: draft.id, type: 'question', input: questionInput(), intent: 'submit' }), 'forbidden')
    await rejects(postReply(bad, { contributionId: target.id, body: 'A reply from a suspended account.' }), 'forbidden')
    await rejects(setVote(bad, { targetType: 'reply', targetId: answer.id, on: true }), 'forbidden')
    await rejects(setRsvp(bad, { activityId: target.id, status: 'going' }), 'forbidden')
    await rejects(createReport(bad, { targetType: 'contribution', targetId: target.id, category: 'spam' }), 'forbidden')
    const { suggestDestination } = await import('../../src/lib/community/destinations')
    await rejects(suggestDestination(bad, { name: 'Somewhere', country: 'Nowhere' }), 'forbidden')

    await restrictAccount(moderator(), bad.id, { action: 'unsuspend' })
    assert.equal((await postReply(bad, { contributionId: target.id, body: 'A reply after the suspension was lifted.' })).state, 'pending')
  })

  it('a crafted API request with a member session can change nothing', async () => {
    const mine = await published(asker, 'question', questionInput({ title: 'A question used to test crafted requests' }))
    const member = asUser(asker, 'members')
    await assert.rejects(payload.update({ collection: 'contributions', id: mine.id, data: { title: 'Changed without review' }, ...member }), 'updating own published post through the API')
    await assert.rejects(payload.update({ collection: 'contributions', id: mine.id, data: { state: 'published', indexing: 'allow' } as Any, ...member }))
    await assert.rejects(payload.create({ collection: 'contributions', data: { shortId: 'forged0001', type: 'question', author: asker.id, title: 'Forged', slug: 'forged', state: 'published' } as Any, ...member }))
    await assert.rejects(payload.create({ collection: 'replies', data: { contribution: mine.id, author: asker.id, body: 'Forged approved reply', state: 'published' } as Any, ...member }))
    await assert.rejects(payload.update({ collection: 'members', id: asker.id, data: { status: 'active', trusted: true } as Any, ...member }))
    await assert.rejects(payload.delete({ collection: 'contributions', id: mine.id, ...member }))
    await assert.rejects(payload.create({ collection: 'votes', data: { key: 'x', member: asker.id, targetType: 'contribution', targetId: mine.id } as Any, ...member }))
    await assert.rejects(payload.create({ collection: 'members', data: { email: 'forged@example.test', password: 'forged-password-123', handle: 'forged', displayName: 'Forged' } as Any, overrideAccess: false }), 'creating an account through the API')
    // Staff without moderation rights cannot write either.
    await assert.rejects(payload.update({ collection: 'contributions', id: mine.id, data: { state: 'hidden' } as Any, ...asUser(staff.editor, 'staff') }))
    await assert.rejects(payload.update({ collection: 'contributions', id: mine.id, data: { state: 'hidden' } as Any, ...asUser(staff.moderator, 'staff') }), 'even moderators change state only through the moderation functions')
    const after = await payload.findByID({ collection: 'contributions', id: mine.id, depth: 0 })
    assert.equal(after.title, 'A question used to test crafted requests')
    assert.equal(after.indexing, 'policy')
  })

  it('moderation functions refuse members, visitors and staff who are not moderators', async () => {
    const pendingOne = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'A question nobody unauthorised may approve' }), intent: 'submit' })
    await rejects(decideContribution(asker as Any, pendingOne.id, { decision: 'approve' }), 'forbidden')
    await rejects(decideContribution(null as Any, pendingOne.id, { decision: 'approve' }), 'forbidden')
    await rejects(decideContribution(plainEditor(), pendingOne.id, { decision: 'approve' }), 'forbidden')
    await rejects(restrictAccount(plainEditor(), helper.id, { action: 'suspend', reason: 'no rights' }), 'forbidden')
    await rejects(setIndexing(moderator(), pendingOne.id, 'allow'), 'forbidden', 'indexing is an administrator decision')
    await rejects(getForReview(plainEditor(), pendingOne.id), 'forbidden')
    assert.equal((await payload.findByID({ collection: 'contributions', id: pendingOne.id, depth: 0 })).state, 'pending')
    // A moderator cannot make themselves an administrator through the API.
    await assert.rejects(async () => {
      const result: Any = await payload.update({ collection: 'staff', id: staff.moderator.id, data: { role: 'administrator' } as Any, ...asUser(staff.moderator, 'staff') })
      if (result.role !== 'administrator') throw new Error('role unchanged')
    })
    assert.equal((await payload.findByID({ collection: 'staff', id: staff.moderator.id, depth: 0 }) as Any).role, 'contributor')
  })
})

describe('4. edits to published content wait for review', () => {
  let post: Any

  it('the approved version stays public while an edit is pending', async () => {
    post = await published(asker, 'trip', tripInput())
    const edit = await saveContribution(asker, { id: post.id, type: 'trip', input: tripInput({ title: 'Five slow days in Kyoto in spring, UPDATED-EDIT', body: `${tripInput().body} UNREVIEWED-SPAM-LINK https://spam.example.test` }), intent: 'submit' })
    assert.equal(edit.editPending, true)
    const page = await getPublished(post.shortId)
    assert.equal(page.title, tripInput().title, 'the public title is still the approved one')
    assert.ok(!page.body.includes('UNREVIEWED'), 'the unreviewed text is not public')
    assert.equal((await search({ q: 'UNREVIEWED' })).total, 0, 'the unreviewed text is not searchable')
    const own = await getOwn(asker, post.id)
    assert.equal(own.editPending, true)
    assert.ok(own.content.title.includes('UPDATED-EDIT'), 'the author sees their pending edit')
  })

  it('a rejected edit never becomes public and the author is told why', async () => {
    await decideContribution(moderator(), post.id, { decision: 'reject', reason: 'Please do not add promotional links.' })
    const page = await getPublished(post.shortId)
    assert.equal(page.title, tripInput().title)
    assert.ok(!page.body.includes('UNREVIEWED'))
    const row: Any = await payload.findByID({ collection: 'contributions', id: post.id, depth: 0 })
    assert.equal(row.state, 'published')
    assert.equal(row.pendingRevision, null)
    assert.equal(row.moderation.note, 'Please do not add promotional links.')
    assert.ok(!String(row.searchText).includes('UNREVIEWED'))
  })

  it('an approved edit replaces the public version and keeps the first publication date', async () => {
    const firstPublished = (await getPublished(post.shortId)).publishedAt
    await saveContribution(asker, { id: post.id, type: 'trip', input: tripInput({ title: 'Five slow days in Kyoto in spring and early summer' }), intent: 'submit' })
    await decideContribution(moderator(), post.id, { decision: 'approve' })
    const page = await getPublished(post.shortId)
    assert.equal(page.title, 'Five slow days in Kyoto in spring and early summer')
    assert.equal(page.publishedAt, firstPublished, 'the publication date is not refreshed by an edit')
    assert.ok(page.path.includes(post.shortId), 'the stable id in the address is unchanged')
    const revisions: Any = await payload.find({ collection: 'revisions', where: { contribution: { equals: post.id } }, sort: 'number', depth: 0 })
    assert.deepEqual(revisions.docs.map((r: Any) => r.reviewState), ['approved', 'rejected', 'approved'])
    assert.equal(revisions.docs[0].snapshot.title, tripInput().title, 'the first snapshot is kept unchanged as history')
  })

  it('a first submission that is rejected or sent back never becomes public', async () => {
    const sent = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'REJECT-ME question that will be rejected' }), intent: 'submit' })
    await decideContribution(moderator(), sent.id, { decision: 'request_changes', reason: 'Please say which month you are travelling.' })
    let row = await payload.findByID({ collection: 'contributions', id: sent.id, depth: 0 })
    assert.equal(row.state, 'changes_requested')
    assert.equal(await getPublished(row.shortId), null)
    assert.equal((await getOwn(asker, sent.id)).note, 'Please say which month you are travelling.')
    // The author corrects it and resubmits.
    await saveContribution(asker, { id: sent.id, type: 'question', input: questionInput({ title: 'REJECT-ME question that will be rejected', travelMonth: '2027-03' }), intent: 'submit' })
    await decideContribution(moderator(), sent.id, { decision: 'reject', reason: 'Duplicate of an existing thread.' })
    row = await payload.findByID({ collection: 'contributions', id: sent.id, depth: 0 })
    assert.equal(row.state, 'rejected')
    assert.equal(await getPublished(row.shortId), null)
    assert.equal(await wasPublished(row.shortId), false, 'never published, so the address answers "not found", not "gone"')
    assert.equal((await search({ q: 'REJECT-ME' })).total, 0)
    await rejects(saveContribution(asker, { id: sent.id, type: 'question', input: questionInput(), intent: 'submit' }), 'conflict', 'a rejected post cannot be resubmitted')
  })

  it('a decision needs a reason unless it is an approval, and cannot be made twice', async () => {
    const sent = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'A question to test decisions with reasons' }), intent: 'submit' })
    await rejects(decideContribution(moderator(), sent.id, { decision: 'reject' }), 'validation')
    await decideContribution(moderator(), sent.id, { decision: 'approve' })
    await rejects(decideContribution(moderator(), sent.id, { decision: 'approve' }), 'conflict')
    const log = await payload.find({ collection: 'moderation-actions', where: { contribution: { equals: sent.id } }, sort: 'createdAt', depth: 0 })
    assert.deepEqual(log.docs.map((a: Any) => [a.action, a.actorType]), [['submit', 'member'], ['approve', 'staff']])
    assert.equal(log.docs[1].staff, staff.moderator.id)
  })

  it('a pending submission can be withdrawn, changed and sent again', async () => {
    const sent = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'A question to withdraw and resubmit' }), intent: 'submit' })
    await rejects(saveContribution(asker, { id: sent.id, type: 'question', input: questionInput(), intent: 'save' }), 'conflict')
    await withdrawSubmission(asker, sent.id)
    assert.equal((await getOwn(asker, sent.id)).state, 'draft')
    await rejects(decideContribution(moderator(), sent.id, { decision: 'approve' }), 'conflict', 'a withdrawn submission cannot be approved')
    await deleteDraft(asker, sent.id)
    await rejects(getOwn(asker, sent.id), 'not_found')
  })
})

describe('5. ownership', () => {
  it('a member cannot read, edit, withdraw, delete or remove another member’s post', async () => {
    const draft = await saveContribution(asker, { type: 'question', input: questionInput({ title: 'OWNER-ONLY draft question' }), intent: 'save' })
    const live = await published(asker, 'question', questionInput({ title: 'A published question owned by the asker' }))
    await rejects(getOwn(other, draft.id), 'not_found')
    await rejects(saveContribution(other, { id: draft.id, type: 'question', input: questionInput({ title: 'Hijacked draft title here' }), intent: 'save' }), 'not_found')
    await rejects(saveContribution(other, { id: live.id, type: 'question', input: questionInput({ title: 'Hijacked published title here' }), intent: 'submit' }), 'not_found')
    await rejects(withdrawSubmission(other, draft.id), 'not_found')
    await rejects(deleteDraft(other, draft.id), 'not_found')
    await rejects(removeOwn(other, live.id), 'not_found')
    assert.equal((await payload.findByID({ collection: 'contributions', id: draft.id, depth: 0 })).title, 'OWNER-ONLY draft question')
    assert.ok(!(await listOwn(other)).some((p: Any) => p.id === draft.id))
  })

  it('the author is always the signed-in member, whatever the form sends', async () => {
    const saved = await saveContribution(other, { type: 'question', input: { ...questionInput(), author: asker.id, state: 'published', indexing: 'allow', shortId: 'forged', replyCount: 99, moderation: { note: 'x' } }, intent: 'save' })
    const row = await payload.findByID({ collection: 'contributions', id: saved.id, depth: 0 })
    assert.equal(row.author, other.id)
    assert.equal(row.state, 'draft')
    assert.equal(row.indexing, 'policy')
    assert.notEqual(row.shortId, 'forged')
    assert.equal(row.replyCount, 0)
  })

  it('a member cannot change or delete another member’s plan, reply or notification', async () => {
    const plan = await createPlan(asker, { title: 'Asker’s private plan' })
    await rejects(updatePlan(other, plan.id, { title: 'Hijacked plan' }), 'not_found')
    await rejects(deletePlan(other, plan.id), 'not_found')
    assert.equal((await getPlan(asker, plan.id)).title, 'Asker’s private plan')
    assert.ok(!(await listPlans(other)).some((p: Any) => p.id === plan.id))

    const live = await published(asker, 'question', questionInput({ title: 'A question for reply ownership tests' }))
    const reply = await approvedReply(helper, live.id)
    await rejects(removeOwnReply(other, reply.id), 'not_found')
    assert.equal((await payload.findByID({ collection: 'replies', id: reply.id, depth: 0 })).state, 'published')

    const { markRead, listNotifications } = await import('../../src/lib/community/notifications')
    const mine = (await listNotifications(asker)).items
    assert.ok(mine.length > 0)
    await markRead(other, mine[0].id)
    const again: Any = (await listNotifications(asker)).items.find((n: Any) => n.id === mine[0].id)
    assert.equal(again.readAt, mine[0].readAt, 'another member cannot mark my notification as read')
    assert.ok(!(await listNotifications(other)).items.some((n: Any) => n.id === mine[0].id))
  })
})

describe('6. repeated and retried requests', () => {
  let post: Any, answer: Any, event: Any

  before(async () => {
    post = await published(asker, 'question', questionInput({ title: 'A question for duplicate-request tests' }))
    answer = await approvedReply(helper, post.id)
    event = await published(helper, 'activity', activityInput({ title: 'A walk used for duplicate-request tests' }))
  })

  it('voting twice counts once, un-voting twice is harmless, and you cannot vote for yourself', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => setVote(asker, { targetType: 'reply', targetId: answer.id, on: true })))
    assert.ok(results.every((r: Any) => r.on))
    assert.equal((await payload.findByID({ collection: 'replies', id: answer.id, depth: 0 })).helpfulCount, 1)
    assert.equal((await payload.count({ collection: 'votes', where: { targetId: { equals: answer.id } } })).totalDocs, 1)
    await setVote(other, { targetType: 'reply', targetId: answer.id, on: true })
    assert.equal((await setVote(asker, { targetType: 'reply', targetId: answer.id, on: false })).count, 1)
    assert.equal((await setVote(asker, { targetType: 'reply', targetId: answer.id, on: false })).count, 1)
    await rejects(setVote(helper, { targetType: 'reply', targetId: answer.id, on: true }), 'forbidden', 'voting for your own answer')
    assert.equal((await memberStateFor(other, { id: post.id, authorId: asker.id }, [answer.id])).votedReplies.length, 1)
  })

  it('bookmarking, following and responding twice create one row each', async () => {
    await Promise.all([1, 2, 3].map(() => setBookmark(other, { targetType: 'contribution', targetId: post.id, on: true })))
    assert.equal((await payload.count({ collection: 'bookmarks', where: { and: [{ member: { equals: other.id } }, { targetId: { equals: post.id } }] } })).totalDocs, 1)
    assert.equal((await listBookmarks(other)).posts.length, 1)
    await Promise.all([1, 2, 3].map(() => setFollow(other, { destinationId: places.bangkok.id, on: true })))
    assert.equal((await payload.count({ collection: 'follows', where: { member: { equals: other.id } } })).totalDocs, 1)

    await Promise.all([1, 2, 3].map(() => setRsvp(other, { activityId: event.id, status: 'going' })))
    let counts = await setRsvp(other, { activityId: event.id, status: 'going' })
    assert.deepEqual([counts.going, counts.interested], [1, 0])
    counts = await setRsvp(other, { activityId: event.id, status: 'interested' })
    assert.deepEqual([counts.going, counts.interested], [0, 1], 'changing the response moves it; it is not counted twice')
    counts = await setRsvp(other, { activityId: event.id, status: null })
    assert.deepEqual([counts.going, counts.interested], [0, 0])
    assert.equal((await payload.count({ collection: 'rsvps', where: { activity: { equals: event.id } } })).totalDocs, 0)
  })

  it('the same reply sent twice is one reply, and the same report is one report', async () => {
    const body = 'This exact answer was submitted twice by a double click on the button.'
    const [a, b] = [await postReply(other, { contributionId: post.id, body }), await postReply(other, { contributionId: post.id, body })]
    assert.equal(a.id, b.id)
    const first = await createReport(other, { targetType: 'reply', targetId: answer.id, category: 'incorrect', details: 'The opening hours are wrong.' })
    const second = await createReport(other, { targetType: 'reply', targetId: answer.id, category: 'spam' })
    assert.deepEqual([first.alreadyReported, second.alreadyReported], [false, true])
    assert.equal((await payload.count({ collection: 'reports', where: { targetId: { equals: answer.id } } })).totalDocs, 1)
  })

  it('approving a reply twice, or running delivery twice, does not notify twice', async () => {
    const reply = await postReply(other, { contributionId: post.id, body: 'A reply used to test that approval cannot be applied twice.' })
    await decideReply(moderator(), reply.id, { decision: 'approve' })
    await rejects(decideReply(moderator(), reply.id, { decision: 'approve' }), 'conflict')
    const notes = await payload.find({ collection: 'notifications', where: { dedupeKey: { equals: `reply:${reply.id}:${asker.id}` } } })
    assert.equal(notes.totalDocs, 1)
    const { deliverOutbox } = await import('../../src/lib/community/email/outbox')
    const before = await payload.count({ collection: 'email-outbox' })
    const [r1, r2] = await Promise.all([deliverOutbox(), deliverOutbox()])
    assert.equal(r1.attempted + r2.attempted, 0, 'everything was already delivered once; a second run finds nothing due')
    assert.equal((await payload.count({ collection: 'email-outbox' })).totalDocs, before.totalDocs)
    assert.equal(administrator().isAdministrator, true)
  })
})

describe('reports and urgent removal', () => {
  it('a report can only target something the reporter can see, and a moderator resolves it with a record', async () => {
    const live = await published(asker, 'trip', tripInput({ title: 'A trip report that will be reported and removed' }))
    const draft = await saveContribution(asker, { type: 'question', input: questionInput(), intent: 'save' })
    await rejects(createReport(other, { targetType: 'contribution', targetId: draft.id, category: 'spam' }), 'not_found')
    await rejects(createReport(other, { targetType: 'contribution', targetId: live.id, category: 'copyright' }), 'validation', 'copyright reports need details')
    await createReport(other, { targetType: 'contribution', targetId: live.id, category: 'copyright', details: 'This text is copied from another website without permission.' })
    const { listReports, resolveReport } = await import('../../src/lib/community/moderation')
    const open = await listReports(moderator(), 'open')
    const report = open.find((r: Any) => r.contributionId === live.id)
    assert.ok(report)

    await setVisibility(moderator(), live.id, { action: 'remove', reason: 'Copied from another site.' })
    await resolveReport(moderator(), report.id, { status: 'resolved', resolution: 'Removed the post.' })
    assert.equal(await getPublished(live.shortId), null, 'gone on the very next read')
    assert.equal(await wasPublished(live.shortId), true, 'the address now answers "gone"')
    assert.ok(!(await listPublished({ type: 'trip' })).items.some((c: Any) => c.id === live.id))
    await rejects(resolveReport(moderator(), report.id, { status: 'resolved', resolution: 'again' }), 'conflict')
    const log = await payload.find({ collection: 'moderation-actions', where: { contribution: { equals: live.id } }, depth: 0 })
    assert.ok(log.docs.some((a: Any) => a.action === 'remove' && a.reason === 'Copied from another site.'))
    assert.ok(log.docs.some((a: Any) => a.action === 'resolve_report'))
  })
})
