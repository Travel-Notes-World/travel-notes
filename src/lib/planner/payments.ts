import { randomBytes } from 'node:crypto'

import { cms, relIds } from '../community/db'
import { fail } from '../community/errors'
import { formatAud, gstIncluded, validAbn } from '../community/listings'
import { requireActive } from '../community/members'
import { ownPlanDoc } from '../community/plans'
import { gateway, stripeConfigured } from '../community/payments/stripe'
import { getSettings, type Settings } from '../community/settings'
import type { MemberActor } from '../community/types'
import { DO_NOT_TRAVEL_MESSAGE, highestLevel, tripAdvice } from './advice'

/**
 * Paying for one AI trip plan. One payment covers one plan: the AI days for that plan and printing
 * it. The payment is recorded in the same payments table as business listings, so the same tax
 * invoice page, Stripe webhook and records apply.
 */

export type AiPlanPrice = { charge: boolean; amountMinor: number; gstMinor: number; text: string; notReady: string[] }

export function aiPlanPrice(settings: Settings): AiPlanPrice {
  const l = settings.listings
  const amountMinor = settings.planner.priceMinor
  const notReady: string[] = []
  if (amountMinor <= 0) notReady.push('price is 0')
  if (!stripeConfigured()) notReady.push('Stripe keys are not set')
  if (!l.sellerName) notReady.push('seller name is empty')
  if (!validAbn(l.sellerAbn)) notReady.push('seller ABN is missing or invalid')
  return { charge: notReady.length === 0, amountMinor, gstMinor: l.gstRegistered ? gstIncluded(amountMinor) : 0, text: `A${formatAud(amountMinor)}`, notReady }
}

const invoiceNumber = (): string => `TN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`

/** Start paying for one of the member's own plans. Returns the Stripe checkout address. */
export async function startAiPlanCheckout(actor: MemberActor, planId: unknown, urls: { base: string }): Promise<{ url: string }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  const settings = await getSettings()
  const price = aiPlanPrice(settings)
  if (!price.charge) fail('closed', 'Payments are not available at the moment. Please try again later.')
  const payload = await cms()
  // No paid planning for a trip to a country the Australian Government says not to travel to.
  if (highestLevel(await tripAdvice(payload, relIds(plan.destinations))) >= 4) fail('closed', DO_NOT_TRAVEL_MESSAGE)
  const memberDoc = await payload.findByID({ collection: 'members', id: member.id, depth: 0 })
  const description = `AI trip plan: ${plan.title}`.slice(0, 200)
  const payment = await payload.create({
    collection: 'listing-payments',
    data: {
      invoiceNumber: invoiceNumber(),
      purpose: 'ai_plan',
      plan: plan.id,
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
  const back = `${urls.base}/account/trips/${plan.id}`
  let session
  try {
    session = await gateway().createCheckout({
      amountMinor: price.amountMinor,
      currency: 'AUD',
      productName: description,
      customerEmail: memberDoc.email ?? null,
      successUrl: `${back}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${back}?cancelled=1`,
      metadata: { paymentId: payment.id, planId: plan.id, memberId: member.id },
      idempotencyKey: `checkout-${payment.id}`,
    })
  } catch (error) {
    console.error('[planner] Stripe checkout could not be created', error instanceof Error ? error.message : error)
    await payload.update({ collection: 'listing-payments', id: payment.id, data: { status: 'expired' } })
    return fail('closed', 'The payment page could not be opened. No money was taken. Please try again in a few minutes.')
  }
  await payload.update({ collection: 'listing-payments', id: payment.id, data: { stripeSessionId: session.id } })
  if (!session.url) fail('closed', 'The payment page could not be opened. Please try again.')
  return { url: session.url! }
}

/** Paid AI plan payments for a plan, newest first, for the invoice links. */
export async function aiPlanPaymentsFor(planId: string): Promise<{ id: string; invoiceNumber: string; paidAt: string | null }[]> {
  const payload = await cms()
  const found = await payload.find({ collection: 'listing-payments', where: { and: [{ purpose: { equals: 'ai_plan' } }, { plan: { equals: planId } }, { status: { equals: 'paid' } }] }, sort: '-createdAt', limit: 10, depth: 0 })
  return found.docs.map((p) => ({ id: p.id, invoiceNumber: p.invoiceNumber, paidAt: p.paidAt ?? null }))
}
