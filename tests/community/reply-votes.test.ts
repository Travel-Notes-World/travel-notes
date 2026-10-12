/** Likes and dislikes on answers and replies: one vote per member, switchable, ordering by score. */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { approvedReply, newMember, openCommunity, payload, published, questionInput, rejects, setup, type Any } from './helpers'

let E: Any, R: Any, MEM: Any
let asker: Any, question: Any

before(async () => {
  await setup()
  await openCommunity()
  E = await import('../../src/lib/community/engagement')
  R = await import('../../src/lib/community/replies')
  MEM = await import('../../src/lib/community/members')
  asker = await newMember('Asker')
  question = await published(asker, 'question', questionInput({ title: 'Which ferry is best for a day trip to the islands?' }))
})

const reply = (id: string): Promise<Any> => payload.findByID({ collection: 'replies', id, depth: 0 })

describe('likes and dislikes', () => {
  it('one vote per member: like, switch to dislike, remove; counts and score follow', async () => {
    const author = await newMember('Answerer')
    const voter = await newMember('Voter')
    const a = await approvedReply(author, question.id, 'The morning fast ferry is quickest, book a day ahead in summer.')
    let r = await E.setVote(voter, { targetType: 'reply', targetId: a.id, value: 1 })
    assert.deepEqual([r.value, r.likes, r.dislikes], [1, 1, 0])
    r = await E.setVote(voter, { targetType: 'reply', targetId: a.id, value: 1 })
    assert.equal(r.likes, 1, 'liking twice still counts once')
    r = await E.setVote(voter, { targetType: 'reply', targetId: a.id, value: -1 })
    assert.deepEqual([r.value, r.likes, r.dislikes], [-1, 0, 1], 'switching changes the one vote')
    assert.equal((await reply(a.id)).score, -1)
    r = await E.setVote(voter, { targetType: 'reply', targetId: a.id, value: 0 })
    assert.deepEqual([r.likes, r.dislikes], [0, 0])
    const rows = await payload.count({ collection: 'votes', where: { targetId: { equals: a.id } } })
    assert.equal(rows.totalDocs, 0)
  })

  it('you cannot vote on your own reply, and posts take likes only', async () => {
    const author = await newMember('Self voter')
    const a = await approvedReply(author, question.id, 'Take the slow ferry if you want the view, it is cheaper too.')
    await rejects(E.setVote(author, { targetType: 'reply', targetId: a.id, value: 1 }), 'forbidden')
    const other = await newMember('Post voter')
    await rejects(E.setVote(other, { targetType: 'contribution', targetId: question.id, value: -1 }), 'validation')
    const ok = await E.setVote(other, { targetType: 'contribution', targetId: question.id, on: true })
    assert.equal(ok.count, 1, 'the older "helpful" call still works')
  })

  it('answers are listed by likes minus dislikes, the accepted one first', async () => {
    const q = await published(asker, 'question', questionInput({ title: 'Is the night market open on Mondays in winter?' }))
    const [w1, w2, w3] = [await newMember('W1'), await newMember('W2'), await newMember('W3')]
    const low = await approvedReply(w1, q.id, 'I think it is closed on Mondays but check the sign at the gate.')
    const high = await approvedReply(w2, q.id, 'Yes, it opens every day from five in the evening, even in winter.')
    const mid = await approvedReply(w3, q.id, 'It was open when I went on a Monday in July last year.')
    const voters = [await newMember('V1'), await newMember('V2')]
    for (const v of voters) await E.setVote(v, { targetType: 'reply', targetId: high.id, value: 1 })
    await E.setVote(voters[0], { targetType: 'reply', targetId: mid.id, value: 1 })
    await E.setVote(voters[1], { targetType: 'reply', targetId: low.id, value: -1 })
    let list = await R.listReplies(q.id)
    assert.deepEqual(list.items.map((i: Any) => i.id), [high.id, mid.id, low.id])
    assert.equal(list.items[0].helpfulCount, 2)
    assert.equal(list.items[2].dislikeCount, 1)
    list = await R.listReplies(q.id, { acceptedId: low.id })
    assert.equal(list.items[0].id, low.id, 'the accepted answer still leads')
  })

  it('deleting an account removes its votes and recounts likes and dislikes', async () => {
    const author = await newMember('Counted')
    const a = await approvedReply(author, question.id, 'The ferry office near the pier sells tickets for every company.')
    const leaver = await newMember('Leaver')
    await E.setVote(leaver, { targetType: 'reply', targetId: a.id, value: -1 })
    assert.equal((await reply(a.id)).dislikeCount, 1)
    await MEM.deleteAccount(leaver, { password: leaver.password, removeContent: false })
    const after = await reply(a.id)
    assert.equal(after.dislikeCount, 0)
    assert.equal(after.score, 0)
  })
})
