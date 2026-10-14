import { cleanLine, cleanText } from '../community/text'
import type { StoredDay, StoredStop } from '../community/plans'

/**
 * Activity choices for each part of each day. The AI suggests a first choice and up to two
 * alternatives for every slot (morning, afternoon, evening); the traveller picks one, removes it,
 * or locks it so a revision keeps it. Only the CHOSEN option of a slot is counted in the budget.
 *
 * The chosen options are also written into the plan's days as stops, so the day editor, the
 * share page and the PDF keep showing exactly what was chosen.
 *
 * Stored on the plan as JSON (field `choices`) and always read back through {@link readChoices}.
 */

export const SLOTS = ['morning', 'afternoon', 'evening'] as const
export type SlotTime = (typeof SLOTS)[number]
export const SLOT_LABEL: Record<SlotTime, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }

export type ChoiceOption = {
  id: string
  title: string
  place: string
  /** Why it fits, in one sentence. */
  notes: string
  origin: 'travel_notes' | 'ai_idea'
  sourcePath: string | null
  /** A saved price check for this activity's ticket, when the AI matched one from the list it was given. */
  priceId: string | null
  /** The AI's suggested time to spend there, in minutes. An estimate, shown as one. */
  minutes: number | null
}

export type Slot = { id: string; time: SlotTime; options: ChoiceOption[]; selected: string | null; locked: boolean }
export type ChoiceDay = { slots: Slot[]; dayTrip: string | null }
export type Choices = { days: ChoiceDay[] }

export const MAX_OPTIONS = 3

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const ID = /^[a-z0-9-]{1,40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PATH = /^\/[a-z0-9/_-]{1,290}$/i

function readOption(v: unknown, i: number): ChoiceOption | null {
  const o = obj(v)
  const title = cleanLine(o.title, 140)
  if (!title) return null
  const sourcePath = typeof o.sourcePath === 'string' && PATH.test(o.sourcePath) && !o.sourcePath.startsWith('//') ? o.sourcePath : null
  const minutes = typeof o.minutes === 'number' && Number.isInteger(o.minutes) && o.minutes >= 15 && o.minutes <= 720 ? o.minutes : null
  return {
    id: typeof o.id === 'string' && ID.test(o.id) ? o.id : `o${i}`,
    title,
    place: cleanLine(o.place, 200),
    notes: cleanText(o.notes, 600),
    origin: o.origin === 'travel_notes' && sourcePath ? 'travel_notes' : 'ai_idea',
    sourcePath: o.origin === 'travel_notes' ? sourcePath : null,
    priceId: typeof o.priceId === 'string' && UUID.test(o.priceId) ? o.priceId : null,
    minutes,
  }
}

/** Read stored choices safely, for a plan with `dayCount` days. */
export function readChoices(stored: unknown, dayCount: number): Choices {
  const days = list(obj(stored).days)
  return {
    days: Array.from({ length: dayCount }, (_, d) => {
      const day = obj(days[d])
      const seen = new Set<string>()
      const slots: Slot[] = list(day.slots).slice(0, SLOTS.length).map((s, i) => {
        const raw = obj(s)
        const options = list(raw.options).slice(0, MAX_OPTIONS).map(readOption).filter((o): o is ChoiceOption => Boolean(o))
        const ids = new Set<string>()
        for (const o of options) { while (ids.has(o.id)) o.id = `${o.id}x`; ids.add(o.id) }
        const time = SLOTS.includes(raw.time as SlotTime) ? (raw.time as SlotTime) : SLOTS[i]
        const selected = typeof raw.selected === 'string' && ids.has(raw.selected) ? raw.selected : null
        return { id: `d${d}-${time}`, time, options, selected, locked: raw.locked === true && selected !== null }
      }).filter((s) => s.options.length > 0 && !seen.has(s.time) && (seen.add(s.time), true))
      slots.sort((a, b) => SLOTS.indexOf(a.time) - SLOTS.indexOf(b.time))
      return { slots, dayTrip: typeof day.dayTrip === 'string' && UUID.test(day.dayTrip) ? day.dayTrip : null }
    }),
  }
}

export const chosen = (slot: Slot): ChoiceOption | null => slot.options.find((o) => o.id === slot.selected) ?? null

/** The AI stops of each day follow the chosen options; the member's own stops stay after them. */
export function mirrorStops(days: StoredDay[], choices: Choices): StoredDay[] {
  return days.map((day, d) => {
    const c = choices.days[d]
    if (!c || !c.slots.length) return day
    const own = day.stops.filter((s) => s.origin === 'own')
    const picked: StoredStop[] = c.slots.flatMap((slot) => {
      const o = chosen(slot)
      return o ? [{ title: o.title, place: o.place, notes: o.notes, savedContribution: null, origin: o.origin, sourcePath: o.sourcePath, timeOfDay: slot.time }] : []
    })
    return { ...day, stops: [...picked, ...own] }
  })
}

/** One option from an AI answer. Paths and price ids are only kept when they are on the allowed lists. */
export type AnswerOption = { title: string; place: string; notes: string; source: string; priceId?: string; minutes?: number }

export function optionFrom(a: AnswerOption, i: number, allowedPaths: Set<string>, allowedPrices: Set<string>): ChoiceOption | null {
  const path = typeof a.source === 'string' ? a.source.trim() : ''
  const checked = allowedPaths.has(path)
  const priceId = typeof a.priceId === 'string' && allowedPrices.has(a.priceId) ? a.priceId : null
  return readOption({ id: `o${i}`, title: a.title, place: a.place, notes: a.notes, origin: checked ? 'travel_notes' : 'ai_idea', sourcePath: checked ? path : null, priceId, minutes: a.minutes }, i)
}

/**
 * Build the choices from an AI answer. Slots the traveller locked keep their choice; the AI's
 * new suggestion for a locked slot is ignored. The first option is chosen by default.
 */
export function choicesFromAnswer(
  answerDays: { day: number; stops: (AnswerOption & { timeOfDay?: string; alternatives?: AnswerOption[] })[] }[],
  dayCount: number,
  previous: Choices,
  allowedPaths: Set<string>,
  allowedPrices: Set<string>,
): Choices {
  return {
    days: Array.from({ length: dayCount }, (_, d) => {
      const before = previous.days[d] ?? { slots: [], dayTrip: null }
      const locked = before.slots.filter((s) => s.locked)
      const fromAi = answerDays.find((x) => x.day === d + 1)?.stops ?? []
      const slots: Slot[] = [...locked]
      for (const stop of fromAi) {
        const time = SLOTS.find((t) => t === stop.timeOfDay)
        if (!time || slots.some((s) => s.time === time)) continue
        const options = [stop, ...(stop.alternatives ?? [])].slice(0, MAX_OPTIONS).map((a, i) => optionFrom(a, i, allowedPaths, allowedPrices)).filter((o): o is ChoiceOption => Boolean(o))
        if (!options.length) continue
        slots.push({ id: `d${d}-${time}`, time, options, selected: options[0].id, locked: false })
      }
      slots.sort((a, b) => SLOTS.indexOf(a.time) - SLOTS.indexOf(b.time))
      return { slots, dayTrip: before.dayTrip }
    }),
  }
}

/** Plain JSON for storing. */
export const choicesJson = (c: Choices) => ({ days: c.days.map((d) => ({ dayTrip: d.dayTrip, slots: d.slots.map((s) => ({ time: s.time, selected: s.selected, locked: s.locked, options: s.options })) })) })
