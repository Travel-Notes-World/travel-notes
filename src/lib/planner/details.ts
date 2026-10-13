import { cms } from '../community/db'
import { invalid, type FieldErrors } from '../community/errors'
import { requireActive } from '../community/members'
import { ownPlanDoc, toPurpose } from '../community/plans'
import { limit } from '../community/ratelimit'
import { cleanLine, cleanText } from '../community/text'
import { isLocalDate } from '../community/time'
import type { MemberActor } from '../community/types'

/**
 * The trip details a member gives before the AI writes their plan. All of it is optional except
 * what a visa-purpose itinerary needs (arrival and departure dates). Nothing sensitive is asked for:
 * no passport, booking or payment numbers. Everything here can be removed with
 * {@link removePersonalDetails}, and it goes when the plan or the account is deleted.
 */

export const INTERESTS = [
  { value: 'culture', label: 'Culture and history' },
  { value: 'food', label: 'Food' },
  { value: 'nature', label: 'Nature and walks' },
  { value: 'beaches', label: 'Beaches' },
  { value: 'shopping', label: 'Shopping and markets' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'art', label: 'Art and museums' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'kids', label: 'Things for children' },
  { value: 'photography', label: 'Photography' },
] as const

export const FUNDING = [
  { value: 'self', label: 'The traveller' },
  { value: 'family', label: 'Family' },
  { value: 'employer', label: 'Employer' },
  { value: 'host', label: 'The person being visited' },
  { value: 'other', label: 'Other' },
] as const

/** Currencies offered for the budget. The amount is only divided, never converted. */
export const CURRENCIES = ['AUD', 'NZD', 'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'SGD', 'IDR', 'THB', 'VND', 'MYR', 'PHP', 'KRW', 'CNY', 'HKD', 'INR', 'LKR', 'AED', 'FJD'] as const

type Raw = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export async function updateTripDetails(actor: MemberActor, planId: unknown, input: Raw): Promise<{ id: string }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  await limit('engagement', member.id)
  const errors: FieldErrors = {}
  const purpose = toPurpose(input.purpose ?? plan.purpose)

  const travellersRaw = str(input.travellers).trim()
  const travellers = travellersRaw ? Number(travellersRaw) : null
  if (travellers !== null && !(Number.isInteger(travellers) && travellers >= 1 && travellers <= 20)) errors.travellers = 'Enter a number of travellers from 1 to 20.'
  const budgetRaw = str(input.budgetAmount).replace(/[,\s]/g, '').replace(/^[^\d.]+/, '')
  const budgetAmount = budgetRaw ? Number(budgetRaw) : null
  if (budgetAmount !== null && !(Number.isFinite(budgetAmount) && budgetAmount >= 0 && budgetAmount <= 10_000_000)) errors.budgetAmount = 'Enter the budget as a number, for example 3000.'
  const budgetCurrency = str(input.budgetCurrency).trim().toUpperCase()
  if (budgetAmount !== null && !/^[A-Z]{3}$/.test(budgetCurrency)) errors.budgetCurrency = 'Choose the currency of your budget.'
  const interests = strings(input.interests).filter((i) => INTERESTS.some((x) => x.value === i)).slice(0, 10)

  const date = (field: string): string | null => {
    const v = str(input[field]).trim()
    if (!v) return null
    if (!isLocalDate(v)) { errors[field] = 'Enter a valid date.'; return null }
    return v
  }
  const arrivalDate = purpose === 'visa' ? date('arrivalDate') : null
  const departureDate = purpose === 'visa' ? date('departureDate') : null
  if (purpose === 'visa') {
    if (!arrivalDate && !errors.arrivalDate) errors.arrivalDate = 'Enter the planned arrival date.'
    if (!departureDate && !errors.departureDate) errors.departureDate = 'Enter the planned departure date.'
    if (arrivalDate && departureDate && departureDate < arrivalDate) errors.departureDate = 'The departure date is before the arrival date.'
  }
  const funding = FUNDING.some((f) => f.value === input.funding) ? (input.funding as (typeof FUNDING)[number]['value']) : null
  if (Object.keys(errors).length) invalid(errors)

  const payload = await cms()
  await payload.update({
    collection: 'plans',
    id: plan.id,
    data: {
      purpose,
      details: {
        departFrom: cleanLine(input.departFrom, 120),
        travellers,
        budgetAmount,
        budgetCurrency: budgetAmount !== null ? budgetCurrency : '',
        interests,
        accessibility: cleanText(input.accessibility, 600),
      },
      visa: purpose === 'visa'
        ? {
            travellerName: cleanLine(input.travellerName, 120),
            visitPurpose: cleanLine(input.visitPurpose, 120),
            arrivalDate,
            departureDate,
            cities: cleanLine(input.cities, 300),
            accommodation: cleanText(input.accommodation, 1500),
            transport: cleanText(input.transport, 1500),
            funding,
            fundingNote: cleanLine(input.fundingNote, 200),
          }
        : { travellerName: '', visitPurpose: '', arrivalDate: null, departureDate: null, cities: '', accommodation: '', transport: '', funding: null, fundingNote: '' },
    },
  })
  return { id: plan.id }
}

/** Remove the personal details of a plan: who, where from, accessibility, accommodation, transport and funding. */
export async function removePersonalDetails(actor: MemberActor, planId: unknown): Promise<{ id: string }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  const payload = await cms()
  await payload.update({
    collection: 'plans',
    id: plan.id,
    data: {
      details: { departFrom: '', travellers: null, budgetAmount: null, budgetCurrency: '', interests: plan.details?.interests ?? [], accessibility: '' },
      visa: { travellerName: '', visitPurpose: plan.visa?.visitPurpose ?? '', arrivalDate: plan.visa?.arrivalDate ?? null, departureDate: plan.visa?.departureDate ?? null, cities: plan.visa?.cities ?? '', accommodation: '', transport: '', funding: null, fundingNote: '' },
    },
  })
  return { id: plan.id }
}
