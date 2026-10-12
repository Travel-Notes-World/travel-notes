import { randomBytes } from 'node:crypto'

import type { ListingPayment } from '../../payload-types'
import { audit } from './audit'
import type { ContributionType } from './constants'
import type { Content } from './content'
import { cms, inTransaction, relId, type Tx } from './db'
import { isUuid } from './destinations'
import { fail } from './errors'
import { requireActive } from './members'
import { gateway, stripeConfigured } from './payments/stripe'
import { getSettings, type Settings } from './settings'
import type { MemberActor, StaffActor } from './types'

/**
 * Paid business listings.
 *
 * Only a commercial activity (a tour, class or paid experience run by a business) has a fee.
 * Member meet-ups and public events stay free. The fee is paid once per listing, on Stripe's own
 * checkout page, before the listing goes to review. If a moderator declines the listing, or the
 * member deletes it before it is published, the fee is refunded automatically.
 */

export const needsListingFee = (type: ContributionType | string, content: Pick<Content, 'activity'>): boolean =>
  type === 'activity' && content.activity?.category === 'commercial_activity'

export function validAbn(value: string): boolean {
  const digits = value.replace(/\s/g, '')
  if (!/^\d{11}$/.test(digits)) return false
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  return digits.split('').reduce((sum, d, i) => sum + (Number(d) - (i === 0 ? 1 : 0)) * weights[i], 0) % 89 === 0
}

/** GST included in a GST-inclusive price: one eleventh, rounded to the cent. */
export const gstIncluded = (amountMinor: number): number => Math.round(amountMinor / 11)

export type ListingFee = {
  /** True only when the fee is switched on AND everything needed to take payment is in place. */
  charge: boolean
  amountMinor: number
  gstMinor: number
  label: string
  gstRegistered: boolean
  sellerName: string
  sellerAbn: string
  /** Why payments are not being taken, for the settings page and logs. */
  notReady: string[]
}

export function listingFee(settings: Settings): ListingFee {
  const l = settings.listings
  const notReady: string[] = []
  if (!l.enabled) notReady.push('switched off')
  if (l.feeMinor <= 0) notReady.push('price is 0')
  if (!stripeConfigured()) notReady.push('Stripe keys are not set')
  if (!l.sellerName) notReady.push('seller name is empty')
  if (!validAbn(l.sellerAbn)) notReady.push('seller ABN is missing or invalid')
  return {
    charge: notReady.length === 0,
    amountMinor: l.feeMinor,
    gstMinor: l.gstRegistered ? gstIncluded(l.feeMinor) : 0,
    label: l.priceLabel,
    gstRegistered: l.gstRegistered,
    sellerName: l.sellerName,
    sellerAbn: l.sellerAbn,
    notReady,
  }
}

export async function currentListingFee(): Promise<ListingFee> {
  return listingFee(await getSettings())
}

export const formatAud = (minor: number): string => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(minor / 100)

export async function hasPaidListing(tx: Tx, contributionId: string): Promise<boolean> {
  const found = await tx.payload.count({ collection: 'listing-payments', where: { and: [{ contribution: { equals: contributionId } }, { status: { equals: 'paid' } }] }, req: tx.req })
  return found.totalDocs > 0
}

const invoiceNumber = (): string => `TN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`

/**
 * Start paying for a member's own business listing. Returns the Stripe checkout address.
 * The listing must be a saved draft (or one sent back for changes) that is not already paid.
 */
