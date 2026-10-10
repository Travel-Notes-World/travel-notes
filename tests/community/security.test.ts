/**
 * Regression tests for the findings of the independent security review (see
 * docs/community/test-results.md): redirects, REST exposure, sign-in lockout, account deletion.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { activityInput, moderator, newMember, payload, published, questionInput, setup, staff, type Any } from './helpers'

let MEM: Any, E: Any, ACCESS: Any, SESSION: Any

before(async () => {
  await setup()
  MEM = await import('../../src/lib/community/members')
  E = await import('../../src/lib/community/engagement')
  ACCESS = await import('../../src/access/community')
  SESSION = await import('../../src/lib/community/paths')
})
after(async () => { await payload.destroy?.() })

describe('return addresses after sign-in and forms', () => {
  it('only same-site paths are accepted, including tab, newline and backslash tricks', () => {
    const safe = SESSION.safeReturnPath
    assert.equal(safe('/community/questions?page=2#answers'), '/community/questions?page=2#answers')
    for (const bad of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/\t\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/api/members', '', null, 42]) {
      assert.equal(safe(bad), '/account', `refused: ${JSON.stringify(bad)}`)
    }
  })
})

describe('raw REST API reads', () => {
  const rest = (user: Any = null) => ({ req: { payloadAPI: 'REST', user, url: 'http://site/api/contributions' } })
  it('visitors and members cannot list community posts or replies through REST; site pages still can', () => {
    assert.equal(ACCESS.publishedOrModerator(rest()), false)
    assert.equal(ACCESS.publishedOrModerator(rest({ collection: 'members', id: 'x' })), false)
    assert.deepEqual(ACCESS.publishedOrModerator({ req: { payloadAPI: 'local', user: null } }), { state: { equals: 'published' } })
    assert.equal(ACCESS.publishedOrModerator(rest({ ...staff.moderator, collection: 'staff' })), true)
  })
  it('photo files stay reachable while the photo records are not listed', async () => {
    const { Media } = await import('../../src/collections/community/Media')
    const read = Media.access!.read as Any
    assert.equal(read({ req: { payloadAPI: 'REST', user: null, url: 'http://site/api/media' } }), false)
    assert.deepEqual(read({ req: { payloadAPI: 'REST', user: null, url: 'http://site/api/media/file/abc.webp' } }), { state: { equals: 'approved' } })
  })
})

describe('sign-in protection', () => {
  it('wrong passwords never lock the real owner out or reveal that the account exists', async () => {
    const member = await newMember('Locked')
    for (let i = 0; i < 12; i++) {
      await assert.rejects(MEM.signIn({ email: member.email, password: 'wrong password!' }, { ip: `198.51.100.${i}` }), (e: Any) => e.code === 'validation')
    }
    const unknown = await MEM.signIn({ email: 'nobody-here@example.test', password: 'wrong password!' }, { ip: '198.51.100.99' }).catch((e: Any) => e)
    assert.equal(unknown.message, 'The email address or password is not correct.')
    const ok = await MEM.signIn({ email: member.email, password: member.password }, { ip: '203.0.113.5' })
    assert.ok(ok.token, 'the owner can still sign in from their own connection')
  })
})

describe('account deletion removes private contact details and choices', () => {
  it('organiser contact, edit history copies and helpful votes go; removed posts keep no text', async () => {
    const leaver = await newMember('Organiser who leaves')
    const other = await newMember('Other')
    const event = await published(leaver, 'activity', activityInput({ title: 'Activity by someone who deletes their account', organiserContact: 'leaver-private@example.test' }))
    const question = await published(other, 'question', questionInput({ title: 'A question the leaver found helpful' }))
    await E.setVote(leaver, { targetType: 'contribution', targetId: question.id, on: true })
    const own = await published(leaver, 'question', questionInput({ title: 'LEAVER-TEXT a question removed with the account' }))
    await MEM.deleteAccount(leaver, { password: leaver.password, removeContent: true })

    const after = await payload.findByID({ collection: 'contributions', id: event.id, depth: 0 })
    assert.ok(!after.activity?.organiserContact, 'organiser contact erased')
    const revisions = await payload.find({ collection: 'revisions', where: { contribution: { equals: event.id } }, depth: 0 })
    assert.ok(!JSON.stringify(revisions.docs).includes('leaver-private@example.test'), 'and erased from the edit history')
    const removed = await payload.findByID({ collection: 'contributions', id: own.id, depth: 0 })
    assert.equal(removed.state, 'removed')
    assert.ok(!removed.title.includes('LEAVER-TEXT') && !removed.body, 'removed posts keep no text')
    assert.equal((await payload.count({ collection: 'votes', where: { member: { equals: leaver.id } } })).totalDocs, 0)
    assert.equal(Number((await payload.findByID({ collection: 'contributions', id: question.id, depth: 0 })).helpfulCount), 0, 'helpful count recounted')
    void moderator
  })
})

describe('staff password reset email', () => {
  it('contains a full link on the site’s own address, not a bare /admin path', async () => {
    const saved = { t: process.env.EMAIL_TRANSPORT, k: process.env.RESEND_API_KEY, f: process.env.EMAIL_FROM }
    const realFetch = globalThis.fetch
    let body: Any = null
    process.env.EMAIL_TRANSPORT = 'resend'
    process.env.RESEND_API_KEY = 're_test_not_real'
    process.env.EMAIL_FROM = 'Travel Notes <hello@example.test>'
    globalThis.fetch = (async (_url: string, init: Any) => { body = JSON.parse(init.body); return new Response('{}', { status: 200 }) }) as Any
    try {
      await payload.forgotPassword({ collection: 'staff', data: { email: staff.editor.email } })
    } finally {
      globalThis.fetch = realFetch
      process.env.EMAIL_TRANSPORT = saved.t
      if (saved.k === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = saved.k
      if (saved.f === undefined) delete process.env.EMAIL_FROM
      else process.env.EMAIL_FROM = saved.f
    }
    const { siteUrl } = await import('../../src/lib/site')
    assert.ok(body, 'an email was sent')
    assert.equal(body.subject, 'Reset your Travel Notes CMS password')
    assert.match(body.html, new RegExp(`href="${siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/admin/reset/[a-f0-9]+"`))
    assert.ok(!body.html.includes('href="/admin'), 'no bare relative link')
  })
})
