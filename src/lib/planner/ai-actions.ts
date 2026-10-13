'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getViewer } from '../community/next/session'
import { formValues, str, strings, toState, type ActionState } from '../community/next/forms'
import { siteUrl } from '../site'
import { generateAiPlan } from './ai'
import { removePersonalDetails, updateTripDetails } from './details'
import { startAiPlanCheckout } from './payments'
import { setSharing } from './share'

const MESSAGES = {
  brief: 'Your free plan is ready below. Stops marked “AI idea” are not checked by Travel Notes: check them before you go.',
  detailed: 'Your detailed plan is ready below. Stops marked “AI idea” are not checked by Travel Notes: check them before you go.',
  revision: 'Your plan is revised. Stops marked “AI idea” are not checked by Travel Notes.',
} as const

/** Have the AI write (or revise) the member's own plan. Takes up to about a minute. */
export async function generateAiPlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id')
  try {
    const { member } = await getViewer()
    const result = await generateAiPlan(member!, id, { instruction: str(form, 'instruction') })
    revalidatePath(`/account/trips/${id}`)
    return { ok: true, message: MESSAGES[result.kind] }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** Open Stripe's checkout page to upgrade one plan. */
export async function payForAiPlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id')
  let target: string
  try {
    const { member } = await getViewer()
    target = (await startAiPlanCheckout(member!, id, { base: siteUrl })).url
  } catch (error) {
    return toState(error)
  }
  redirect(target)
}

export async function saveTripDetailsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id')
  try {
    const { member } = await getViewer()
    await updateTripDetails(member!, id, {
      purpose: str(form, 'purpose'),
      departFrom: str(form, 'departFrom'),
      travellers: str(form, 'travellers'),
      budgetAmount: str(form, 'budgetAmount'),
      budgetCurrency: str(form, 'budgetCurrency'),
      interests: strings(form, 'interests'),
      accessibility: str(form, 'accessibility'),
      travellerName: str(form, 'travellerName'),
      visitPurpose: str(form, 'visitPurpose'),
      arrivalDate: str(form, 'arrivalDate'),
      departureDate: str(form, 'departureDate'),
      cities: str(form, 'cities'),
      accommodation: str(form, 'accommodation'),
      transport: str(form, 'transport'),
      funding: str(form, 'funding'),
      fundingNote: str(form, 'fundingNote'),
    })
    revalidatePath(`/account/trips/${id}`)
    return { ok: true, message: 'Trip details saved.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function removePersonalDetailsAction(form: FormData): Promise<void> {
  const id = str(form, 'id')
  const { member } = await getViewer()
  if (member) await removePersonalDetails(member, id).catch(() => undefined)
  revalidatePath(`/account/trips/${id}`)
  redirect(`/account/trips/${id}?removed=1`)
}

export async function setSharingAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id')
  try {
    const { member } = await getViewer()
    const on = str(form, 'enabled') === '1'
    await setSharing(member!, id, on)
    revalidatePath(`/account/trips/${id}`)
    return { ok: true, message: on ? 'Sharing is on. Anyone with the link can read this plan.' : 'Sharing is off. The old link no longer works.' }
  } catch (error) {
    return toState(error)
  }
}
