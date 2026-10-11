import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import type { Article as CmsArticle, Author, Destination, Image } from '@/payload-types'

import { ARTICLE_TYPES } from '@/collections/Articles'
import { type Photo, photosByIds, toPhoto } from './photos'
import { ARTICLES_TAG, articleTag, AUTHORS_TAG } from './revalidate'

/** Fallback regeneration for article data (implementation plan §3: articles 60 minutes). */
const ARTICLE_REVALIDATE_SECONDS = 60 * 60
const DEFAULT_ACCENT = '#2e4a50'
const DEFAULT_TONE = 'linear-gradient(135deg,#8fa9a6,#4e6f74 55%,#2e4a50)'
const WORDS_PER_MINUTE = 220

export type StoryHeading = { id: string; title: string }
export type StoryBody = { kind: 'rich'; data: NonNullable<CmsArticle['body']>; headings: StoryHeading[] }
export type Stop = { time: string; name: string; note: string }
export type Day = { number: number; title: string; stops: Stop[] }

/** One shape for the article template and the article cards. */
export type Story = {
  id: string
  slug: string
  type: string
  title: string
  deck: string
  excerpt: string
  author: { id: string; name: string; slug: string; biography: string; photo?: Photo | null }
  readMinutes: number
  firstPublished: string
  updated: string
  destination?: { name: string; path: string }
  accent: string
  disclosure: 'none' | 'affiliate' | 'sponsored'
  sponsoredBy?: string
  showAds: boolean
  takeaways: string[]
  heroAlt: string
  heroTone: string
  /** The main photo from Editorial photos, if the guide has one. */
  photo: Photo | null
  /** Last time prices, transport and opening details were checked (editor-set). */
  reviewedAt: string | null
  sources: { name: string; url: string; note: string | null }[]
  /** Published corrections, newest first. */
  corrections: { date: string; text: string }[]
  featured: boolean
  /** Ids used to find related guides. */
  destinationIds: string[]
  topicIds: string[]
  body: StoryBody
  days?: Day[]
  seo?: { title: string; description: string; noindex: boolean }
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lexical nodes are loosely typed JSON
type LexicalNode = any

const nodeText = (node: LexicalNode): string =>
  typeof node?.text === 'string' ? node.text : Array.isArray(node?.children) ? node.children.map(nodeText).join('') : ''

/**
 * Give every h2 in the body a stable, unique anchor id so the "Jump to a section" list can link to it.
 * Returns a copy of the editor data with `anchorId` set on those headings.
 */
function prepareRichBody(data: NonNullable<CmsArticle['body']>): { data: NonNullable<CmsArticle['body']>; headings: StoryHeading[]; words: number } {
  const copy = structuredClone(data)
  const headings: StoryHeading[] = []
  const used = new Map<string, number>()
  let words = 0
  for (const node of (copy.root?.children ?? []) as LexicalNode[]) {
    const text = nodeText(node).trim()
    words += text ? text.split(/\s+/).length : 0
    // An h1 in the body is rendered as an h2, because the page title is the only h1.
    if (node.type === 'heading' && (node.tag === 'h2' || node.tag === 'h1') && text) {
      const base = slugify(text) || 'section'
      const count = used.get(base) ?? 0
      used.set(base, count + 1)
      const id = count === 0 ? base : `${base}-${count + 1}`
      node.anchorId = id
      headings.push({ id, title: text })
    }
  }
  return { data: copy, headings, words }
}

const relId = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : null

const typeLabel = (value: string) => ARTICLE_TYPES.find((t) => t.value === value)?.label ?? value
const populated = <T extends { id: string }>(value: string | T | null | undefined): T | undefined =>
  value && typeof value === 'object' ? value : undefined

function fromCms(doc: CmsArticle): Story | null {
  const author = populated<Author>(doc.primaryAuthor)
  if (!doc.body || !author) return null
  const destination = populated<Destination>(doc.primaryDestination)
  const { data, headings, words } = prepareRichBody(doc.body)
  const firstPublished = doc.firstPublishedAt ?? doc.createdAt
  const kind = doc.disclosure?.kind ?? 'none'
  return {
    id: doc.id,
    slug: doc.slug,
    type: typeLabel(doc.type),
    title: doc.title,
    deck: doc.deck,
    excerpt: doc.excerpt,
    author: { id: author.id, name: author.name, slug: author.slug, biography: author.biography },
    readMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    firstPublished,
    // Only an editor-set date counts as "updated"; saving a typo fix does not change it.
    updated: doc.editorialUpdatedAt ?? firstPublished,
    destination: destination?.path ? { name: destination.name, path: destination.path } : undefined,
    accent: destination?.accentColour || DEFAULT_ACCENT,
    disclosure: kind,
    sponsoredBy: kind === 'sponsored' ? doc.disclosure?.sponsorName ?? undefined : undefined,
    showAds: doc.adPolicy !== 'none',
    takeaways: (doc.takeaways ?? []).map((t) => t.text),
    heroAlt: '',
    heroTone: DEFAULT_TONE,
    photo: toPhoto(populated<Image>(doc.heroImage)),
    reviewedAt: doc.reviewedAt ?? null,
    sources: (doc.sources ?? []).filter((x) => x.name && x.url).map((x) => ({ name: x.name.trim(), url: x.url.trim(), note: x.note?.trim() || null })),
    corrections: (doc.corrections ?? [])
      .filter((c) => c.date && c.text?.trim())
      .map((c) => ({ date: c.date, text: c.text.trim() }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    featured: Boolean(doc.featured),
    destinationIds: [relId(doc.primaryDestination), ...(doc.additionalDestinations ?? []).map(relId)].filter((id): id is string => Boolean(id)),
    topicIds: (doc.topics ?? []).map(relId).filter((id): id is string => Boolean(id)),
    body: { kind: 'rich', data, headings },
    days: doc.type === 'itinerary' && doc.days?.length
      ? doc.days.map((d, i) => ({
          number: i + 1,
          title: d.title,
          stops: (d.stops ?? []).map((s) => ({ time: s.time ?? '', name: s.name, note: s.note ?? '' })),
        }))
      : undefined,
    seo: { title: doc.seo.title, description: doc.seo.description, noindex: Boolean(doc.seo.noindex) },
  }
}

/**
 * Published-only reads. `overrideAccess: false` with no user means these queries run with a
 * reader's permissions: drafts, version history and staff fields can never be returned.
 */
const findPublishedBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<CmsArticle | null> => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'articles',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 1,
        draft: false,
        overrideAccess: false,
      })
      return result.docs[0] ?? null
    },
    ['article-by-slug-v2', slug],
    { tags: [articleTag(slug), ARTICLES_TAG], revalidate: ARTICLE_REVALIDATE_SECONDS },
  )()

