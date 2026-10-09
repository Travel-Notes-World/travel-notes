/**
 * Weekly newsletter sign-up (src/lib/newsletter.ts): double opt-in, privacy of the list, and the
 * copy to Resend. Email and Resend calls are replaced by a stub: nothing leaves the machine.
 */
import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'

import { payload, setup, staff, unique, type Any } from './helpers'

let N: Any
const ENV_KEYS = ['EMAIL_TRANSPORT', 'RESEND_API_KEY', 'EMAIL_FROM', 'RESEND_CONTACTS_API_KEY', 'RESEND_NEWSLETTER_SEGMENT_ID', 'COMMUNITY_RATE_LIMIT_MULTIPLIER'] as const
let savedEnv: Record<string, string | undefined> = {}
const realFetch = globalThis.fetch
let calls: { url: string; method: string; body: Any }[] = []
const ip = () => `203.0.113.${Math.floor(Math.random() * 250)}-${unique('ip')}`
const rows = () => payload.find({ collection: 'newsletter-subscribers', limit: 100, depth: 0, overrideAccess: true, showHiddenFields: true }).then((r) => r.docs)

/** Use the real (stubbed) transports: confirmation emails and Resend contact calls are recorded. */
function liveMode(respond: (url: string, method: string) => Response = () => new Response('{}', { status: 200 })) {
  Object.assign(process.env, { EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_test_send', EMAIL_FROM: 'Travel Notes <hello@example.test>', RESEND_CONTACTS_API_KEY: 're_test_full', RESEND_NEWSLETTER_SEGMENT_ID: 'seg_123' })
  globalThis.fetch = (async (url: string, init: Any) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null })
    return respond(String(url), init?.method ?? 'GET')
  }) as Any
}
const tokenFromLastEmail = () => {
  const mail = [...calls].reverse().find((c) => c.url.endsWith('/emails'))
  const m = mail?.body?.text.match(/token=([A-Za-z0-9_-]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

before(async () => {
  await setup()
  N = await import('../../src/lib/newsletter')
})
beforeEach(async () => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  calls = []
  await payload.delete({ collection: 'newsletter-subscribers', where: { id: { exists: true } }, overrideAccess: true })
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  globalThis.fetch = realFetch
})
after(async () => { await payload.destroy?.() })

describe('signing up', () => {
  it('stores a pending row with only a hash of the token, and emails a confirmation link', async () => {
    liveMode()
    await N.requestSubscription({ email: ' Reader@Example.TEST ', source: '/newsletter' }, { ip: ip() })
    const [row] = await rows()
    assert.equal(row.email, 'reader@example.test')
    assert.equal(row.status, 'pending')
    assert.equal(row.source, '/newsletter')
    const token = tokenFromLastEmail()
    assert.ok(token, 'the email contains a confirmation link')
    assert.notEqual(row.tokenHash, token)
    assert.equal(row.tokenHash, N.hashToken(token))
    assert.ok(!calls.some((c) => c.url.includes('/contacts')), 'nothing is copied to Resend before confirmation')
  })

  it('rejects an invalid address and ignores bots', async () => {
    await assert.rejects(N.requestSubscription({ email: 'not-an-email' }, { ip: ip() }), (e: Any) => Boolean(e.fields?.email))
    await N.requestSubscription({ email: 'bot@example.test', website: 'http://spam.example' }, { ip: ip() })
    assert.equal((await rows()).length, 0)
  })

  it('gives the same answer for an address that is already confirmed, and sends nothing', async () => {
    liveMode()
    await N.requestSubscription({ email: 'twice@example.test' }, { ip: ip() })
    assert.equal(await N.confirmSubscription(tokenFromLastEmail()), 'confirmed')
    calls = []
    assert.deepEqual(await N.requestSubscription({ email: 'twice@example.test' }, { ip: ip() }), { ok: true })
    assert.equal(calls.length, 0)
  })

  it('limits confirmation emails to 3 a day per address', async () => {
    liveMode()
    process.env.COMMUNITY_RATE_LIMIT_MULTIPLIER = '1'
    for (let i = 0; i < 3; i++) await N.requestSubscription({ email: 'limit@example.test' }, { ip: ip() })
    await assert.rejects(N.requestSubscription({ email: 'limit@example.test' }, { ip: ip() }), (e: Any) => e.code === 'rate_limited')
  })
})

describe('confirming', () => {
  it('a valid token confirms once, records the time and copies the address to the Resend segment', async () => {
    liveMode()
    await N.requestSubscription({ email: 'yes@example.test' }, { ip: ip() })
    const token = tokenFromLastEmail()
    assert.deepEqual(await N.findPendingByToken(token), { email: 'yes@example.test' })
    assert.equal(await N.confirmSubscription(token), 'confirmed')
    const [row] = await rows()
    assert.equal(row.status, 'confirmed')
    assert.ok(row.confirmedAt)
    assert.equal(row.tokenHash, null)
    assert.equal(row.syncStatus, 'synced')
    const create = calls.find((c) => c.url.endsWith('/contacts') && c.method === 'POST')
    assert.deepEqual(create?.body, { email: 'yes@example.test', unsubscribed: false, segments: [{ id: 'seg_123' }] })
    assert.equal(await N.confirmSubscription(token), 'invalid', 'a used token does nothing')
  })

  it('an existing Resend contact is re-subscribed and added to the segment', async () => {
    liveMode((url, method) => (url.endsWith('/contacts') && method === 'POST' ? new Response('{"message":"Contact already exists"}', { status: 409 }) : new Response('{}', { status: 200 })))
    await N.requestSubscription({ email: 'back@example.test' }, { ip: ip() })
    await N.confirmSubscription(tokenFromLastEmail())
    assert.ok(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/contacts/back%40example.test') && c.body.unsubscribed === false))
    assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/contacts/back%40example.test/segments/seg_123')))
    assert.equal((await rows())[0].syncStatus, 'synced')
  })

  it('an expired or unknown token confirms nothing', async () => {
    liveMode()
    await N.requestSubscription({ email: 'late@example.test' }, { ip: ip() })
    const token = tokenFromLastEmail()
    const [row] = await rows()
    await payload.update({ collection: 'newsletter-subscribers', id: row.id, data: { tokenExpiresAt: new Date(Date.now() - 1000).toISOString() } as Any, overrideAccess: true })
    assert.equal(await N.findPendingByToken(token), null)
    assert.equal(await N.confirmSubscription(token), 'invalid')
    assert.equal(await N.confirmSubscription('x'.repeat(43)), 'invalid')
    assert.equal((await rows())[0].status, 'pending')
  })

  it('without the Resend settings the sign-up waits, and the daily job copies it later', async () => {
    liveMode()
    delete process.env.RESEND_CONTACTS_API_KEY
    await N.requestSubscription({ email: 'wait@example.test' }, { ip: ip() })
    await N.confirmSubscription(tokenFromLastEmail())
    let [row] = await rows()
    assert.equal(row.syncStatus, 'pending')
    assert.equal(row.syncAttempts, 0)
    process.env.RESEND_CONTACTS_API_KEY = 're_test_full'
    const report = await N.syncPendingSubscribers()
    assert.equal(report.synced, 1)
    ;[row] = await rows()
    assert.equal(row.syncStatus, 'synced')
  })

  it('the daily job removes sign-ups never confirmed after 30 days', async () => {
    liveMode()
    await N.requestSubscription({ email: 'old@example.test' }, { ip: ip() })
    const [row] = await rows()
    await payload.update({ collection: 'newsletter-subscribers', id: row.id, data: { requestedAt: new Date(Date.now() - 31 * 86_400_000).toISOString() } as Any, overrideAccess: true })
    await N.syncPendingSubscribers()
    assert.equal((await rows()).length, 0)
  })
})

describe('the list is private', () => {
  it('visitors and editors cannot read it; administrators can, but never the token', async () => {
    liveMode()
    await N.requestSubscription({ email: 'private@example.test' }, { ip: ip() })
    await assert.rejects(payload.find({ collection: 'newsletter-subscribers', overrideAccess: false }))
    await assert.rejects(payload.find({ collection: 'newsletter-subscribers', overrideAccess: false, user: { ...staff.editor, collection: 'staff' } }))
    const admin = await payload.update({ collection: 'staff', id: staff.admin.id, data: { role: 'administrator' } as Any })
    const found = await payload.find({ collection: 'newsletter-subscribers', overrideAccess: false, user: { ...admin, collection: 'staff' } })
    assert.equal(found.docs.length, 1)
    assert.equal(found.docs[0].tokenHash, undefined)
    await assert.rejects(payload.create({ collection: 'newsletter-subscribers', data: { email: 'x@example.test' } as Any, overrideAccess: false, user: { ...admin, collection: 'staff' } }))
    await payload.update({ collection: 'staff', id: staff.admin.id, data: { role: 'contributor' } as Any })
  })
})
