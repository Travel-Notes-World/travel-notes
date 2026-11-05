import { randomBytes } from 'node:crypto'

import { cms } from '../../community/db'
import { fail } from '../../community/errors'
import { requireActive } from '../../community/members'
import { gateway } from '../../community/payments/stripe'
import { getSettings } from '../../community/settings'
import type { MemberActor } from '../../community/types'
import { aiPlanPrice } from '../payments'
import { claimTrip, previewHash } from './store'

/**
 * Paying the planner fee for one trip: unlocks the remaining days, their map stops, the PDF and
 * the included changes. The fee is the same configured price as the AI trip plan (Community
 * settings → Trip Planner → price), so the button and the Stripe page always show the same amount.
 *
 * Safety:
 * - The trip is linked to the member's account before checkout, so access is restored when they
 *   sign in again on any device.
 * - An open checkout for the same trip is reused instead of starting a second one, and a paid trip
 *   never starts a new checkout, so a traveller cannot be charged twice by pressing the button again.
 * - Nothing is unlocked by the browser's return alone: the server asks Stripe whether the session
 *   was paid (confirmListingPayment), and Stripe's webhook does the same.
 */

const invoiceNumber = (): string => `TN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`

export async function startTripCheckout(actor: MemberActor, token: string, urls: { base: string }): Promise<{ url: string }> {
  const member = await requireActive(actor)
  const settings = await getSettings()
  const price = aiPlanPrice(settings)
  if (!price.charge) fail('closed', 'Payments are not available at the moment. Please try again later.')
  const trip = await claimTrip(token, member.id)
  if (!trip || trip.status !== 'ready' || !trip.plan) return fail('not_found', 'This trip could not be found.')
  const back = `${urls.base}/trip-planner/t/${trip.token}`
  if (trip.unlocked) return { url: back }

  const payload = await cms()
  // Reuse an open checkout started in the last hour.
  const open = await payload.find({ collection: 'listing-payments', where: { and: [{ trip: { equals: trip.id } }, { status: { in: ['created', 'paid'] } }, { createdAt: { greater_than: new Date(Date.now() - 55 * 60_000).toISOString() } }] }, sort: '-createdAt', limit: 1, depth: 0 })
  const existing = open.docs[0]
  if (existing?.status === 'paid') return { url: `${back}?paid=1` }
  if (existing?.stripeSessionId) {
    try {
      const session = await gateway().getCheckout(existing.stripeSessionId)
      if (session.paymentStatus === 'paid') return { url: `${back}?paid=1&session_id=${session.id}` }
      if (session.url) return { url: session.url }
    } catch (error) {
      console.error('[trip planner] could not reopen checkout', error instanceof Error ? error.message : error)
    }
  }

  const memberDoc = await payload.findByID({ collection: 'members', id: member.id, depth: 0 })
  const description = `Trip Planner fee: ${trip.title}`.slice(0, 200)
  const payment = await payload.create({
    collection: 'listing-payments',
    data: {
      invoiceNumber: invoiceNumber(),
      purpose: 'ai_plan',
      trip: trip.id,
      member: member.id,
      status: 'created',
      description,
      amountMinor: price.amountMinor,
      currency: 'AUD',
      gstMinor: price.gstMinor,
      sellerName: settings.listings.sellerName,
      sellerAbn: settings.listings.sellerAbn,
      buyerEmail: memberDoc.email,
    },
  })
  await payload.update({ collection: 'trips', id: trip.id, overrideAccess: true, data: { previewHash: previewHash(trip) } })
  let session
  try {
    session = await gateway().createCheckout({
      amountMinor: price.amountMinor,
      currency: 'AUD',
      productName: description,
      customerEmail: memberDoc.email ?? null,
      successUrl: `${back}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${back}?cancelled=1`,
      metadata: { paymentId: payment.id, tripId: trip.id, memberId: member.id },
      idempotencyKey: `checkout-${payment.id}`,
    })
  } catch (error) {
    console.error('[trip planner] Stripe checkout could not be created', error instanceof Error ? error.message : error)
    await payload.update({ collection: 'listing-payments', id: payment.id, data: { status: 'expired' } })
    return fail('closed', 'The payment page could not be opened. No money was taken. Please try again in a few minutes.')
  }
  await payload.update({ collection: 'listing-payments', id: payment.id, data: { stripeSessionId: session.id } })
  if (!session.url) fail('closed', 'The payment page could not be opened. Please try again.')
  return { url: session.url! }
}

/** Unlock a trip after the server has confirmed its payment with Stripe. Safe to call more than once. */
export async function unlockTripForPayment(tripId: string, paymentId: string): Promise<void> {
  const payload = await cms()
  const trip = await payload.findByID({ collection: 'trips', id: tripId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!trip || trip.unlocked) return
  await payload.update({ collection: 'trips', id: tripId, overrideAccess: true, data: { unlocked: true, unlockedAt: new Date().toISOString(), payment: paymentId, attempts: 0 } })
}
