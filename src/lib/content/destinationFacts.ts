/**
 * The "Key facts" and "When to go" vocabulary for destination pages, shared by the CMS fields and
 * the page so the two can never disagree.
 */

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const
export type Month = (typeof MONTHS)[number]
export const MONTH_NAMES: Record<Month, string> = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
  jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December',
}
export const monthShort = (m: Month) => MONTH_NAMES[m].slice(0, 3)

/**
 * The kinds of fact an editor can add. `source: true` means the fact cannot be published without an
 * official source, because a reader may act on it (entry rules, safety, health, emergencies).
 */
export const FACT_KINDS = [
  { value: 'visa', label: 'Visa for Australians', source: true },
  { value: 'advice', label: 'Government travel advice', source: true },
  { value: 'health', label: 'Health and vaccines', source: true },
  { value: 'emergency', label: 'Emergency number', source: true },
  { value: 'currency', label: 'Currency', source: false },
  { value: 'language', label: 'Language', source: false },
  { value: 'plugs', label: 'Power plugs', source: false },
  { value: 'driving', label: 'Driving side', source: false },
  { value: 'tipping', label: 'Tipping', source: false },
  { value: 'water', label: 'Tap water', source: false },
  { value: 'flights', label: 'Flights from Australia', source: false },
  { value: 'other', label: 'Other (write your own label)', source: false },
] as const
export type FactKind = (typeof FACT_KINDS)[number]['value']

export const factNeedsSource = (kind: unknown): boolean => FACT_KINDS.some((k) => k.value === kind && k.source)
export const factLabel = (kind: string, custom?: string | null): string =>
  kind === 'other' ? (custom || '').trim() : FACT_KINDS.find((k) => k.value === kind)?.label ?? ''

export type MonthRating = 'best' | 'good' | 'other'

/** Twelve months, each rated from the editor's two lists. A month in both lists counts as "best". */
export function monthRatings(best: readonly string[] | null | undefined, good: readonly string[] | null | undefined): { month: Month; rating: MonthRating }[] {
  const b = new Set(best ?? [])
  const g = new Set(good ?? [])
  return MONTHS.map((month) => ({ month, rating: b.has(month) ? 'best' : g.has(month) ? 'good' : 'other' }))
}

/** "March to May and October to November": consecutive months joined into ranges, wrapping round the year. */
export function monthRanges(months: readonly string[] | null | undefined): string {
  const set = new Set((months ?? []).filter((m): m is Month => (MONTHS as readonly string[]).includes(m)))
  if (!set.size) return ''
  if (set.size === 12) return 'all year'
  const idx = MONTHS.map((m) => set.has(m))
  // Start just after a month that is not selected, so a run like Nov–Feb stays in one piece.
  const start = idx.findIndex((on, i) => on && !idx[(i + 11) % 12])
  const runs: [number, number][] = []
  for (let k = 0; k < 12; k++) {
    const i = (start + k) % 12
    if (!idx[i]) continue
    const last = runs.at(-1)
    if (last && (last[1] + 1) % 12 === i) last[1] = i
    else runs.push([i, i])
  }
  const name = (i: number) => MONTH_NAMES[MONTHS[i]]
  const parts = runs.map(([a, z]) => (a === z ? name(a) : `${name(a)} to ${name(z)}`))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
}

/** "UTC+9" or "UTC+5:30" for a time zone at the given moment (daylight saving included). */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value
    if (!part) return ''
    return part === 'GMT' ? 'UTC+0' : part.replace('GMT', 'UTC')
  } catch {
    return ''
  }
}
