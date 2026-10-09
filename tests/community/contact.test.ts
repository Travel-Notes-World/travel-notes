/**
 * The public contact form (/contact): validation, bot trap, rate limits, who can read the
 * messages, and how they are emailed to the inbox.
 */
import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'

import { payload, setup, staff, unique, type Any } from './helpers'

let C: Any
const ENV_KEYS = ['EMAIL_TRANSPORT', 'RESEND_API_KEY', 'EMAIL_FROM', 'CONTACT_INBOX', 'COMMUNITY_RATE_LIMIT_MULTIPLIER'] as const
let savedEnv: Record<string, string | undefined> = {}
const realFetch = globalThis.fetch

const valid = (over: Any = {}) => ({
  name: 'Sam Reader',
  email: 'Sam.Reader@Example.test',
  topic: 'correction',
  subject: 'Ferry times are out of date',
  pageUrl: 'https://travelnotesworld.com/stories/example',
  message: 'The article says the ferry leaves at 9 am, but the timetable changed in September.',
  ...over,
})
const ip = () => `198.51.100.${Math.floor(Math.random() * 250)}-${unique('ip')}`
const all = () => payload.find({ collection: 'contact-messages', limit: 100, depth: 0, overrideAccess: true }).then((r) => r.docs)

before(async () => {
  await setup()
  C = await import('../../src/lib/contact')
})
beforeEach(async () => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  await payload.delete({ collection: 'contact-messages', where: { id: { exists: true } }, overrideAccess: true })
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  globalThis.fetch = realFetch
})
after(async () => { await payload.destroy?.() })

describe('contact form: saving a message', () => {
  it('saves a valid message, with the email address in lower case', async () => {
    await C.submitContactMessage(valid(), { ip: ip() })
    const docs = await all()
    assert.equal(docs.length, 1)
    assert.equal(docs[0].email, 'sam.reader@example.test')
    assert.equal(docs[0].topic, 'correction')
    assert.equal(docs[0].status, 'new')
    // The tests use the capture transport, so nothing is sent.
    assert.equal(docs[0].emailStatus, 'captured')
  })

  it('reports every invalid field and saves nothing', async () => {
    await assert.rejects(
      C.submitContactMessage({ name: ' ', email: 'not-an-email', topic: 'lottery', subject: '', pageUrl: 'javascript:alert(1)', message: 'too short' }, { ip: ip() }),
      (error: Any) => {
        assert.deepEqual(Object.keys(error.fields).sort(), ['email', 'message', 'name', 'pageUrl', 'subject', 'topic'])
        return true
      },
    )
    assert.equal((await all()).length, 0)
  })

  it('refuses messages stuffed with links', async () => {
    const links = Array.from({ length: 6 }, (_, i) => `https://spam${i}.example`).join(' ')
    await assert.rejects(C.submitContactMessage(valid({ message: `Great site, visit ${links}` }), { ip: ip() }), (error: Any) => Boolean(error.fields?.message))
  })

  it('drops bots that fill the hidden field, without telling them', async () => {
    const result = await C.submitContactMessage(valid({ website: 'https://bot.example' }), { ip: ip() })
    assert.deepEqual(result, { ok: true })
    assert.equal((await all()).length, 0)
  })

  it('limits one network address to five messages an hour', async () => {
    process.env.COMMUNITY_RATE_LIMIT_MULTIPLIER = '1'
    const address = ip()
    for (let i = 0; i < 5; i++) await C.submitContactMessage(valid({ subject: `Message ${i}` }), { ip: address })
    await assert.rejects(C.submitContactMessage(valid(), { ip: address }), (error: Any) => error.code === 'rate_limited')
    // Someone else is not affected.
    await C.submitContactMessage(valid(), { ip: ip() })
    assert.equal((await all()).length, 6)
  })
})

