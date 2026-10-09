/**
 * Travel update rules shared by the CMS collection and the public pages. No Payload imports here,
 * so both sides (and the tests) use exactly the same values.
 */

export const UPDATE_CATEGORIES = [
  { value: 'entry-rules', label: 'Entry rules and visas' },
  { value: 'flights-routes', label: 'Flights and routes' },
  { value: 'closures', label: 'Closures and disruptions' },
  { value: 'safety', label: 'Safety advisories' },
  { value: 'fees', label: 'Fees and taxes' },
  { value: 'events', label: 'Events and seasons' },
  { value: 'other', label: 'Other changes' },
] as const

export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number]['value']

export const categoryLabel = (value: string | null | undefined): string => UPDATE_CATEGORIES.find((c) => c.value === value)?.label ?? 'Travel update'

export const isCategory = (value: unknown): value is UpdateCategory => UPDATE_CATEGORIES.some((c) => c.value === value)

/** A source link must be a full https:// address with no login details. */
export function validSourceUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && Boolean(url.hostname) && url.hostname.includes('.') && !url.username && !url.password
  } catch {
    return false
  }
}
