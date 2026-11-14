import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { type Photo, photosByIds } from './photos'
import { AUTHORS_TAG, authorTag } from './revalidate'

/**
 * An author's profile photo by their address name (slug), or null when they have none.
 * Cached per author and cleared when the author or an image changes, so a byline anywhere on the
 * site costs at most one lookup per author.
 */
export const getAuthorPhoto = (slug: string): Promise<Photo | null> =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      const author = await payload
        .find({ collection: 'authors', where: { slug: { equals: slug } }, limit: 1, depth: 0, select: { photo: true }, overrideAccess: false })
        .then((r) => r.docs[0] ?? null)
      const photoId = typeof author?.photo === 'string' ? author.photo : author?.photo && typeof author.photo === 'object' ? author.photo.id : null
      if (!photoId) return null
      return (await photosByIds(payload, [photoId])).get(photoId) ?? null
    },
    ['author-photo', slug],
    { tags: [AUTHORS_TAG, authorTag(slug)], revalidate: 60 * 60 },
  )().catch(() => null)