describe('contact form: who can see and change messages', () => {
  const asStaff = (doc: Any) => ({ ...doc, collection: 'staff' })

  it('visitors and contributors cannot read or create messages through the CMS API', async () => {
    await C.submitContactMessage(valid(), { ip: ip() })
    await assert.rejects(payload.find({ collection: 'contact-messages', overrideAccess: false }))
    await assert.rejects(payload.find({ collection: 'contact-messages', overrideAccess: false, user: asStaff(staff.moderator) }))
    await assert.rejects(payload.create({ collection: 'contact-messages', overrideAccess: false, user: asStaff(staff.editor), data: valid() as Any }))
  })

  it('editors can read messages and mark them handled, but cannot change what the visitor wrote', async () => {
    await C.submitContactMessage(valid(), { ip: ip() })
    const editor = asStaff(staff.editor)
    const found = await payload.find({ collection: 'contact-messages', overrideAccess: false, user: editor })
    assert.equal(found.docs.length, 1)
    const id = found.docs[0].id
    await payload.update({ collection: 'contact-messages', id, overrideAccess: false, user: editor, data: { status: 'handled', note: 'Fixed the article.', message: 'Changed text', email: 'other@example.test' } as Any })
    const after = await payload.findByID({ collection: 'contact-messages', id, overrideAccess: true })
    assert.equal(after.status, 'handled')
    assert.equal(after.note, 'Fixed the article.')
    assert.equal(after.message, valid().message)
    assert.equal(after.email, 'sam.reader@example.test')
  })
})

describe('contact form: emailing the inbox', () => {
  const useResend = () => {
    process.env.EMAIL_TRANSPORT = 'resend'
    process.env.RESEND_API_KEY = 're_test_not_real'
    process.env.EMAIL_FROM = 'Travel Notes <hello@example.test>'
  }

  it('keeps the message waiting, without using up attempts, while no inbox is set', async () => {
    useResend()
    delete process.env.CONTACT_INBOX
    let calls = 0
    globalThis.fetch = (async () => { calls++; return new Response('{}') }) as typeof fetch
    await C.submitContactMessage(valid(), { ip: ip() })
    const [doc] = await all()
    assert.equal(doc.emailStatus, 'pending')
    assert.equal(doc.emailAttempts, 0)
    assert.match(String(doc.emailError), /CONTACT_INBOX/)
    assert.equal(calls, 0)
  })

  it('emails the inbox with the visitor as reply-to, and the daily job sends what was waiting', async () => {
    useResend()
    delete process.env.CONTACT_INBOX
    await C.submitContactMessage(valid(), { ip: ip() })

    process.env.CONTACT_INBOX = 'inbox@example.test'
    const sent: Any[] = []
    globalThis.fetch = (async (_url: string, init: Any) => { sent.push({ body: JSON.parse(init.body), key: init.headers['Idempotency-Key'] }); return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 }) }) as Any
    const report = await C.deliverPendingContactMessages()
    assert.equal(report.sent, 1)
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0].body.to, ['inbox@example.test'])
    assert.equal(sent[0].body.reply_to, 'sam.reader@example.test')
    assert.equal(sent[0].body.subject, '[Contact] Ferry times are out of date')
    assert.match(sent[0].key, /^contact:/)
    const [doc] = await all()
    assert.equal(doc.emailStatus, 'sent')

    // Already sent: running the job again sends nothing more.
    await C.deliverPendingContactMessages()
    assert.equal(sent.length, 1)
  })

  it('escapes what the visitor typed in the HTML email', async () => {
    useResend()
    process.env.CONTACT_INBOX = 'inbox@example.test'
    let html = ''
    globalThis.fetch = (async (_url: string, init: Any) => { html = JSON.parse(init.body).html; return new Response('{}', { status: 200 }) }) as Any
    await C.submitContactMessage(valid({ name: '<b>Bold</b>', message: 'Hello <script>alert(1)</script> there, this is long enough.' }), { ip: ip() })
    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(html.includes('&lt;b&gt;Bold&lt;/b&gt;'))
  })

  it('keeps a failed email for a retry, and the message itself is never lost', async () => {
    useResend()
    process.env.CONTACT_INBOX = 'inbox@example.test'
    globalThis.fetch = (async () => new Response('busy', { status: 503 })) as Any
    const result = await C.submitContactMessage(valid(), { ip: ip() })
    assert.deepEqual(result, { ok: true })
    const [doc] = await all()
    assert.equal(doc.emailStatus, 'pending')
    assert.equal(doc.emailAttempts, 1)
    assert.match(String(doc.emailError), /503/)
  })
})
