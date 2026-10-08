import 'server-only'

import type { Card } from '../community/queries'

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
