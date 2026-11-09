import { budgetAdvice, calculateBudget, routineOf, selectedItems, warningsFor, type Budget, type BudgetAdvice, type BudgetLine, type SelectedItem } from './calc'
import type { TripForm } from './form'
import { CATEGORY_LABEL, type Alternative, type Base, type Category, type Gateway, type PlanDay, type PriceFact, type Rate, type Selection, type TripPlan, type Unit } from './plan'

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
  /** Over budget: the cost drivers and sourced ways to spend less (amounts only, safe for locked days). */
  advice: BudgetAdvice | null
  /** Costs with no sourced price that this visitor may give their own allowance for. */
  allowanceKeys: { key: string; label: string; unit: Unit; amount: number | null }[]
}

/** Short names for the locked-day summary lines: "Meals for days 4–20". */
const LOCKED_LABEL: Record<Category, string> = { ...CATEGORY_LABEL, food: 'Meals, coffee and snacks', activities: 'Activities', local_transport: 'Local transport', transfers: 'Transfers', intercity: 'Travel between cities' }

/** Whether a price key may be shown and given an allowance before payment: routine costs, stays and flights reveal no day's plan. */
const isTripLevelKey = (key: string) => routineOf(key) !== null || key.startsWith('stay@') || key.startsWith('flight:')

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
    // One summary line per category ("Meals, coffee and snacks for days 4–20"): the estimated amount
    // of the priced items, and how many items are still unpriced. The group is "missing" only when
    // none of its items has a price.
    const range = `days ${shown + 1}–${plan.days.length}`
    const groups = new Map<string, { line: BudgetLine; items: number; unpriced: number }>()
    for (const l of closed) {
      const key = l.category
      const g = groups.get(key) ?? { line: { ...l, id: `locked-${key}`, label: `${LOCKED_LABEL[l.category]} for ${range}`, day: null, low: 0, high: 0, working: 0, quantity: '', factKey: null, note: 'Unlock to see each item', itemDay: undefined, status: 'unavailable', priceType: null, paid: false, optional: false }, items: 0, unpriced: 0 }
      g.items++
      if (l.status === 'unavailable') g.unpriced++
      else { g.line.low += l.low; g.line.high += l.high; g.line.working += l.working; g.line.status = 'priced' }
      groups.set(key, g)
    }
    for (const g of groups.values()) g.line.quantity = `Estimated from ${g.items - g.unpriced} of ${g.items} ${g.items === 1 ? 'item' : 'items'}${g.unpriced ? ` · ${g.unpriced} not yet priced` : ''}`
    lines = [...open, ...[...groups.values()].map((g) => g.line)]
    byDay = budget.byDay.filter((b) => b.day <= shown)
  }
  const redacted: Budget = {
    ...budget,
    lines,
    byDay,
    // Missing items on locked days are counted, not named.
    missing: budget.missing.map((m) => (m.day !== null && m.day > shown ? { ...m, label: `An item on a locked day (${m.category})` } : m)),
  }
  if (shown < plan.days.length) {
    // An unpriced activity that appears only on locked days is counted, not named.
    const openKeys = new Set(plan.days.filter((d) => d.day <= shown).flatMap((d) => d.items.map((i) => i.costKey)))
    redacted.byCategory = budget.byCategory.map((c) => {
      const named = c.unresolved.filter((u) => !u.key || isTripLevelKey(u.key) || openKeys.has(u.key))
      const hiddenCount = c.unresolved.filter((u) => !named.includes(u)).reduce((a, u) => a + u.count, 0)
      return { ...c, unresolved: hiddenCount ? [...named, { key: null, label: 'Items on locked days', count: hiddenCount }] : named }
    })
  }
  // Facts for the visible lines and for the alternatives offered on visible days (their links and prices).
  const usedKeys = new Set([...lines.map((l) => l.factKey), ...plan.alternatives.filter((a) => a.day <= shown).map((a) => a.costKey)].filter((k): k is string => Boolean(k)))
  // Budget-room prices are trip-level too: they back the "cheaper accommodation" saving.
  const facts = Object.fromEntries(Object.entries(plan.prices).filter(([k]) => usedKeys.has(k) || k.startsWith('stay-budget@')))
  const own = sel.allowances ?? {}
  const allowanceKeys = Object.values(plan.prices)
    .filter((f) => f.type === 'unavailable' && (unlocked || isTripLevelKey(f.key) || usedKeys.has(f.key)) && budget.lines.some((l) => l.factKey === f.key))
    .map((f) => ({ key: f.key, label: f.label, unit: f.unit, amount: typeof own[f.key] === 'number' ? own[f.key] : null }))

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
    advice: budgetAdvice(form, plan, sel, budget),
    allowanceKeys,
  }
}

// ---------------------------------------------------------------------------------------------
// Changes the traveller makes. Every change is checked on the server against the plan and the
// visitor's access before it is saved.

export type Change = { op: 'remove'; item: string } | { op: 'replace'; item: string; with: string } | { op: 'add'; alt: string } | { op: 'undo'; item: string } | { op: 'unadd'; alt: string } | { op: 'contingency'; pct: number } | { op: 'allowance'; key: string; amount: number | null }

export function applyChange(plan: TripPlan, sel: Selection, change: Change, unlocked: boolean): Selection {
  const shown = visibleDayCount(plan.days.length, unlocked)
  const itemDay = (id: string) => plan.days.find((d) => d.items.some((i) => i.id === id))?.day ?? null
  const alt = (id: string) => plan.alternatives.find((a) => a.id === id) ?? null
  const allowedDay = (day: number | null) => day !== null && day <= shown
  const next: Selection = { removed: [...sel.removed], replaced: { ...sel.replaced }, added: [...sel.added], contingencyPct: sel.contingencyPct, allowances: { ...(sel.allowances ?? {}) } }
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
    case 'allowance': {
      // Only for a cost with no sourced price; before payment, only for costs that reveal no locked day.
      const f = plan.prices[change.key]
      const openKeys = new Set(plan.days.filter((d) => d.day <= shown).flatMap((d) => d.items.map((i) => i.costKey)).filter(Boolean))
      if (!f || f.type !== 'unavailable' || !(unlocked || isTripLevelKey(change.key) || openKeys.has(change.key))) throw new Error('An allowance cannot be set for this cost.')
      if (change.amount === null) { delete next.allowances![change.key]; return next }
      if (!Number.isFinite(change.amount) || change.amount < 0 || change.amount > 100_000) throw new Error('Enter an amount between 0 and 100,000.')
      next.allowances![change.key] = Math.round(change.amount * 100) / 100
      return next
    }
  }
}
