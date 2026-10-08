/** Plain helpers with no server-only imports, so they can be tested directly. */

/** Only allow a same-site path as a "come back here" target, never another website. */
export const safeReturnPath = (value: unknown, fallback = '/account'): string => {
  // Control characters and backslashes are refused outright: browsers drop tabs and newlines and
  // treat "\\" as "/", which can turn "/<tab>/evil.example" into an address on another site.
  if (typeof value !== 'string' || !value.startsWith('/') || value.length >= 300 || /[\u0000-\u001F\u007F\\]/.test(value)) return fallback
  try {
    const base = 'https://local.invalid'
    const url = new URL(value, base)
    if (url.origin !== base || url.pathname.startsWith('/api')) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