export async function startListingCheckout(actor: MemberActor, contributionId: unknown, urls: { base: string }): Promise<{ url: string } | { alreadyPaid: true }> {
  const member = await requireActive(actor)
  if (!isUuid(contributionId)) fail('not_found', 'That listing could not be found.')
  const payload = await cms()
  const doc = await payload.findByID({ collection: 'contributions', id: contributionId as string, depth: 0, disableErrors: true })
  if (!doc || relId(doc.author) !== member.id) return fail('not_found', 'That listing could not be found.')
  if (!['draft', 'changes_requested'].includes(doc.state)) fail('conflict', 'This listing has already been sent.')
  if (doc.type !== 'activity' || doc.activity?.category !== 'commercial_activity') fail('validation', 'Only business listings have a fee.')
  const fee = await currentListingFee()
  if (!fee.charge) fail('closed', 'Paid listings are not available at the moment. Please try again later.')

  const paid = await payload.count({ collection: 'listing-payments', where: { and: [{ contribution: { equals: doc.id } }, { status: { equals: 'paid' } }] } })
  if (paid.totalDocs) return { alreadyPaid: true }

  const memberDoc = await payload.findByID({ collection: 'members', id: member.id, depth: 0 })
  const description = `Business activity listing: ${doc.title}`.slice(0, 200)
  const payment = await payload.create({
    collection: 'listing-payments',
    data: {
      invoiceNumber: invoiceNumber(),
      contribution: doc.id,
      member: member.id,
      status: 'created',
      description,
      amountMinor: fee.amountMinor,
      currency: 'AUD',
      gstMinor: fee.gstMinor,
      sellerName: fee.sellerName,
      sellerAbn: fee.sellerAbn,
      buyerEmail: memberDoc.email,
    },
  })
  const back = `${urls.base}/account/posts/${doc.id}/pay`
  let session
  try {
    session = await gateway().createCheckout({
      amountMinor: fee.amountMinor,
      currency: 'AUD',
      productName: description,
      customerEmail: memberDoc.email ?? null,
      successUrl: `${back}/done?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${back}?cancelled=1`,
      metadata: { paymentId: payment.id, contributionId: doc.id, memberId: member.id },
      idempotencyKey: `checkout-${payment.id}`,
    })
  } catch (error) {
    console.error('[listings] Stripe checkout could not be created', error instanceof Error ? error.message : error)
    await payload.update({ collection: 'listing-payments', id: payment.id, data: { status: 'expired' } })
    return fail('closed', 'The payment page could not be opened. No money was taken. Please try again in a few minutes.')
  }
  await payload.update({ collection: 'listing-payments', id: payment.id, data: { stripeSessionId: session.id } })
  if (!session.url) fail('closed', 'The payment page could not be opened. Please try again.')
  return { url: session.url! }
}

/**
 * Record a finished checkout and send the listing for review. Safe to call more than once for
 * the same checkout: the browser's return and Stripe's webhook both call it.
 */
export async function confirmListingPayment(sessionId: string): Promise<{ status: 'paid' | 'unpaid' | 'unknown'; contributionId?: string }> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { status: 'unknown' }
  const session = await gateway().getCheckout(sessionId)
  const payload = await cms()
  const found = await payload.find({ collection: 'listing-payments', where: { stripeSessionId: { equals: session.id } }, limit: 1, depth: 0 })
  const payment = found.docs[0]
  if (!payment || session.metadata.paymentId !== payment.id) return { status: 'unknown' }
  const contributionId = relId(payment.contribution)
  if (!contributionId) return { status: 'unknown' }
  if (session.paymentStatus !== 'paid') return { status: 'unpaid', contributionId }

  if (payment.status === 'created' || payment.status === 'expired') {
    await inTransaction(async (tx) => {
      await tx.payload.update({
        collection: 'listing-payments',
        id: payment.id,
        req: tx.req,
        data: { status: 'paid', paidAt: new Date().toISOString(), stripePaymentIntentId: session.paymentIntentId ?? undefined, buyerEmail: session.customerEmail ?? payment.buyerEmail },
      })
      await audit(tx, { action: 'listing_paid', actor: { kind: 'system' }, targetType: 'contribution', targetId: contributionId, contribution: contributionId, reason: `Listing fee of ${formatAud(payment.amountMinor)} paid (invoice ${payment.invoiceNumber}).` })
    })
  }
  const memberId = relId(payment.member)
  if (memberId && payment.status !== 'refunded') {
    const { submitPaidDraft } = await import('./contributions')
    await submitPaidDraft(memberId, contributionId)
  }
  return { status: 'paid', contributionId }
}

/** Mark a checkout that Stripe says has expired, so it is not mistaken for a pending payment. */
export async function expireListingCheckout(sessionId: string): Promise<void> {
  const payload = await cms()
  const found = await payload.find({ collection: 'listing-payments', where: { and: [{ stripeSessionId: { equals: sessionId } }, { status: { equals: 'created' } }] }, limit: 1, depth: 0 })
  if (found.docs[0]) await payload.update({ collection: 'listing-payments', id: found.docs[0].id, data: { status: 'expired' } })
}

