/**
 * Expire cached public content by tag.
 *
 * `{ expire: 0 }` means stale content is never served: the next visitor waits
 * for fresh data. This is deliberate so that an unpublished or corrected
 * article can never keep being served from the cache.
 *
 * Interim approach. The implementation plan's durable outbox and worker
 * (retries, warming, verification) replace these direct calls later.
 */
export async function expireTags(tags: string[]): Promise<void> {
  try {
    const { revalidateTag } = await import('next/cache')
    for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 })
  } catch {
    // Outside a Next.js request (CLI migrations, tests) there is no page cache to expire.
  }
}

export const articleTag = (slug: string) => `article:${slug}`
export const ARTICLES_TAG = 'articles'
export const authorTag = (slug: string) => `author:${slug}`
export const AUTHORS_TAG = 'authors'
export const DESTINATIONS_TAG = 'destinations'
export const TOPICS_TAG = 'topics'
