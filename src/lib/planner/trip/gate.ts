import { calculateBudget, selectedItems, warningsFor, type Budget, type BudgetLine, type SelectedItem } from './calc'
import type { TripForm } from './form'
import type { Alternative, Base, Gateway, PlanDay, PriceFact, Rate, Selection, TripPlan } from './plan'

/**
 * What a visitor is allowed to see of a trip. This runs on the server, and only its result is sent
 * to the browser: locked days are never sent and then hidden with blur.
 *
 * Free preview: the full-trip total and category summary, the city route, and the first three days
 * complete (items, costs and map stops). Trips of three days or fewer are shown in full. Payment
 * unlocks the remaining days, their map stops and the PDF.
 */

export const PREVIEW_DAYS = 3

export const visibleDayCount = (days: number, unlocked: boolean): number => (unlocked ? days : Math.min(days, PREVIEW_DAYS))

export type VisibleDay = Omit<PlanDay, 'items'> & { locked: false; items: SelectedItem[]; alternatives: Alternative[]; subtotal: Budget['byDay'][number] }
export type LockedDay = { locked: true; day: number; date: string; base: string; overnight: string }

export type TripView = {
  unlocked: boolean
  previewDays: number
  summary: string
  why: string
  gateway: Gateway
  bases: Base[]
  days: (VisibleDay | LockedDay)[]
  budget: Budget
  /** Price facts used by the visible lines only, for the "where this price comes from" details. */
  facts: Record<string, PriceFact>
  rates: Rate[]
  assumptions: string[]
  checks: string[]
  warnings: string[]
}

/** Build the view of a trip for this visitor. `unlocked` must come from a server-side payment check. */
export function tripView(form: TripForm, plan: TripPlan, sel: Selection, unlocked: boolean): TripView {
  const budget = calculateBudget(form, plan, sel)
  const shown = visibleDayCount(plan.days.length, unlocked)
  const items = selectedItems(plan, sel)
  const isOpen = (day: number) => day <= shown

  const days: TripView['days'] = plan.days.map((d) =>
    isOpen(d.day)
      ? { ...d, locked: false as const, items: items.get(d.day) ?? [], alternatives: plan.alternatives.filter((a) => a.day === d.day && !sel.added.includes(a.id) && !Object.values(sel.replaced).includes(a.id)), subtotal: budget.byDay.find((b) => b.day === d.day)! }
      : { locked: true as const, day: d.day, date: d.date, base: d.base, overnight: d.overnight },
  )

  // Lines from locked days are summed into one line per category, so the totals still add up
  // but nothing about those days' activities reaches the browser.
  let lines: BudgetLine[] = budget.lines
  let byDay = budget.byDay
  if (shown < plan.days.length) {
    const hidden = (l: BudgetLine) => (l.day !== null && l.day > shown) || (l.itemDay !== undefined && l.itemDay > shown)
    const open = budget.lines.filter((l) => !hidden(l))
    const closed = budget.lines.filter(hidden)
    const groups = new Map<string, BudgetLine>()
    for (const l of closed) {
      const oneTime = l.day === null
      const key = `${l.category}|${oneTime}`
      const g = groups.get(key)
      const range = `days ${shown + 1}–${plan.days.length}`
      if (!g) groups.set(key, { ...l, id: `locked-${key}`, label: `${oneTime ? 'Travel' : 'Daily costs'} for ${range} (unlock to see each item)`, day: null, quantity: '1 item', factKey: null, note: '', itemDay: undefined, status: l.status === 'unavailable' ? 'unavailable' : 'priced', paid: false })
      else {
        g.low += l.low; g.high += l.high; g.working += l.working
        const n = Number(g.quantity.split(' ')[0]) + 1
        g.quantity = `${n} items`
        if (l.status === 'unavailable') g.status = 'unavailable'
      }
    }
    lines = [...open, ...groups.values()]
    byDay = budget.byDay.filter((b) => b.day <= shown)
  }
  const redacted: Budget = {
    ...budget,
    lines,
    byDay,
    // Missing items on locked days are counted, not named.
    missing: budget.missing.map((m) => (m.day !== null && m.day > shown ? { ...m, label: `An item on a locked day (${m.category})` } : m)),
  }
  const usedKeys = new Set(lines.map((l) => l.factKey).filter((k): k is string => Boolean(k)))
  const facts = Object.fromEntries(Object.entries(plan.prices).filter(([k]) => usedKeys.has(k)))

  return {
    unlocked,
    previewDays: shown,
    summary: plan.summary,
    why: plan.why,
    gateway: plan.gateway,
    bases: plan.bases,
    days,
    budget: redacted,
    facts,
    rates: Object.values(plan.rates),
    assumptions: plan.assumptions,
    checks: plan.checks,
    warnings: warningsFor(plan, sel, budget).filter((w) => {
      const m = /^Day (\d+)/.exec(w)
      return !m || Number(m[1]) <= shown
    }),
  }
}

// ---------------------------------------------------------------------------------------------
// Changes the traveller makes. Every change is checked on the server against the plan and the
// visitor's access before it is saved.

export type Change = { op: 'remove'; item: string } | { op: 'replace'; item: string; with: string } | { op: 'add'; alt: string } | { op: 'undo'; item: string } | { op: 'unadd'; alt: string } | { op: 'contingency'; pct: number }

export function applyChange(plan: TripPlan, sel: Selection, change: Change, unlocked: boolean): Selection {
  const shown = visibleDayCount(plan.days.length, unlocked)
  const itemDay = (id: string) => plan.days.find((d) => d.items.some((i) => i.id === id))?.day ?? null
  const alt = (id: string) => plan.alternatives.find((a) => a.id === id) ?? null
  const allowedDay = (day: number | null) => day !== null && day <= shown
  const next: Selection = { removed: [...sel.removed], replaced: { ...sel.replaced }, added: [...sel.added], contingencyPct: sel.contingencyPct }
  switch (change.op) {
    case 'remove': {
      if (!allowedDay(itemDay(change.item))) throw new Error('This item cannot be changed.')
      if (!next.removed.includes(change.item)) next.removed.push(change.item)
      delete next.replaced[change.item]
      return next
    }
    case 'replace': {
      const a = alt(change.with)
      const day = itemDay(change.item)
      if (!a || !allowedDay(day) || a.day !== day) throw new Error('That choice cannot replace this item.')
      next.replaced[change.item] = a.id
      next.removed = next.removed.filter((x) => x !== change.item)
      next.added = next.added.filter((x) => x !== a.id)
      return next
    }
    case 'add': {
      const a = alt(change.alt)
      if (!a || !allowedDay(a.day)) throw new Error('That choice cannot be added.')
      if (!next.added.includes(a.id)) next.added.push(a.id)
      return next
    }
    case 'undo': {
      if (!allowedDay(itemDay(change.item))) throw new Error('This item cannot be changed.')
      next.removed = next.removed.filter((x) => x !== change.item)
      delete next.replaced[change.item]
      return next
    }
    case 'unadd': {
      const a = alt(change.alt)
      if (!a || !allowedDay(a.day)) throw new Error('That choice cannot be changed.')
      next.added = next.added.filter((x) => x !== change.alt)
      return next
    }
    case 'contingency':
      next.contingencyPct = Math.max(0, Math.min(30, Math.round(change.pct)))
      return next
  }
}
