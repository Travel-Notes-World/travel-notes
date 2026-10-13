'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getViewer } from '../community/next/session'
import { str, toState, type ActionState } from '../community/next/forms'
import { siteUrl } from '../site'
import { generateAiPlan } from './ai'
import { startAiPlanCheckout } from './payments'

/** Fill in the days of the member's own plan with AI. Takes up to about a minute. */
export async function generateAiPlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id')
  try {
    const { member } = await getViewer()
    const result = await generateAiPlan(member!, id)
    revalidatePath(`/account/trips/${id}`)
    return { ok: true, message: `Your days are filled in with ${result.stops} suggestions. Stops marked “AI idea” are not checked by Travel Notes: check them before you go.` }
  } catch (error) {
    return toState(error)
  }
}

/** Open Stripe's checkout page to pay for one AI plan (AI days and printing). */
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
