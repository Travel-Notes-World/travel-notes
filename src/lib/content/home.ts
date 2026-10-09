import 'server-only'

import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import type { Destination } from '@/payload-types'

import type { Card } from '../community/queries'
import { editorSummary } from './destinations'
import { ARTICLES_TAG, DESTINATIONS_TAG } from './revalidate'

/** Topics have no cache tag of their own yet, so the topic list refreshes on a timer. */
const HOME_REVALIDATE_SECONDS = 5 * 60
/** How many recent articles are counted when choosing the destinations to feature. */
const ARTICLES_SCANNED = 200

/**
 * Real community content for the homepage. Nothing here is invented: if the community is closed or
 * has nothing published yet, the homepage says so instead of showing example posts.
 */
export type CommunityHighlights = {
  open: boolean
  question: Card | null
  trip: Card | null
}

export async function getCommunityHighlights(): Promise<CommunityHighlights> {
  try {
    const { canViewCommunity } = await import('../community/settings')
    if (!(await canViewCommunity(null))) return { open: false, question: null, trip: null }
    const { listPublished } = await import('../community/queries')
    const [questions, trips] = await Promise.all([
      listPublished({ type: 'question', pageSize: 1 }),
      listPublished({ type: 'trip', pageSize: 1 }),
    ])
    return { open: true, question: questions.items[0] ?? null, trip: trips.items[0] ?? null }
  } catch (error) {
    // The homepage must still render if the database is briefly unavailable.
    console.error('[home] community highlights could not be loaded', error)
    return { open: false, question: null, trip: null }
  }
}

export type FeaturedDestination = {
  id: string
  name: string
  path: string
  parentName: string | null
  summary: string
  accent: string | null
  guides: number
}

export type HomeTopic = { name: string; slug: string }

const parentOf = (d: Destination) => (d.parent && typeof d.parent === 'object' ? d.parent : null)

/**
 * Published destinations that have at least one published article, ordered by how many articles
 * they have. Destinations without editorial content are left out, so the homepage never features
 * an empty hub. Both queries run with a reader's permissions (`overrideAccess: false`, no user).
 */
const findFeaturedDestinations = (limit: number) =>
  unstable_cache(
    async (): Promise<FeaturedDestination[]> => {
      const payload = await getPayload({ config })
      const articles = await payload.find({
        collection: 'articles',
        where: { primaryDestination: { exists: true } },
        select: { primaryDestination: true },
        sort: '-firstPublishedAt',
        limit: ARTICLES_SCANNED,
        depth: 0,
        draft: false,
        overrideAccess: false,
      })
      const counts = new Map<string, number>()
      for (const { primaryDestination: d } of articles.docs) {
        const id = d && typeof d === 'object' ? d.id : d
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      if (!counts.size) return []
      const found = await payload.find({
        collection: 'destinations',
        where: { id: { in: [...counts.keys()] } },
        limit: counts.size,
        pagination: false,
        depth: 1,
        draft: false,
        overrideAccess: false,
      })
      return found.docs
        .filter((d) => d.path)
        .map((d) => ({
          id: d.id,
          name: d.name,
          path: d.path as string,
          parentName: parentOf(d)?.name ?? null,
          summary: editorSummary(d.name, d.summary),
          accent: d.accentColour || null,
          guides: counts.get(d.id) ?? 0,
        }))
        .sort((a, b) => b.guides - a.guides || a.name.localeCompare(b.name))
        .slice(0, limit)
    },
    ['home-destinations', String(limit)],
    { tags: [ARTICLES_TAG, DESTINATIONS_TAG], revalidate: HOME_REVALIDATE_SECONDS },
  )()

const findTopics = (limit: number) =>
  unstable_cache(
    async (): Promise<HomeTopic[]> => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'topics',
        select: { name: true, slug: true },
        sort: 'name',
        limit,
        depth: 0,
        draft: false,
        overrideAccess: false,
      })
      return result.docs.map((t) => ({ name: t.name, slug: t.slug }))
    },
    ['home-topics', String(limit)],
    { revalidate: HOME_REVALIDATE_SECONDS },
  )()

/** The homepage must still render if the CMS is briefly unavailable: the section is then hidden. */
export async function getFeaturedDestinations(limit = 6): Promise<FeaturedDestination[]> {
  try {
    return await findFeaturedDestinations(limit)
  } catch (error) {
    console.error('[home] destinations could not be loaded', error)
    return []
  }
}

export async function getHomeTopics(limit = 12): Promise<HomeTopic[]> {
  try {
    return await findTopics(limit)
  } catch (error) {
    console.error('[home] topics could not be loaded', error)
    return []
  }
}