const findLatestPublished = (limit: number) =>
  unstable_cache(
    async (): Promise<CmsArticle[]> => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'articles',
        sort: '-firstPublishedAt',
        limit,
        depth: 1,
        draft: false,
        overrideAccess: false,
      })
      return result.docs
    },
    ['articles-latest-v2', String(limit)],
    { tags: [ARTICLES_TAG], revalidate: ARTICLE_REVALIDATE_SECONDS },
  )()

const findPublishedByAuthor = (authorId: string, limit: number) =>
  unstable_cache(
    async (): Promise<CmsArticle[]> => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'articles',
        where: { or: [{ primaryAuthor: { equals: authorId } }, { coauthors: { in: [authorId] } }] },
        sort: '-firstPublishedAt',
        limit,
        depth: 1,
        draft: false,
        overrideAccess: false,
      })
      return result.docs
    },
    ['articles-by-author-v2', authorId, String(limit)],
    { tags: [ARTICLES_TAG], revalidate: ARTICLE_REVALIDATE_SECONDS },
  )()

const logReadFailure = (label: string, error: unknown) =>
  console.error(`[content] ${label} failed.`, error instanceof Error ? error.message : error)

/**
 * A published article by its address. If the CMS cannot be reached the error is raised instead of
 * returning "not found": an outage must never be cached as a missing page.
 */
export async function getStory(slug: string): Promise<Story | null> {
  let doc: CmsArticle | null
  try {
    doc = await findPublishedBySlug(slug)
  } catch (error) {
    logReadFailure(`article "${slug}"`, error)
    throw error
  }
  const story = doc ? fromCms(doc) : null
  if (story) {
    // The author's photo sits one level deeper than the article query loads, so it is looked up here.
    const author = populated<Author>(doc!.primaryAuthor)
    const photoId = relId(author?.photo)
    if (photoId) story.author.photo = (await getPhotos([photoId])).get(photoId) ?? null
  }
  return story
}

