/**
 * Redirect rules: pure functions shared by the CMS (when a rule is saved) and the proxy (when a
 * request is matched), so both apply exactly the same normalisation. No Payload or database here.
 */

export type RedirectType = 'permanent' | 'temporary' | 'gone'
export type RedirectRule = { from: string; to: string | null; type: RedirectType }
export type RedirectMatch = { status: 308 | 307; location: string } | { status: 410 }

export const STATUS: Record<RedirectType, 308 | 307 | 410> = { permanent: 308, temporary: 307, gone: 410 }

/** Addresses that are never redirected: the CMS, its API, Next.js files. */
const RESERVED = /^\/(admin|api|_next)(\/|$)/

/**
 * One form for every site address: leading slash, lower case, no trailing slash, no query string
 * or fragment. Used on save and on every request, so "/Stories/Old/" matches a rule saved as
 * "/stories/old". Returns null for anything that is not a site path.
 */
export function normalisePath(input: string): string | null {
  const raw = input.trim()
  if (!raw.startsWith('/') || raw.startsWith('//') || /[?#\s\\]/.test(raw)) return null
  let path = raw.toLowerCase().replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path.length > 512 || /(^|\/)\.\.?(\/|$)/.test(path)) return null
  return path
}

/** A rule's source address: a normalised site path that is not reserved and not the homepage. */
export function validFrom(input: string): string | null {
  const path = normalisePath(input)
  return path && path !== '/' && !RESERVED.test(path) ? path : null
}

/**
 * A rule's target: a site path (normalised the same way, may carry its own query string) or an
 * external https:// address. Anything else (http://, javascript:, //host, …) is refused.
 */
export function validTo(input: string): string | null {
  const raw = input.trim()
  if (raw.startsWith('/')) {
    const [path, query] = raw.split(/\?(.*)/s, 2)
    const clean = normalisePath(path)
    if (!clean || clean.includes('#') || (query ?? '').includes('#')) return null
    return query ? `${clean}?${query}` : clean
  }
  try {
    const url = new URL(raw)
    // No fragment: the visitor's query string is appended to the target, which a fragment would break.
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password && !url.hash ? url.toString() : null
  } catch {
    return null
  }
}

export const isExternal = (to: string) => to.startsWith('https://')
const pathOf = (to: string) => (isExternal(to) ? null : to.split('?')[0])

/** Index rules by their normalised source address for fast lookups. */
export function indexRules(rules: RedirectRule[]): Map<string, RedirectRule> {
  const map = new Map<string, RedirectRule>()
  for (const r of rules) {
    const from = validFrom(r.from)
    if (from) map.set(from, { ...r, from })
  }
  return map
}

/**
 * The response for a request, or null to let it through. The visitor's query string is kept: it is
 * added to the target, after any query string the target already has.
 */
export function matchRule(index: Map<string, RedirectRule>, pathname: string, search: string): RedirectMatch | null {
  const path = normalisePath(pathname)
  if (!path || RESERVED.test(path)) return null
  const rule = index.get(path)
  if (!rule) return null
  if (rule.type === 'gone') return { status: 410 }
  if (!rule.to) return null
  // A target that is this same address would loop; saving refuses it, and this guards old data.
  if (pathOf(rule.to) === path) return null
  const extra = search.startsWith('?') ? search.slice(1) : search
  const location = extra ? `${rule.to}${rule.to.includes('?') ? '&' : '?'}${extra}` : rule.to
  return { status: STATUS[rule.type] as 308 | 307, location }
}

/** The path a site-internal target points at, for loop and chain checks; null for external targets. */
export const targetPath = pathOf
