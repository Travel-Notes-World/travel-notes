import { cms, relIds } from '../community/db'
import { fail } from '../community/errors'
import { requireActive } from '../community/members'
import { ownPlanDoc, storedDays } from '../community/plans'
import { limit } from '../community/ratelimit'
import type { MemberActor } from '../community/types'
import { choicesJson, mirrorStops, readChoices, SLOTS, type SlotTime } from './choices'
import { nearbyPlaces } from './extras'

export type ChoiceAction = 'choose' | 'remove' | 'lock' | 'unlock'

async function save(planId: string, plan: Awaited<ReturnType<typeof ownPlanDoc>>, choices: ReturnType<typeof readChoices>) {
  const days = mirrorStops(storedDays(plan), choices)
  const payload = await cms()
  await payload.update({
    collection: 'plans',
    id: planId,
    data: {
      choices: choicesJson(choices),
      days: days.map((d) => ({ title: d.title, date: d.date, overnight: d.overnight, overnightConfirmed: d.overnightConfirmed, transport: d.transport, stops: d.stops.map((s) => ({ title: s.title, place: s.place, notes: s.notes, savedContribution: s.savedContribution, origin: s.origin, sourcePath: s.sourcePath, timeOfDay: s.timeOfDay })) })),
    },
  })
}

/**
 * Choose, remove or lock the activity for one part of one day. Choosing another option replaces
 * the current one. A locked slot cannot be changed until it is unlocked, and a revision keeps it.
 */
export async function updateChoice(actor: MemberActor, planId: unknown, input: { day: unknown; time: unknown; action: unknown; option?: unknown }): Promise<{ id: string }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  await limit('engagement', member.id)
  const days = plan.days?.length ?? 0
  const day = Number(input.day)
  if (!Number.isInteger(day) || day < 0 || day >= days) fail('validation', 'That day is not in this plan.')
  const time = SLOTS.find((t) => t === input.time) as SlotTime | undefined
  const choices = readChoices(plan.choices, days)
  const slot = choices.days[day].slots.find((s) => s.time === time)
  if (!slot) fail('not_found', 'That part of the day has no suggestions.')
  const action = input.action as ChoiceAction
  if ((action === 'choose' || action === 'remove') && slot!.locked) fail('validation', 'This choice is locked. Unlock it first to change it.')
  if (action === 'choose') {
    const option = slot!.options.find((o) => o.id === input.option)
    if (!option) fail('not_found', 'That suggestion could not be found.')
    slot!.selected = option!.id
  } else if (action === 'remove') {
    slot!.selected = null
  } else if (action === 'lock') {
    if (!slot!.selected) fail('validation', 'Choose an activity before locking it.')
    slot!.locked = true
  } else if (action === 'unlock') {
    slot!.locked = false
  } else {
    fail('validation', 'Unknown change.')
  }
  await save(plan.id, plan, choices)
  return { id: plan.id }
}

/** Use one day of the trip for a day trip to a nearby place (or stop doing so). */
export async function setDayTrip(actor: MemberActor, planId: unknown, input: { day: unknown; place: unknown }): Promise<{ id: string }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  await limit('engagement', member.id)
  const days = plan.days?.length ?? 0
  const day = Number(input.day)
  if (!Number.isInteger(day) || day < 0 || day >= days) fail('validation', 'Choose a day of this trip.')
  const choices = readChoices(plan.choices, days)
  if (input.place) {
    const payload = await cms()
    const near = await nearbyPlaces(payload, relIds(plan.destinations))
    const place = near.find((n) => n.id === input.place && n.type === 'day')
    if (!place) fail('validation', 'That place is not a nearby day trip for this plan.')
    if (day === 0 || day === days - 1) fail('validation', 'Choose a full day: not your arrival or departure day.')
    choices.days.forEach((d) => { if (d.dayTrip === place!.id) d.dayTrip = null })
    choices.days[day].dayTrip = place!.id
  } else {
    choices.days[day].dayTrip = null
  }
  await save(plan.id, plan, choices)
  return { id: plan.id }
}
