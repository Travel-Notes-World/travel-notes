import type { BudgetLine } from './budget'
import { chosen, SLOTS, type ChoiceDay, type Slot, type SlotTime } from './choices'
import { mealsFor } from './budget'
import type { DayPart, TripSetup } from './costs'

/**
 * A realistic order for each day, built in code from the traveller's set-up: meals, the chosen
 * activity for each part of the day, rest, arrival and departure. Times are a suggested rhythm,
 * not bookings. Travel times between stops are not checked yet, so they are shown as "not checked".
 */

export type Pace = 'relaxed' | 'balanced' | 'full'

/** The parts of a day that have time for an activity, from the pace and the arrival and departure times. */
export function activeSlots(setup: Pick<TripSetup, 'arrival' | 'departure'>, pace: Pace, day: number, days: number): SlotTime[] {
  let slots: SlotTime[] = pace === 'relaxed' ? ['morning', 'afternoon'] : [...SLOTS]
  const after: Record<DayPart, SlotTime[]> = { morning: ['afternoon', 'evening'], afternoon: ['evening'], evening: [] }
  const before: Record<DayPart, SlotTime[]> = { morning: [], afternoon: ['morning'], evening: ['morning', 'afternoon'] }
  if (day === 0) slots = slots.filter((s) => after[setup.arrival].includes(s))
  if (day === days - 1) slots = slots.filter((s) => before[setup.departure].includes(s))
  return slots
}

export type TimelineEntry = {
  time: string
  kind: 'arrive' | 'leave' | 'meal' | 'activity' | 'travel' | 'rest' | 'stay'
  title: string
  detail: string
  /** Budget lines for this entry (meals, tickets, the night's room). */
  lines: BudgetLine[]
  slot?: Slot
  /** For entries without a clock time: where they sort. */
  sortAt?: string
}

const ARRIVE_AT: Record<DayPart, string> = { morning: '10:00', afternoon: '14:00', evening: '18:30' }
const LEAVE_AT: Record<DayPart, string> = { morning: '09:00', afternoon: '13:30', evening: '17:30' }
const SLOT_AT: Record<SlotTime, string> = { morning: '09:00', afternoon: '14:00', evening: '20:00' }
const MEAL_AT = { breakfast: '08:00', lunch: '12:30', dinner: '18:30' } as const

const hours = (m: number) => (m < 60 ? `${m} minutes` : `${Math.round((m / 60) * 2) / 2} hours`.replace('.5 hours', '½ hours').replace(/^1 hours$/, '1 hour'))

export function dayTimeline(input: {
  day: number
  days: number
  setup: TripSetup
  pace: Pace
  choice: ChoiceDay | undefined
  lines: BudgetLine[]
  placeName: string
  dayTripName?: string | null
}): TimelineEntry[] {
  const { day, days, setup, pace, lines } = input
  const out: TimelineEntry[] = []
  const lineFor = (prefix: string) => lines.filter((l) => l.id === `${prefix}-${day}`)
  const meals = mealsFor(setup, day, days)
  const first = day === 0
  const last = day === days - 1 && days > 1
  const slots = activeSlots(setup, pace, day, days)

  if (first) out.push({ time: ARRIVE_AT[setup.arrival], kind: 'arrive', title: `Arrive in ${input.placeName}`, detail: 'Travel to your accommodation and check in. Check-in times vary: confirm yours.', lines: [] })
  if (meals.includes('breakfast')) out.push({ time: MEAL_AT.breakfast, kind: 'meal', title: 'Breakfast', detail: '', lines: lineFor('breakfast') })
  else if (setup.breakfastIncluded && day > 0) out.push({ time: MEAL_AT.breakfast, kind: 'meal', title: 'Breakfast at your accommodation', detail: 'Included with your room.', lines: [] })
  const coffee = lineFor('coffee')
  if (coffee.length) out.push({ time: '10:30', kind: 'meal', title: 'Coffee or tea', detail: '', lines: coffee })

  if (input.dayTripName) {
    const trip = lines.filter((l) => l.id.startsWith(`daytrip-${day}-`))
    out.push({ time: '08:30', kind: 'travel', title: `Day trip to ${input.dayTripName}`, detail: 'Journey time not checked yet: check the timetable before you go.', lines: trip.filter((l) => l.id.endsWith('-out')) })
    out.push({ time: '10:30', kind: 'activity', title: `Explore ${input.dayTripName}`, detail: 'See the destination guide for ideas.', lines: [] })
    if (meals.includes('lunch')) out.push({ time: MEAL_AT.lunch, kind: 'meal', title: 'Lunch', detail: '', lines: lineFor('lunch') })
    out.push({ time: '16:30', kind: 'travel', title: `Back to ${input.placeName}`, detail: '', lines: trip.filter((l) => l.id.endsWith('-back')) })
  } else {
    for (const time of SLOTS) {
      if (time === 'afternoon' && meals.includes('lunch')) out.push({ time: MEAL_AT.lunch, kind: 'meal', title: 'Lunch', detail: '', lines: lineFor('lunch') })
      if (time === 'evening' && meals.includes('dinner')) {
        if (pace !== 'full' && slots.includes('afternoon')) out.push({ time: '16:30', kind: 'rest', title: 'Free time or rest', detail: pace === 'relaxed' || setup.childAges.length ? 'A break at your accommodation before dinner.' : 'Time to rest, shop or wander.', lines: [] })
        out.push({ time: MEAL_AT.dinner, kind: 'meal', title: 'Dinner', detail: '', lines: lineFor('dinner') })
      }
      if (!slots.includes(time)) continue
      const slot = input.choice?.slots.find((s) => s.time === time)
      const option = slot ? chosen(slot) : null
      if (out.some((e) => e.kind === 'activity')) out.push({ time: '', sortAt: SLOT_AT[time], kind: 'travel', title: 'Travel to the next stop', detail: 'Travel time not checked yet.', lines: [] })
      out.push({
        time: SLOT_AT[time],
        kind: 'activity',
        title: option ? option.title : slot ? 'Nothing chosen' : 'Free time',
        detail: option ? [option.place, option.minutes ? `Allow about ${hours(option.minutes)} (estimate)` : ''].filter(Boolean).join(' · ') : '',
        lines: option ? lines.filter((l) => l.id === `activity-${slot!.id}`) : [],
        slot,
      })
    }
  }

  if (last) out.push({ time: LEAVE_AT[setup.departure], kind: 'leave', title: 'Check out and travel to the airport', detail: 'Allow plenty of time for the airport.', lines: [] })
  else out.push({ time: '21:30', kind: 'stay', title: 'Back to your accommodation', detail: '', lines: lines.filter((l) => l.id === `stay-${day}`) })

  const extras = lines.filter((l) => ['snacks', 'water', 'local_transport'].some((p) => l.id === `${p}-${day}`))
  if (extras.length) out.push({ time: '', sortAt: '99:99', kind: 'travel', title: 'Through the day', detail: 'Snacks, water and local transport.', lines: extras })
  // In time order. A travel hint sits just before the activity it leads to.
  const key = (e: TimelineEntry) => `${e.time || e.sortAt || '99:99'}${e.time ? '1' : '0'}`
  return out.map((e, i) => ({ e, i })).sort((a, b) => key(a.e).localeCompare(key(b.e)) || a.i - b.i).map((x) => x.e)
}
