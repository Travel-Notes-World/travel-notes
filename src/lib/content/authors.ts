import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { AUTHORS_TAG, authorTag } from './revalidate'

/** Fallback regeneration for author data (implementation plan §3: author pages 15 minutes). */
const AUTHOR_REVALIDATE_SECONDS = 15 * 60

/** The public fields of an author profile. Staff logins are a separate, private collection. */
export type AuthorProfile = {
  id: string
  name: string
  slug: string
  biography: string
  relevantExperience?: string
  links: { label: string; url: string }[]
}

const findAuthorBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<AuthorProfile | null> => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'authors',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: false,
      })
      const doc = result.docs[0]
      if (!doc) return null
      return {
        id: doc.id,
        name: doc.name,
        slug: doc.slug,
        biography: doc.biography,
        relevantExperience: doc.relevantExperience?.trim() || undefined,
        links: (doc.links ?? []).map((l) => ({ label: l.label, url: l.url })),
      }
    },
    ['author-by-slug', slug],
    { tags: [authorTag(slug), AUTHORS_TAG], revalidate: AUTHOR_REVALIDATE_SECONDS },
  )()

/**
 * Returns null only when the CMS answered and has no author with this slug.
 * If the CMS cannot be reached the error is passed on, so an outage is never cached as a missing page.
 */
export async function getAuthor(slug: string): Promise<AuthorProfile | null> {
  return findAuthorBySlug(slug)
}