/**
 * Refund the listing fee of a contribution, if one was paid and not already refunded. Used when a
 * moderator declines a business listing or the member deletes it before it was published.
 * A failed refund is logged in the audit history and left for a person to finish in Stripe.
 */
export async function refundListingIfPaid(contributionId: string, reason: string): Promise<{ refunded: boolean }> {
  const payload = await cms()
  const found = await payload.find({ collection: 'listing-payments', where: { and: [{ contribution: { equals: contributionId } }, { status: { equals: 'paid' } }] }, limit: 5, depth: 0 })
  let refunded = false
  for (const payment of found.docs) {
    let error: string | null = null
    try {
      if (!payment.stripePaymentIntentId) throw new Error('no payment reference was recorded')
      await gateway().refund(payment.stripePaymentIntentId, `refund-${payment.id}`)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    await inTransaction(async (tx) => {
      if (!error) await tx.payload.update({ collection: 'listing-payments', id: payment.id, req: tx.req, data: { status: 'refunded', refundedAt: new Date().toISOString(), refundReason: reason } })
      await audit(tx, {
        action: 'refund_listing',
        actor: { kind: 'system' },
        targetType: 'contribution',
        targetId: contributionId,
        contribution: contributionId,
        reason: error ? `Listing fee refund FAILED (${error}). Refund ${formatAud(payment.amountMinor)} for invoice ${payment.invoiceNumber} in Stripe.` : `Listing fee of ${formatAud(payment.amountMinor)} refunded (invoice ${payment.invoiceNumber}): ${reason}`,
      })
    })
    if (!error) refunded = true
  }
  return { refunded }
}

export type InvoiceView = Pick<ListingPayment, 'id' | 'invoiceNumber' | 'status' | 'description' | 'amountMinor' | 'gstMinor' | 'currency' | 'sellerName' | 'sellerAbn' | 'buyerEmail' | 'paidAt' | 'refundedAt'> & { contributionId: string | null }

/** A paid listing's invoice, for the member who paid or a moderator. */
export async function getInvoice(viewer: { member: MemberActor | null; staff: StaffActor | null }, paymentId: unknown): Promise<InvoiceView> {
  if (!isUuid(paymentId)) fail('not_found', 'That invoice could not be found.')
  const payload = await cms()
  const p = await payload.findByID({ collection: 'listing-payments', id: paymentId as string, depth: 0, disableErrors: true })
  const mine = p && viewer.member && relId(p.member) === viewer.member.id
  if (!p || (!mine && !viewer.staff?.canModerate) || !['paid', 'refunded'].includes(p.status)) return fail('not_found', 'That invoice could not be found.')
  return {
    id: p.id, invoiceNumber: p.invoiceNumber, status: p.status, description: p.description, amountMinor: p.amountMinor, gstMinor: p.gstMinor ?? 0, currency: p.currency,
    sellerName: p.sellerName, sellerAbn: p.sellerAbn, buyerEmail: p.buyerEmail, paidAt: p.paidAt, refundedAt: p.refundedAt, contributionId: relId(p.contribution) ?? null,
  }
}

/** The paid or refunded payments for one listing, newest first. */
export async function listingPaymentsFor(contributionId: string): Promise<{ id: string; invoiceNumber: string; status: string; amountMinor: number; paidAt: string | null }[]> {
  const payload = await cms()
  const found = await payload.find({ collection: 'listing-payments', where: { and: [{ contribution: { equals: contributionId } }, { status: { in: ['paid', 'refunded'] } }] }, sort: '-createdAt', limit: 10, depth: 0 })
  return found.docs.map((p) => ({ id: p.id, invoiceNumber: p.invoiceNumber, status: p.status, amountMinor: p.amountMinor, paidAt: p.paidAt ?? null }))
}

/** What the activity form shows about the fee, or null when no fee is charged. */
export function feeInfoFor(fee: ListingFee): { amount: string; label: string; gstNote: string } | null {
  if (!fee.charge) return null
  return { amount: formatAud(fee.amountMinor), label: fee.label, gstNote: fee.gstRegistered ? `AUD, including ${formatAud(fee.gstMinor)} GST` : 'AUD' }
}
