import { cms } from './db'

export type CommunityTopic = { id: string; name: string; slug: string; introduction: string }

/**
 * A published topic by its slug, for the community topic page. Read with a visitor's permissions,
 * so a draft topic is never returned.
 */
export async function getCommunityTopic(slug: string): Promise<CommunityTopic | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  const payload = await cms()
  const found = await payload.find({
    collection: 'topics',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    draft: false,
    overrideAccess: false,
    select: { name: true, slug: true, introduction: true },
  })
  const doc = found.docs[0]
  return doc ? { id: doc.id, name: doc.name, slug: doc.slug, introduction: doc.introduction ?? '' } : null
}