const getPhotos = (ids: string[]) =>
  unstable_cache(async () => [...(await photosByIds(await getPayload({ config }), ids)).entries()], ['photos', ...ids], {
    tags: [ARTICLES_TAG, AUTHORS_TAG],
    revalidate: ARTICLE_REVALIDATE_SECONDS,
  })().then((entries) => new Map(entries))

/**
 * Guides related to this one: same destination first, then same topic, newest first; topped up
 * with the newest guides when there are not enough. Never the guide itself.
 */
export async function getRelatedStories(story: Pick<Story, 'id' | 'destinationIds' | 'topicIds'>, count = 3): Promise<Story[]> {
  const docs = await findRelated(story.id, story.destinationIds, story.topicIds, count)
  return docs.map(fromCms).filter((s): s is Story => s !== null)
}

const findRelated = (id: string, destinationIds: string[], topicIds: string[], count: number) =>
  unstable_cache(
    async (): Promise<CmsArticle[]> => {
      const payload = await getPayload({ config })
      return relatedDocs(payload, id, destinationIds, topicIds, count)
    },
    ['articles-related', id, destinationIds.join(','), topicIds.join(','), String(count)],
    { tags: [ARTICLES_TAG], revalidate: ARTICLE_REVALIDATE_SECONDS },
  )()

/** The query behind {@link getRelatedStories}, separate so tests can call it without the cache. */
export async function relatedDocs(payload: Payload, id: string, destinationIds: string[], topicIds: string[], count: number): Promise<CmsArticle[]> {
  const read = { sort: '-firstPublishedAt', depth: 1, draft: false, overrideAccess: false } as const
  const out: CmsArticle[] = []
  const seen = new Set([id])
  const add = (docs: CmsArticle[]) => {
    for (const d of docs) {
      if (seen.has(d.id) || out.length >= count) continue
      seen.add(d.id)
      out.push(d)
    }
  }
  if (destinationIds.length) {
    add((await payload.find({ collection: 'articles', ...read, limit: count + 1, where: { or: [{ primaryDestination: { in: destinationIds } }, { additionalDestinations: { in: destinationIds } }] } })).docs)
  }
  if (out.length < count && topicIds.length) {
    add((await payload.find({ collection: 'articles', ...read, limit: count + out.length + 1, where: { topics: { in: topicIds } } })).docs)
  }
  if (out.length < count) add((await payload.find({ collection: 'articles', ...read, limit: count + out.length + 1 })).docs)
  return out
}

/** The newest published articles. Listings stay up during a CMS outage, showing nothing rather than failing. */
export async function getLatestStories(limit = 12): Promise<Story[]> {
  let docs: CmsArticle[] = []
  try {
    docs = await findLatestPublished(limit)
  } catch (error) {
    logReadFailure('latest articles', error)
  }
  return docs.map(fromCms).filter((s): s is Story => s !== null)
}

/** Published articles where this author is the primary author or a coauthor, newest first. */
export async function getStoriesByAuthor(authorId: string, limit = 24): Promise<Story[]> {
  const docs = await findPublishedByAuthor(authorId, limit)
  return docs.map(fromCms).filter((s): s is Story => s !== null)
}

/** Published articles matching `where`, newest first, read with a visitor's permissions so drafts never appear. */
export async function findStories(payload: Payload, where: Where, limit: number): Promise<Story[]> {
  const result = await payload.find({ collection: 'articles', where, sort: '-firstPublishedAt', limit, depth: 1, draft: false, overrideAccess: false })
  return result.docs.map(fromCms).filter((s): s is Story => s !== null)
}

/** Published guides about any of these destinations (as the main or an additional destination). */
export async function findStoriesForDestinations(payload: Payload, destinationIds: string[], limit: number): Promise<Story[]> {
  if (!destinationIds.length) return []
  return findStories(payload, { or: [{ primaryDestination: { in: destinationIds } }, { additionalDestinations: { in: destinationIds } }] }, limit)
}
