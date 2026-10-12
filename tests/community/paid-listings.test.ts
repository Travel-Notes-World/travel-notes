/**
 * Paid business listings: only commercial activities pay; the fee is taken before review; a
 * payment is recorded once however many times it is confirmed; declined or deleted listings are
 * refunded; invoices are private. Stripe is replaced by a fake so no network is used.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { activityInput, moderator, newMember, openCommunity, payload, rejects, setup, type Any } from './helpers'

let C: Any, M: Any, L: Any, SEO: Any, S: Any, STRIPE: Any

const TEST_ABN = '51 824 753 556' // A valid ABN checksum, used only in tests.
type FakeSession = { id: string; url: string; paymentStatus: string; paymentIntentId: string | null; customerEmail: string | null; metadata: Record<string, string> }
const sessions = new Map<string, FakeSession>()
const refunds: string[] = []
let counter = 0

const fake = {
  async createCheckout(input: Any) {
    const id = `cs_test_${++counter}`
    const session = { id, url: `https://checkout.example/${id}`, paymentStatus: 'unpaid', paymentIntentId: null, customerEmail: input.customerEmail, metadata: input.metadata }
    sessions.set(id, session)
    return session
  },
  async getCheckout(id: string) {
    const s = sessions.get(id)
    if (!s) throw new Error('no such session')
    return s
  },
  async refund(paymentIntentId: string) {
    refunds.push(paymentIntentId)
  },
  verifyWebhook() {
    throw new Error('not used')
  },
}
const pay = (sessionId: string) => {
  const s = sessions.get(sessionId)!
  s.paymentStatus = 'paid'
  s.paymentIntentId = `pi_${sessionId}`
}

const businessInput = (over: Any = {}) => activityInput({ category: 'commercial_activity', title: 'Morning food tour of the old town market', priceState: 'paid', price: '49', priceCurrency: 'AUD', bookingUrl: 'https://example.com/book', ...over })
const openWithFees = (over: Any = {}) =>
  openCommunity({ listings: { enabled: true, feeAud: 5, priceLabel: 'Launch price', gstRegistered: true, sellerName: 'Test Seller', sellerAbn: TEST_ABN, ...over } })

before(async () => {
  await setup()
  C = await import('../../src/lib/community/contributions')
  M = await import('../../src/lib/community/moderation')
  L = await import('../../src/lib/community/listings')
  SEO = await import('../../src/lib/community/seo')
  S = await import('../../src/lib/community/settings')
  STRIPE = await import('../../src/lib/community/payments/stripe')
  STRIPE.setPaymentGatewayForTests(fake)
  await openWithFees()
})
after(() => STRIPE.setPaymentGatewayForTests(null))

const paymentsOf = async (contributionId: string) => (await payload.find({ collection: 'listing-payments', where: { contribution: { equals: contributionId } }, sort: 'createdAt', depth: 0 })).docs as Any[]
const revisionsOf = async (contributionId: string) => (await payload.count({ collection: 'revisions', where: { contribution: { equals: contributionId } } })).totalDocs
const load = (id: string): Promise<Any> => payload.findByID({ collection: 'contributions', id, depth: 0 })

/** Save a business listing, start checkout, pay and confirm. Returns the contribution id and the session id. */
async function paidListing(member: Any, over: Any = {}) {
  const saved = await C.saveContribution(member, { type: 'activity', input: businessInput(over), intent: 'submit' })
  const checkout = await L.startListingCheckout(member, saved.id, { base: 'https://travelnotes.test' })
  const sessionId = new URL(checkout.url).pathname.slice(1)
  pay(sessionId)
  await L.confirmListingPayment(sessionId)
  return { id: saved.id as string, sessionId }
}

describe('fee rules', () => {
  it('validates ABNs and works out GST as one eleventh', () => {
    assert.equal(L.validAbn(TEST_ABN), true)
    assert.equal(L.validAbn('51 824 753 557'), false)
    assert.equal(L.validAbn('123'), false)
    assert.equal(L.gstIncluded(500), 45)
  })

  it('charges only when switched on, priced, connected to Stripe and with a valid seller', async () => {
    const fee = L.listingFee(await S.getSettings())
    assert.equal(fee.charge, true)
    assert.equal(fee.amountMinor, 500)
    assert.equal(fee.gstMinor, 45)
    // The settings page refuses an invalid ABN, and the fee logic refuses one too.
    await assert.rejects(openWithFees({ sellerAbn: '12 345 678 901' }), /Seller ABN/)
    const base = await S.getSettings()
    const bad = L.listingFee({ ...base, listings: { ...base.listings, sellerAbn: '12345678901' } })
    assert.equal(bad.charge, false)
    assert.ok(bad.notReady.some((r: string) => r.includes('ABN')))
    assert.equal(L.listingFee({ ...base, listings: { ...base.listings, enabled: false } }).charge, false)
    assert.equal(L.listingFee({ ...base, listings: { ...base.listings, sellerName: '' } }).charge, false)
  })
})

