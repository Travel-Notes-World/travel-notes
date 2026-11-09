'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

import { str, toState, type ActionState } from '../../community/next/forms'
import { clientIp, getViewer } from '../../community/next/session'
import { siteUrl } from '../../site'
import { startTripCheckout } from './checkout'
import { readTripForm } from './form'
import type { Change } from './gate'
import { changeTrip, createTrip, findTrip, generateTrip, hasFullAccess, isToken, STALE_MS } from './store'

/**
 * Server actions for the single-form Trip Planner. Every input is read again on the server; the
 * browser only ever sends the trip's token and the traveller's own form fields.
 */

const today = () => new Date().toISOString().slice(0, 10)
const formValues = (form: FormData): Record<string, unknown> => {
  const values: Record<string, unknown> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue
    if (k === 'interests' || k === 'childAge') values[k] = [...((values[k] as string[]) ?? []), v]
    else values[k] = v
  }
  return values
}

/** "Generate my trip": check the form, save the trip, start writing it, and open its page. */
export async function generateTripAction(_: ActionState, form: FormData): Promise<ActionState> {
  const values = formValues(form)
  const { form: trip, errors, ok } = readTripForm(form, today())
  if (!ok) return { ok: false, code: 'validation', message: 'Please check the highlighted fields.', fields: errors as Record<string, string>, values }
  let token: string
  try {
    const { member } = await getViewer()
    const reviseToken = str(form, 'trip')
    const created = await createTrip({ form: trip, ip: await clientIp(), memberId: member?.id ?? null, reviseToken: isToken(reviseToken) ? reviseToken : null })
    token = created.token
    after(async () => { await generateTrip(created.id).catch((e) => console.error('[trip planner] generation crashed', e)) })
  } catch (error) {
    return toState(error, values)
  }
  redirect(`/trip-planner/t/${token}`)
}

/** "Try again" after a failed or stalled generation. Uses the same trip, so no free trip is used. */
export async function retryTripAction(form: FormData): Promise<void> {
  const trip = await findTrip(str(form, 'token'))
  if (!trip) redirect('/trip-planner')
  const stalled = trip.status === 'generating' && Date.now() - new Date(trip.startedAt ?? trip.createdAt).getTime() > STALE_MS
  if (trip.status === 'failed' || stalled) {
    after(async () => { await generateTrip(trip.id).catch((e) => console.error('[trip planner] retry crashed', e)) })
    const { cms } = await import('../../community/db')
    await (await cms()).update({ collection: 'trips', id: trip.id, overrideAccess: true, data: { status: 'generating', error: null, startedAt: new Date().toISOString() } })
  }
  redirect(`/trip-planner/t/${trip.token}`)
}

const CHANGE_OPS = new Set(['remove', 'replace', 'add', 'undo', 'unadd', 'contingency', 'allowance'])

/** Add, replace or remove an activity, or change the contingency. The budget is worked out again on the page. */
export async function changeTripAction(form: FormData): Promise<void> {
  const token = str(form, 'token')
  const op = str(form, 'op')
  if (!isToken(token) || !CHANGE_OPS.has(op)) redirect('/trip-planner')
  const change = (op === 'replace' ? { op, item: str(form, 'item'), with: str(form, 'with') }
    : op === 'add' || op === 'unadd' ? { op, alt: str(form, 'alt') }
    : op === 'contingency' ? { op, pct: Number(str(form, 'pct')) || 0 }
    : op === 'allowance' ? { op, key: str(form, 'key'), amount: str(form, 'amount').trim() === '' ? null : Number(str(form, 'amount').replace(/[$,\s]/g, '')) }
    : { op, item: str(form, 'item') }) as Change
  const { member } = await getViewer()
  let problem = ''
  try {
    await changeTrip(token, member?.id ?? null, change)
  } catch (error) {
    problem = error instanceof Error ? error.message : 'That change could not be saved.'
  }
  revalidatePath(`/trip-planner/t/${token}`)
  const tab = str(form, 'tab') || 'daily'
  redirect(`/trip-planner/t/${token}?tab=${tab}${problem ? `&problem=${encodeURIComponent(problem.slice(0, 160))}` : ''}#${str(form, 'anchor') || 'plan'}`)
}

/** "Unlock my full trip + PDF": sign in if needed, then go to Stripe's payment page. */
export async function unlockTripAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = str(form, 'token')
  if (!isToken(token)) return { ok: false, message: 'This trip could not be found.' }
  const { member } = await getViewer()
  if (!member) redirect(`/account/sign-in?next=${encodeURIComponent(`/trip-planner/t/${token}?unlock=1`)}`)
  const trip = await findTrip(token)
  if (trip && hasFullAccess(trip, member!.id)) redirect(`/trip-planner/t/${token}`)
  let url: string
  try {
    url = (await startTripCheckout(member!, token, { base: siteUrl })).url
  } catch (error) {
    return toState(error)
  }
  redirect(url)
}
