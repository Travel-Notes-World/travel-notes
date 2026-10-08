import { TYPE_PATH, type ContributionType } from './constants'
import { contributionPath } from './contributions'
import { cms, run, sql } from './db'
import { siteIndexable } from './seo'
import { getSettings } from './settings'

export type SitemapEntry = { path: string; lastModified?: string }

/**
 * Canonical, indexable, public community addresses, with the date their content last changed.
 *
 * A page is listed only if it is published AND indexable under the same rules the page itself
 * uses for its robots tag (src/lib/community/seo.ts). Drafts, pending items, hidden or removed
 * posts, private pages, search results and thin pages are never listed.
 * `lastModified` is the date of the last approved content change, never "today".
 *
 * Each group is capped. If the community outgrows the caps, split this with generateSitemaps
 * (see docs/community/setup-and-deployment.md).
 */
export async function communitySitemap(options: { ignoreSiteFlag?: boolean } = {}): Promise<SitemapEntry[]> {
  if (!options.ignoreSiteFlag && !siteIndexable()) return []
  const settings = await getSettings()
  if (!settings.publicAccess) return []
  const payload = await cms()
  const entries: SitemapEntry[] = []

  const policyQuestions = settings.questionsAuto
    ? sql`OR ("indexing" = 'policy' AND "type" = 'question' AND COALESCE("reply_count", 0) >= ${settings.questionMinAnswers} AND "question_duplicate_of_id" IS NULL)`
    : sql``
  const posts = await run(
    payload,
    sql`SELECT "type", "short_id", "slug", COALESCE("content_updated_at", "published_at") AS modified FROM "contributions"
        WHERE "state" = 'published' AND ("indexing" = 'allow' ${policyQuestions})
        ORDER BY "published_at" DESC NULLS LAST, "id" LIMIT 20000`,
  )
  const typesWithIndexable = new Set<string>()
  for (const row of posts.rows) {
    typesWithIndexable.add(String(row.type))
    entries.push({ path: contributionPath({ type: String(row.type), shortId: String(row.short_id), slug: String(row.slug) }), lastModified: row.modified ? new Date(String(row.modified)).toISOString() : undefined })
  }
  // A listing page is worth indexing only once it lists something indexable.
  for (const type of ['question', 'trip', 'activity'] as ContributionType[]) if (typesWithIndexable.has(type)) entries.push({ path: TYPE_PATH[type] })
  if (typesWithIndexable.size) entries.push({ path: '/community' })

  const hubs = await run(
    payload,
    sql`SELECT d."path", MAX(COALESCE(c."content_updated_at", c."published_at")) AS modified FROM "destinations" d
        JOIN "contributions_rels" r ON r."destinations_id" = d."id" AND r."path" = 'destinationTree'
        JOIN "contributions" c ON c."id" = r."parent_id" AND c."state" = 'published'
        WHERE d."hub_indexable" = true AND d."_status" = 'published' GROUP BY d."path" ORDER BY d."path" LIMIT 5000`,
  )
  for (const row of hubs.rows) entries.push({ path: `/community/${row.path}`, lastModified: row.modified ? new Date(String(row.modified)).toISOString() : undefined })

  const profiles = await run(
    payload,
    sql`SELECT "handle" FROM "members" WHERE "status" = 'active' AND "_verified" = true
        AND COALESCE("published_count", 0) + COALESCE("answer_count", 0) >= ${settings.profileMinPublished} ORDER BY "handle" LIMIT 5000`,
  )
  for (const row of profiles.rows) entries.push({ path: `/travellers/${row.handle}` })
  return entries
}
