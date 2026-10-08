'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createPlan, deletePlan, getPlanForEdit, updatePlan } from '../plans'
import { formValues, json, str, toState, type ActionState } from '../next/forms'
import { getViewer } from '../next/session'

/**
 * Private trip plans. Every action works on the signed-in member's own plans only: the service
 * looks each plan up by id AND owner, so another member's plan id behaves as if it did not exist.
 */

export async function createPlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  let id: string
  try {
    const { member } = await getViewer()
    id = (await createPlan(member!, { title: str(form, 'title'), startDate: str(form, 'startDate'), endDate: str(form, 'endDate'), days: [] })).id
  } catch (error) {
    return toState(error, formValues(form))
  }
  revalidatePath('/account/trips')
  redirect(`/account/trips/${id}?created=1`)
}

/** Change only the name of a plan. The stored days, dates and notes are kept as they are. */
export async function renamePlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const id = str(form, 'id')
    const { view, days } = await getPlanForEdit(member!, id)
    await updatePlan(member!, id, { title: str(form, 'title'), startDate: view.startDate, endDate: view.endDate, notes: view.notes, days })
    revalidatePath('/account/trips')
    revalidatePath(`/account/trips/${id}`)
    return { ok: true, message: 'The plan is renamed.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** Save the whole plan from the editor. Days and stops arrive as JSON written by the editor. */
export async function savePlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const id = str(form, 'id')
    await updatePlan(member!, id, { title: str(form, 'title'), startDate: str(form, 'startDate'), endDate: str(form, 'endDate'), notes: str(form, 'notes'), days: json(form, 'daysJson') ?? [] })
    revalidatePath(`/account/trips/${id}`)
    revalidatePath('/account/trips')
    return { ok: true, message: `Plan saved at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC.` }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function deletePlanAction(form: FormData): Promise<void> {
  const { member } = await getViewer()
  if (member) await deletePlan(member, str(form, 'id')).catch(() => undefined)
  revalidatePath('/account/trips')
  redirect('/account/trips?deleted=1')
}
