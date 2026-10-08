import type { Payload, Where } from 'payload'

import type { Destination } from '../../payload-types'
import { cms, relId, run, sql } from './db'
import { fail, invalid } from './errors'
import { requireActive } from './members'
import { limit } from './ratelimit'
import { cleanLine, cleanText } from './text'
import type { MemberActor } from './types'

export type DestinationRef = {
  id: string
  name: string
  /** Canonical path, for example "thailand/bangkok". */
  path: string
  kind: string
  /** Name of the parent, used to tell apart places with the same name. */
  parentName: string | null
  /** "Bangkok, Thailand" */
  label: string
  timeZone: string | null
  hubIndexable: boolean
  summary: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

const published: Where = { _status: { equals: 'published' } }

function toRef(doc: Destination): DestinationRef {
  const parent = doc.parent && typeof doc.parent === 'object' ? doc.parent : null
  return {
    id: doc.id,
    name: doc.name,
    path: doc.path ?? doc.slug,
    kind: doc.kind,
    parentName: parent?.name ?? null,
    label: parent ? `${doc.name}, ${parent.name}` : doc.name,
    timeZone: doc.timeZone ?? null,
    hubIndexable: Boolean(doc.hubIndexable),
    summary: doc.summary ?? '',
  }
}

/** Published destination records for a set of ids, in the order given. Unknown ids are dropped. */
export async function destinationsByIds(ids: (string | null | undefined)[], payload?: Payload): Promise<DestinationRef[]> {
  const unique = [...new Set(ids.filter(isUuid))]
  if (!unique.length) return []
  const p = payload ?? (await cms())
  const found = await p.find({ collection: 'destinations', where: { and: [{ id: { in: unique } }, published] }, limit: unique.length, pagination: false, depth: 1 })
  const byId = new Map(found.docs.map((d) => [d.id, toRef(d)]))
  return unique.map((id) => byId.get(id)).filter((d): d is DestinationRef => Boolean(d))
}

/** The given destinations plus every parent above them, so a post about Bangkok also belongs to Thailand. */
export async function withAncestors(ids: string[], payload?: Payload): Promise<string[]> {
  const p = payload ?? (await cms())
  const all = new Set(ids.filter(isUuid))
  let frontier = [...all]
  for (let depth = 0; depth < 4 && frontier.length; depth++) {
    const found = await p.find({ collection: 'destinations', where: { id: { in: frontier } }, limit: frontier.length, pagination: false, depth: 0, select: { parent: true } })
    frontier = []
    for (const doc of found.docs) {
      const parent = relId(doc.parent)
      if (parent && !all.has(parent)) {
        all.add(parent)
        frontier.push(parent)
      }
    }
  }
  return [...all]
}

/**
 * Find destinations by name or alternative name. The person always chooses from the results;
 * nothing is picked for them from their network address.
 */
export async function searchDestinations(query: unknown, max = 8): Promise<DestinationRef[]> {
  const q = cleanLine(query, 60)
  if (q.length < 2) return []
  const p = await cms()
  const found = await p.find({
    collection: 'destinations',
    where: { and: [published, { or: [{ name: { like: q } }, { aliases: { like: q } }] }] },
    sort: ['-population', 'name'],
    limit: Math.min(max, 20) * 3,
    depth: 1,
  })
  // Names that start with what was typed come first, then the rest, each group by size.
  const lower = q.toLowerCase()
  const starts = found.docs.filter((d) => d.name.toLowerCase().startsWith(lower))
  const rest = found.docs.filter((d) => !d.name.toLowerCase().startsWith(lower))
  return [...starts, ...rest].slice(0, max).map(toRef)
}

export async function getDestinationByPath(path: string): Promise<(DestinationRef & { doc: Destination }) | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/.test(path)) return null
  const p = await cms()
  const found = await p.find({ collection: 'destinations', where: { and: [{ path: { equals: path } }, published] }, limit: 1, depth: 1 })
  const doc = found.docs[0]
  return doc ? { ...toRef(doc), doc } : null
}

export type DestinationCount = DestinationRef & { posts: number }

/**
 * Destinations that have approved community posts, with how many. Only these are listed in the
 * community directory, so the site never shows page after page of empty destinations.
 */
export async function destinationsWithContent(options: { parentId?: string | null; kind?: 'country' | 'any'; max?: number } = {}): Promise<DestinationCount[]> {
  const p = await cms()
  const parentFilter = options.parentId ? sql`AND d."parent_id" = ${options.parentId}::uuid` : sql``
  const kindFilter = options.kind === 'country' ? sql`AND d."kind" = 'country'` : sql``
  const result = await run(
    p,
    sql`SELECT d."id", COUNT(DISTINCT c."id") AS posts
        FROM "contributions_rels" r
        JOIN "contributions" c ON c."id" = r."parent_id" AND c."state" = 'published'
        JOIN "destinations" d ON d."id" = r."destinations_id" AND d."_status" = 'published'
        WHERE r."path" = 'destinationTree' ${parentFilter} ${kindFilter}
        GROUP BY d."id" ORDER BY posts DESC, d."id" LIMIT ${Math.min(options.max ?? 60, 200)}`,
  )
  const counts = new Map(result.rows.map((r) => [String(r.id), Number(r.posts)]))
  const refs = await destinationsByIds([...counts.keys()], p)
  return refs.map((r) => ({ ...r, posts: counts.get(r.id) ?? 0 })).sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name))
}

/** Ask for a place that is not in the list. A moderator checks it; it is never published automatically. */
export async function suggestDestination(actor: MemberActor, input: { name: unknown; country: unknown; details?: unknown }): Promise<{ ok: true }> {
  const member = await requireActive(actor)
  await limit('suggestion', member.id)
  const name = cleanLine(input.name, 120)
  const country = cleanLine(input.country, 120)
  const details = cleanText(input.details, 600)
  const errors: Record<string, string> = {}
  if (name.length < 2) errors.name = 'Enter the name of the place.'
  if (country.length < 2) errors.country = 'Enter the country it is in.'
  if (Object.keys(errors).length) invalid(errors)
  const p = await cms()
  const open = await p.count({ collection: 'destination-suggestions', where: { and: [{ member: { equals: member.id } }, { status: { equals: 'pending' } }] } })
  if (open.totalDocs >= 10) fail('rate_limited', 'You already have several suggestions waiting for review. Thank you; a moderator will look at them.')
  await p.create({ collection: 'destination-suggestions', data: { member: member.id, name, country, details, status: 'pending' } })
  return { ok: true }
}
