import { Pool } from 'pg'

import { indexRules, matchRule, type RedirectMatch, type RedirectRule } from './rules'

/**
 * Redirect rules for the proxy, read straight from the "redirects" table (not through Payload, which
 * is far too heavy to load for every request) and kept in memory for a minute per server.
 *
 * Fail open: if the rules cannot be loaded, the last good copy is used, or none at all. A request is
 * then simply passed through. Nothing here ever throws to the caller or blocks the site.
 */

export const RULES_TTL_MS = 60_000
/** After a failed load, try again sooner than the normal refresh. */
const RETRY_MS = 10_000
const QUERY_TIMEOUT_MS = 2_000

type Cache = { index: Map<string, RedirectRule>; loadedAt: number; ttl: number; pending: Promise<void> | null }
const cache: Cache = { index: new Map(), loadedAt: 0, ttl: 0, pending: null }

let pool: Pool | null = null
const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    pool = new Pool({ connectionString, max: 1, idleTimeoutMillis: 30_000, connectionTimeoutMillis: QUERY_TIMEOUT_MS, query_timeout: QUERY_TIMEOUT_MS })
    // An idle connection dropped by the database must not crash the process.
    pool.on('error', () => {})
  }
  return pool
}

async function refresh(): Promise<void> {
  try {
    const result = await getPool().query<RedirectRule>('SELECT "from", "to", "type" FROM "redirects"')
    cache.index = indexRules(result.rows)
    cache.ttl = RULES_TTL_MS
  } catch (error) {
    // Keep the last good rules; retry soon.
    cache.ttl = RETRY_MS
    console.error('[redirects] rules could not be loaded; requests pass through.', error instanceof Error ? error.message : error)
  } finally {
    cache.loadedAt = Date.now()
    cache.pending = null
  }
}

/** The redirect for a request, or null to let it through. Never throws. */
export async function findRedirect(pathname: string, search: string): Promise<RedirectMatch | null> {
  try {
    if (Date.now() - cache.loadedAt >= cache.ttl) {
      cache.pending ??= refresh()
      // Only the very first load is awaited; later refreshes happen while the current copy is served.
      if (cache.loadedAt === 0) await cache.pending
    }
    return matchRule(cache.index, pathname, search)
  } catch {
    return null
  }
}

/** For tests: forget the cached rules (and optionally point at another database). */
export async function resetRedirectCache(): Promise<void> {
  cache.index = new Map()
  cache.loadedAt = 0
  cache.ttl = 0
  cache.pending = null
  if (pool) await pool.end().catch(() => {})
  pool = null
}
