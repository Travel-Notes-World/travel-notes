import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { articles as sampleArticles, type CommonsImage, type Day } from '@/content/sample'
import type { Article as CmsArticle, Author, Destination } from '@/payload-types'

import { ARTICLE_TYPES } from '@/collections/Articles'
import { ARTICLES_TAG, articleTag } from './revalidate'

/** Fallback regeneration for article data (implementation plan §3: articles 60 minutes). */
const ARTICLE_REVALIDATE_SECONDS = 60 * 60
const DEFAULT_ACCENT = '#2e4a50'
const DEFAULT_TONE = 'linear-gradient(135deg,#8fa9a6,#4e6f74 55%,#2e4a50)'
const WORDS_PER_MINUTE = 220

export type StoryHeading = { id: string; title: string }
export type StoryBody =
  | { kind: 'sections'; sections: { heading: string; paragraphs: string[] }[] }
  | { kind: 'rich'; data: NonNullable<CmsArticle['body']>; headings: StoryHeading[] }

/** One shape for the article template, whether the content comes from the CMS or from the sample file. */
export type Story = {
  slug: string
  type: string
  title: string
  deck: string
  excerpt: string
  author: { name: string; slug: string }
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
  image?: CommonsImage
  body: StoryBody
  days?: Day[]
  seo?: { title: string; description: string; noindex: boolean }
  /** True for placeholder content from src/content/sample.ts. */
  isSample: boolean
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
    slug: doc.slug,
    type: typeLabel(doc.type),
    title: doc.title,
    deck: doc.deck,
    excerpt: doc.excerpt,
    author: { name: author.name, slug: author.slug },
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
    body: { kind: 'rich', data, headings },
    days: doc.type === 'itinerary' && doc.days?.length
      ? doc.days.map((d, i) => ({
          number: i + 1,
          title: d.title,
          stops: (d.stops ?? []).map((s) => ({ time: s.time ?? '', name: s.name, note: s.note ?? '' })),
        }))
      : undefined,
    seo: { title: doc.seo.title, description: doc.seo.description, noindex: Boolean(doc.seo.noindex) },
    isSample: false,
  }
}

function fromSample(a: (typeof sampleArticles)[number]): Story {
  return {
    slug: a.slug,
    type: a.type,
    title: a.title,
    deck: a.deck,
    excerpt: a.excerpt,
    author: a.author,
    readMinutes: a.readMinutes,
    firstPublished: a.firstPublished,
    updated: a.updated,
    destination: { name: a.destination.name, path: a.destination.path.join('/') },
    accent: a.accent,
    disclosure: a.sponsoredBy ? 'sponsored' : 'none',
    sponsoredBy: a.sponsoredBy,
    showAds: true,
    takeaways: a.takeaways,
    heroAlt: a.heroAlt,
    heroTone: a.heroTone,
    image: a.image,
    body: { kind: 'sections', sections: a.body },
    days: a.days,
    isSample: true,
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
    ['article-by-slug', slug],
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
    ['articles-latest', String(limit)],
    { tags: [ARTICLES_TAG], revalidate: ARTICLE_REVALIDATE_SECONDS },
  )()

const logReadFailure = (label: string, error: unknown) =>
  console.error(`[content] ${label} failed.`, error instanceof Error ? error.message : error)

/**
 * A published CMS article wins. Sample content only fills slugs the CMS does not have.
 * If the CMS cannot be reached, a sample slug still renders, but any other slug raises an error
 * instead of a "not found": an outage must never be cached as a missing page.
 */
export async function getStory(slug: string): Promise<Story | null> {
  const sample = sampleArticles.find((a) => a.slug === slug)
  let doc: CmsArticle | null = null
  try {
    doc = await findPublishedBySlug(slug)
  } catch (error) {
    logReadFailure(`article "${slug}"`, error)
    if (!sample) throw error
  }
  const story = doc ? fromCms(doc) : null
  if (story) return story
  return sample ? fromSample(sample) : null
}

/** Newest published CMS articles first, then sample articles until real content replaces them. */
export async function getLatestStories(limit = 12): Promise<Story[]> {
  // Listings stay available during a CMS outage by showing what can still be shown.
  let docs: CmsArticle[] = []
  try {
    docs = await findLatestPublished(limit)
  } catch (error) {
    logReadFailure('latest articles', error)
  }
  const cms = docs.map(fromCms).filter((s): s is Story => s !== null)
  const taken = new Set(cms.map((s) => s.slug))
  const samples = sampleArticles.filter((a) => !taken.has(a.slug)).map(fromSample)
  return [...cms, ...samples].slice(0, limit)
}

export const sampleStorySlugs = () => sampleArticles.map((a) => a.slug)
