import config from '@payload-config'
import { getPayload } from 'payload'

import { indexableDestinationPaths } from './destinations'
import { indexableTopicPaths } from './topics'

export type EditorialSitemapEntry = { path: string; lastModified?: string }

/**
 * Canonical, indexable editorial addresses for the sitemap.
 *
 * Only published CMS articles are listed, and only when an
 * editor has not ticked "noindex". An author page is listed only when the author has at least one
 * listed article, matching the author page's own robots rule. A destination page is listed only
 * when an administrator has ticked "hubIndexable", and a topic page only when it passes the
 * automatic rule in topics.ts; both match the page's own robots rule.
 *
 * `lastModified` is the editor-set update date (or first publication), never "today".
 */
export async function editorialSitemap(): Promise<EditorialSitemapEntry[]> {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'articles',
    sort: '-firstPublishedAt',
    limit: 10000,
    pagination: false,
    depth: 0,
    draft: false,
    overrideAccess: false,
    select: { slug: true, seo: true, body: true, primaryAuthor: true, coauthors: true, firstPublishedAt: true, editorialUpdatedAt: true, createdAt: true },
  })
  const entries: EditorialSitemapEntry[] = []
  const authorIds = new Set<string>()
  for (const doc of found.docs) {
    // The article page renders only articles with a body and a primary author; the rest are not real pages.
    if (!doc.body || !doc.primaryAuthor || doc.seo?.noindex) continue
    const modified = doc.editorialUpdatedAt ?? doc.firstPublishedAt ?? doc.createdAt
    entries.push({ path: `/stories/${doc.slug}`, lastModified: modified ? new Date(modified).toISOString() : undefined })
    const ids = [doc.primaryAuthor, ...(doc.coauthors ?? [])].map((a) => (a && typeof a === 'object' ? a.id : a))
    for (const id of ids) if (typeof id === 'string') authorIds.add(id)
  }
  if (authorIds.size) {
    const authors = await payload.find({
      collection: 'authors',
      where: { id: { in: [...authorIds] } },
      limit: authorIds.size,
      pagination: false,
      depth: 0,
      overrideAccess: false,
      select: { slug: true },
    })
    for (const a of authors.docs) entries.push({ path: `/authors/${a.slug}` })
  }
  entries.push(...(await indexableDestinationPaths(payload)), ...(await indexableTopicPaths(payload)))
  return entries
}
