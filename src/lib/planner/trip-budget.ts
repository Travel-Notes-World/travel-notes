import type { Payload } from 'payload'

import type { PlanView } from '../community/plans'
import { computeBudget, type Budget, type BudgetDay } from './budget'
import { loadPriceFinder } from './prices'

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

/** The budget for a saved plan, from the member's set-up and the saved price checks. */
export async function planBudget(payload: Payload, view: PlanView, now = new Date()): Promise<{ budget: Budget; places: { id: string; name: string }[]; prices: number } | null> {
  const placeIds = view.planner?.placeIds ?? []
  if (!placeIds.length || !view.days.length) return null
  const found = await payload.find({ collection: 'destinations', where: { id: { in: placeIds } }, limit: placeIds.length, pagination: false, depth: 0, draft: false, select: { name: true } })
  const places = placeIds.map((id) => found.docs.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d)).map((d) => ({ id: d.id, name: d.name }))
  if (!places.length) return null
  const { find, count } = await loadPriceFinder(payload, places.map((p) => p.id))
  const budget = computeBudget({
    setup: view.trip,
    days: dayPlaces(view.days, places),
    places,
    find,
    departFrom: view.details.departFrom || undefined,
    budget: view.details.budgetAmount ? { amountCents: Math.round(view.details.budgetAmount * 100), currency: view.details.budgetCurrency || 'AUD' } : null,
    now,
  })
  return { budget, places, prices: count }
}
