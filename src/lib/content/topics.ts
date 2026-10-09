import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import type { Topic } from '@/payload-types'

import { ARTICLES_TAG, TOPICS_TAG } from './revalidate'
import { findStories, type Story } from './stories'

/**
 * Topic pages (/topics/<slug>), read from the CMS with a visitor's permissions (`overrideAccess:
 * false`, no user, `draft: false`), so a draft topic or a draft guide can never be shown. The plain
 * functions take a Payload instance so tests can call them; pages use the cached wrappers below.
 */

/** A topic page may be indexed only once it has at least this many published guides. */
export const MIN_GUIDES_FOR_INDEXING = 3
export const GUIDES_SHOWN = 24
const REVALIDATE_SECONDS = 60 * 60
const TAGS = [TOPICS_TAG, ARTICLES_TAG]
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const visitor = { draft: false, overrideAccess: false } as const

export type TopicPage = {
  name: string
  slug: string
  introduction: string
  seo: { title: string; description: string; noindex: boolean }
  /** The editor's featured articles that are published, in the editor's order. */
  featured: Story[]
  /** Other published guides tagged with this topic, newest first. */
  guides: Story[]
  /** Published guides on this topic, featured or tagged, each counted once. */
  guideTotal: number
}

const relId = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : null

/** A published topic by its address, or null (the page then returns a 404). */
export async function findTopic(payload: Payload, slug: string): Promise<Topic | null> {
  if (!SLUG.test(slug)) return null
  const found = await payload.find({ collection: 'topics', where: { slug: { equals: slug } }, limit: 1, depth: 0, ...visitor })
  return found.docs[0] ?? null
}

const guideWhere = (topicId: string, featuredIds: string[]): Where =>
  featuredIds.length ? { or: [{ topics: { in: [topicId] } }, { id: { in: featuredIds } }] } : { topics: { in: [topicId] } }

export async function loadTopicPage(payload: Payload, topic: Topic): Promise<TopicPage> {
  const featuredIds = (topic.featuredArticles ?? []).map(relId).filter((id): id is string => Boolean(id))
  const [featuredFound, guides, { totalDocs }] = await Promise.all([
    featuredIds.length ? findStories(payload, { id: { in: featuredIds } }, featuredIds.length) : Promise.resolve([]),
    findStories(payload, featuredIds.length ? { and: [{ topics: { in: [topic.id] } }, { id: { not_in: featuredIds } }] } : { topics: { in: [topic.id] } }, GUIDES_SHOWN),
    payload.count({ collection: 'articles', where: guideWhere(topic.id, featuredIds), ...visitor }),
  ])
  // Keep the editor's order for featured articles; drafts were already left out by the query.
  const byId = new Map(featuredFound.map((s) => [s.id, s]))
  const featured = featuredIds.map((id) => byId.get(id)).filter((s): s is Story => Boolean(s))
  return {
    name: topic.name,
    slug: topic.slug,
    introduction: topic.introduction?.trim() ?? '',
    seo: { title: topic.seo.title, description: topic.seo.description, noindex: Boolean(topic.seo.noindex) },
    featured,
    guides,
    guideTotal: totalDocs,
  }
}

/**
 * Automatic indexing rule: an editor-written introduction, at least MIN_GUIDES_FOR_INDEXING
 * published guides, and "noindex" not ticked. The sitemap uses the same rule.
 */
export const topicIndexable = (t: { introduction: string; guideTotal: number; noindex: boolean }) =>
  t.introduction.trim().length > 0 && t.guideTotal >= MIN_GUIDES_FOR_INDEXING && !t.noindex

/** An indexable page sets no robots rule of its own, so the site-wide pre-launch noindex still applies. */
export const topicRobots = (page: TopicPage) =>
  topicIndexable({ introduction: page.introduction, guideTotal: page.guideTotal, noindex: page.seo.noindex }) ? undefined : { index: false, follow: true }

/** Every published topic, by name. Used for links and for the sitemap. */
export async function listTopics(payload: Payload): Promise<Topic[]> {
  const found = await payload.find({ collection: 'topics', sort: 'name', limit: 0, pagination: false, depth: 0, ...visitor })
  return found.docs
}

/** Sitemap entries: published topics that pass the indexing rule. */
export async function indexableTopicPaths(payload: Payload): Promise<{ path: string; lastModified?: string }[]> {
  const entries: { path: string; lastModified?: string }[] = []
  for (const topic of await listTopics(payload)) {
    const featuredIds = (topic.featuredArticles ?? []).map(relId).filter((id): id is string => Boolean(id))
    const { totalDocs } = await payload.count({ collection: 'articles', where: guideWhere(topic.id, featuredIds), ...visitor })
    if (topicIndexable({ introduction: topic.introduction ?? '', guideTotal: totalDocs, noindex: Boolean(topic.seo?.noindex) })) {
      entries.push({ path: `/topics/${topic.slug}`, lastModified: topic.updatedAt ? new Date(topic.updatedAt).toISOString() : undefined })
    }
  }
  return entries
}

// Cached wrappers for pages. Keys include every argument; tags expire them on publish.

export const getTopic = (slug: string) =>
  unstable_cache(async () => findTopic(await getPayload({ config }), slug), ['topic', slug], { tags: TAGS, revalidate: REVALIDATE_SECONDS })()

export const getTopicPage = (topic: Topic) =>
  unstable_cache(async () => loadTopicPage(await getPayload({ config }), topic), ['topic-page', topic.id], { tags: TAGS, revalidate: REVALIDATE_SECONDS })()

/** Slugs of published topics, for links elsewhere on the site (footer). Empty if the CMS is unreachable. */
export async function getPublishedTopicSlugs(): Promise<Set<string>> {
  try {
    const slugs = await unstable_cache(async () => (await listTopics(await getPayload({ config }))).map((t) => t.slug), ['topic-slugs'], {
      tags: [TOPICS_TAG],
      revalidate: REVALIDATE_SECONDS,
    })()
    return new Set(slugs)
  } catch (error) {
    console.error('[topics] topic list could not be loaded', error instanceof Error ? error.message : error)
    return new Set()
  }
}