describe('paying for a business listing', () => {
  it('a meet-up goes straight to review; a business listing waits for payment as a draft', async () => {
    const member = await newMember('Organiser')
    const meetup = await C.saveContribution(member, { type: 'activity', input: activityInput(), intent: 'submit' })
    assert.equal(meetup.state, 'pending')
    assert.equal(meetup.needsPayment, undefined)

    const business = await C.saveContribution(member, { type: 'activity', input: businessInput(), intent: 'submit' })
    assert.equal(business.needsPayment, true)
    assert.equal(business.state, 'draft')
    assert.equal(await revisionsOf(business.id), 0, 'nothing goes to review before payment')
  })

  it('records the payment once, sends the listing for review once, and keeps the seller details', async () => {
    const member = await newMember('Tour Operator')
    const saved = await C.saveContribution(member, { type: 'activity', input: businessInput(), intent: 'submit' })
    const checkout = await L.startListingCheckout(member, saved.id, { base: 'https://travelnotes.test' })
    assert.match(checkout.url, /^https:\/\/checkout\.example\//)
    const sessionId = new URL(checkout.url).pathname.slice(1)

    assert.equal((await L.confirmListingPayment(sessionId)).status, 'unpaid')
    assert.equal((await load(saved.id)).state, 'draft')

    pay(sessionId)
    assert.equal((await L.confirmListingPayment(sessionId)).status, 'paid')
    assert.equal((await L.confirmListingPayment(sessionId)).status, 'paid', 'the webhook and the browser can both confirm')
    assert.equal((await load(saved.id)).state, 'pending')
    assert.equal(await revisionsOf(saved.id), 1, 'sent for review exactly once')

    const [payment] = await paymentsOf(saved.id)
    assert.equal(payment.status, 'paid')
    assert.equal(payment.amountMinor, 500)
    assert.equal(payment.gstMinor, 45)
    assert.equal(payment.sellerName, 'Test Seller')
    assert.equal(payment.stripePaymentIntentId, `pi_${sessionId}`)
    assert.match(payment.invoiceNumber, /^TN-\d{8}-[0-9A-F]{6}$/)
    const audit = await payload.find({ collection: 'moderation-actions', where: { and: [{ contribution: { equals: saved.id } }, { action: { equals: 'listing_paid' } }] }, depth: 0 })
    assert.equal(audit.totalDocs, 1)

    await rejects(L.startListingCheckout(member, saved.id, { base: 'https://travelnotes.test' }), 'conflict')
  })

  it('a listing sent back for changes is resubmitted without paying again', async () => {
    const member = await newMember('Fixer')
    const { id } = await paidListing(member)
    await M.decideContribution(moderator(), id, { decision: 'request_changes', reason: 'Please add the meeting point.' })
    const again = await C.saveContribution(member, { id, type: 'activity', input: businessInput({ venueName: 'Main gate of the market' }), intent: 'submit' })
    assert.equal(again.needsPayment, undefined)
    assert.equal(again.state, 'pending')
    assert.equal((await paymentsOf(id)).filter((p) => p.status === 'paid').length, 1)
  })
})

describe('refunds', () => {
  it('a declined listing is refunded automatically and logged', async () => {
    const member = await newMember('Declined')
    const { id, sessionId } = await paidListing(member)
    await M.decideContribution(moderator(), id, { decision: 'reject', reason: 'This is not open to travellers.' })
    assert.ok(refunds.includes(`pi_${sessionId}`))
    const [payment] = await paymentsOf(id)
    assert.equal(payment.status, 'refunded')
    assert.match(payment.refundReason, /Declined by a moderator/)
    const audit = await payload.find({ collection: 'moderation-actions', where: { and: [{ contribution: { equals: id } }, { action: { equals: 'refund_listing' } }] }, depth: 0 })
    assert.equal(audit.totalDocs, 1)
  })

  it('a paid listing deleted before publication is refunded, and the payment record is kept', async () => {
    const member = await newMember('Changed Mind')
    const { id, sessionId } = await paidListing(member)
    await C.withdrawSubmission(member, id)
    await C.deleteDraft(member, id)
    assert.ok(refunds.includes(`pi_${sessionId}`))
    const kept = await payload.find({ collection: 'listing-payments', where: { stripeSessionId: { equals: sessionId } }, depth: 0 })
    assert.equal(kept.docs[0].status, 'refunded')
    assert.equal(kept.docs[0].contribution, null, 'the record outlives the deleted listing')
  })
})

describe('invoices', () => {
  it('only the payer and moderators can see an invoice', async () => {
    const member = await newMember('Payer')
    const { id } = await paidListing(member)
    const [payment] = await paymentsOf(id)
    const own = await L.getInvoice({ member, staff: null }, payment.id)
    assert.equal(own.amountMinor, 500)
    assert.equal(own.gstMinor, 45)
    const stranger = await newMember('Stranger')
    await rejects(L.getInvoice({ member: stranger, staff: null }, payment.id), 'not_found')
    const staffView = await L.getInvoice({ member: null, staff: moderator() }, payment.id)
    assert.equal(staffView.invoiceNumber, payment.invoiceNumber)
  })
})

describe('search engines', () => {
  it('a published activity is indexable until 30 days after it ends', async () => {
    const settings = await S.getSettings()
    const now = new Date('2026-10-12T00:00:00Z')
    const post = (end: string) => ({ type: 'activity', indexing: 'policy', replyCount: 0, activity: { startsAt: end, endsAt: end } })
    assert.equal(SEO.contributionIndexing(post('2026-11-01T00:00:00Z'), settings, now).index, true)
    assert.equal(SEO.contributionIndexing(post('2026-09-20T00:00:00Z'), settings, now).index, true)
    assert.equal(SEO.contributionIndexing(post('2026-08-20T00:00:00Z'), settings, now).index, false)
    assert.equal(SEO.contributionIndexing({ ...post('2026-11-01T00:00:00Z'), indexing: 'block' }, settings, now).index, false)
  })
})
