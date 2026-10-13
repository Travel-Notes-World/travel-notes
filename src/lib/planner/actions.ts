'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { createPlanFromPlanner } from '../community/plans'
import { str, toState, type ActionState } from '../community/next/forms'
import { clientIp, getViewer } from '../community/next/session'
import { isCommunityError } from '../community/errors'
import { MONTH_NAMES } from '../content/destinationFacts'
import { planDays, plannerHref, readPlannerInput, type PlannerInput } from './input'
import { attachPreview, writePreview, type Preview } from './preview'

/**
 * "Save to my trips": turn the planner's current draft into a private plan in the member's account.
 * Signed-out visitors are sent to sign in and brought back to the same plan.
 */
export async function savePlannerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const query = new URLSearchParams(str(form, 'query'))
  const params: Record<string, string[]> = {}
  for (const [k, v] of query) (params[k] ??= []).push(v)
  const { input } = readPlannerInput(params)
  const back = plannerHref(input)

  const { member } = await getViewer()
  if (!member) redirect(`/account/sign-in?next=${encodeURIComponent(`${back}${back.includes('?') ? '&' : '?'}signedin=1`)}`)

  let id: string
  try {
    const payload = await getPayload({ config })
    const found = input.placeIds.length
      ? await payload.find({ collection: 'destinations', where: { id: { in: input.placeIds } }, limit: input.placeIds.length, pagination: false, depth: 0, draft: false, overrideAccess: false, select: { name: true } })
      : { docs: [] }
    const names = new Map(found.docs.map((d) => [d.id, d.name]))
    const placeIds = input.placeIds.filter((pid) => names.has(pid))
    if (!placeIds.length) return { ok: false, message: 'Choose at least one destination first.' }
    const split = placeIds.length === input.placeIds.length ? input.split : input.split.filter((_, i) => names.has(input.placeIds[i]))
    const days = planDays({ start: input.start, split }).map((d) => ({ title: names.get(placeIds[d.placeIndex]) ?? '', date: d.date }))
    const placeNames = placeIds.map((pid) => names.get(pid)!)
    const when = input.start
      ? new Date(`${input.start}T00:00:00Z`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : input.month ? MONTH_NAMES[input.month] : ''
    const joined = placeNames.length > 1 ? `${placeNames.slice(0, -1).join(', ')} and ${placeNames.at(-1)}` : placeNames[0]
    const title = `${joined}${when ? `, ${when}` : ''}`.slice(0, 140)
    id = (await createPlanFromPlanner(member, { title, start: input.start, days, placeIds, party: input.party, pace: input.pace, purpose: input.purpose })).id
    // A visitor's instant itinerary comes with them into their account.
    await attachPreview(member, id, await clientIp(), input).catch((error) => console.error('[planner] could not attach the instant itinerary', error instanceof Error ? error.message : error))
  } catch (error) {
    return toState(error)
  }
  revalidatePath('/account/trips')
  redirect(`/account/trips/${id}?planned=1`)
}

const inputFrom = (query: string): PlannerInput => {
  const params: Record<string, string[]> = {}
  for (const [k, v] of new URLSearchParams(query)) (params[k] ??= []).push(v)
  return readPlannerInput(params).input
}

export type PreviewState = { status: 'ready'; preview: Preview } | { status: 'limited' } | { status: 'off' } | { status: 'error'; message: string }

/** Write the instant free itinerary for the planner page. No account needed; limited per visitor. */
export async function writePreviewAction(query: string): Promise<PreviewState> {
  try {
    return await writePreview(await clientIp(), inputFrom(query))
  } catch (error) {
    if (isCommunityError(error)) return { status: 'error', message: error.message }
    console.error('[planner] instant itinerary action failed', error)
    return { status: 'error', message: 'Something went wrong on our side. Please try again in a minute.' }
  }
}
