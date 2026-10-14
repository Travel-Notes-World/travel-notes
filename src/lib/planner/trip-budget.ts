import type { Payload } from 'payload'

import type { PlanView } from '../community/plans'
import { computeBudget, type Budget, type BudgetDay, type PriceCheck } from './budget'
import { chosen, type Choices } from './choices'
import { loadPriceFinder } from './prices'
import { activeSlots, type Pace } from './timeline'

/**
 * Which trip place each day belongs to. Days made by the Trip Planner are titled with the place
 * name; a day the member renamed keeps the place of the day before it.
 */
export function dayPlaces(days: { title: string; overnight: string; date: string | null }[], places: { id: string; name: string }[]): BudgetDay[] {
  if (!places.length) return []
  let current = places[0].id
  return days.map((d) => {
    const text = `${d.title} ${d.overnight}`.toLowerCase()
    const hit = places.find((p) => d.title.toLowerCase() === p.name.toLowerCase()) ?? places.find((p) => text.includes(p.name.toLowerCase()))
    if (hit) current = hit.id
    return { date: d.date, placeId: current }
  })
}

export const paceOf = (view: PlanView): Pace => (['relaxed', 'balanced', 'full'].includes(view.planner?.pace ?? '') ? (view.planner!.pace as Pace) : 'balanced')

export type PlanBudget = {
  budget: Budget
  places: { id: string; name: string }[]
  prices: number
  days: BudgetDay[]
  priceById: (id: string) => PriceCheck | null
}

/** The budget for a saved plan, from the member's set-up, their chosen activities and the saved price checks. */
export async function planBudget(payload: Payload, view: PlanView, now = new Date(), extraNames: Map<string, string> = new Map()): Promise<PlanBudget | null> {
  const placeIds = view.planner?.placeIds ?? []
  if (!placeIds.length || !view.days.length) return null
  const found = await payload.find({ collection: 'destinations', where: { id: { in: placeIds } }, limit: placeIds.length, pagination: false, depth: 0, draft: false, select: { name: true } })
  const places = placeIds.map((id) => found.docs.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d)).map((d) => ({ id: d.id, name: d.name }))
  if (!places.length) return null
  const choices: Choices = view.choices
  const tripIds = choices.days.map((d) => d.dayTrip).filter((id): id is string => Boolean(id))
  // Day-trip places are loaded too, so their journey prices can be found.
  const names = new Map(extraNames)
  if (tripIds.length) {
    const t = await payload.find({ collection: 'destinations', where: { id: { in: tripIds } }, limit: tripIds.length, pagination: false, depth: 0, draft: false, select: { name: true } })
    for (const d of t.docs) names.set(d.id, d.name)
  }
  const { find, count, byId } = await loadPriceFinder(payload, [...places.map((p) => p.id), ...tripIds])
  const days = dayPlaces(view.days, places)
  const pace = paceOf(view)
  const activities = choices.days.flatMap((day, d) => {
    if (day.dayTrip) return []
    const open = activeSlots(view.trip, pace, d, days.length)
    return day.slots.filter((s) => open.includes(s.time)).flatMap((slot) => {
      const o = chosen(slot)
      return o ? [{ id: slot.id, day: d, label: o.title, price: o.priceId ? byId(o.priceId) : null }] : []
    })
  })
  const dayTrips = choices.days.flatMap((day, d) => (day.dayTrip && names.has(day.dayTrip) && days[d] ? [{ day: d, from: days[d].placeId, to: day.dayTrip, toName: names.get(day.dayTrip)! }] : []))
  const budget = computeBudget({
    setup: view.trip,
    days,
    places,
    find,
    activities,
    dayTrips,
    departFrom: view.details.departFrom || undefined,
    budget: view.details.budgetAmount ? { amountCents: Math.round(view.details.budgetAmount * 100), currency: view.details.budgetCurrency || 'AUD' } : null,
    now,
  })
  return { budget, places, prices: count, days, priceById: byId }
}
