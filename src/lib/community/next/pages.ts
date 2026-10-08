import 'server-only'

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'

import type { ContributionType } from '../constants'
import { memberStateFor, type MemberState } from '../engagement'
import { getPublished, type Detail } from '../queries'
import { listReplies, ownUnpublishedReplies, type ReplyView } from '../replies'
import { contributionIndexing, robotsFor, type IndexDecision } from '../seo'
import { canViewCommunity, getSettings, type Settings } from '../settings'
import { excerpt, shortIdFromSegment } from '../text'
import type { Page } from '../types'
import { getViewer, type Viewer } from './session'

export type PostPage = {
  post: Detail
  viewer: Viewer
  state: MemberState | null
  replies: Page<ReplyView>
  ownPending: Awaited<ReturnType<typeof ownUnpublishedReplies>>
  settings: Settings
  indexing: IndexDecision
  /** The page's own address, used as the return target for forms. */
  returnTo: string
}

/**
 * Everything a public post page needs, with the rules every post page must follow:
 * - only an approved post of the right type opens (anything else is "not found");
 * - an old or wrong slug in the address redirects permanently to the canonical address;
 * - while the community is closed, only signed-in staff can see it;
 * - the visitor's own state (bookmarks, votes) is loaded only for a signed-in member.
 */
export async function loadPostPage(type: ContributionType, key: string, answersPage = 1): Promise<PostPage | { closed: true }> {
  const viewer = await getViewer()
  if (!(await canViewCommunity(viewer.staff))) return { closed: true }
  const post = await getPublished(shortIdFromSegment(key))
  if (!post || post.type !== type) notFound()
  const canonicalKey = post.path.split('/').pop()
  if (decodeURIComponent(key) !== canonicalKey) permanentRedirect(post.path)
  const settings = await getSettings()
  const replies = await listReplies(post.id, { page: answersPage, acceptedId: post.questionDetail?.acceptedAnswerId ?? null })
  const state = viewer.member ? await memberStateFor(viewer.member, { id: post.id, authorId: post.authorId }, replies.items.flatMap((r) => [r.id, ...r.children.map((c) => c.id)])) : null
  const ownPending = viewer.member ? await ownUnpublishedReplies(viewer.member, post.id) : []
  return { post, viewer, state, replies, ownPending, settings, indexing: contributionIndexing(post, settings), returnTo: post.path }
}

/** Search metadata for a post page: title, description, canonical address and the robots rule. */
export async function postMetadata(type: ContributionType, key: string, suffix: string): Promise<Metadata> {
  const viewer = await getViewer()
  if (!(await canViewCommunity(viewer.staff))) return { title: 'Community', robots: { index: false, follow: false } }
  const post = await getPublished(shortIdFromSegment(key))
  if (!post || post.type !== type) return {}
  const settings = await getSettings()
  const description = excerpt(post.body, 155) || `${suffix} on Travel Notes`
  return {
    title: `${post.title} – ${suffix}`,
    description,
    alternates: { canonical: post.path },
    robots: robotsFor(contributionIndexing(post, settings)),
    openGraph: { type: 'article', title: post.title, description, url: post.path, ...(post.photos[0] ? { images: [{ url: post.photos[0].cardUrl, alt: post.photos[0].alt }] } : {}) },
  }
}
