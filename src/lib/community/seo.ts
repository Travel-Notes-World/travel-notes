import { siteUrl } from '../site'
import { ACTIVITY_CATEGORIES } from './constants'
import type { Card, Detail } from './queries'
import type { ReplyView } from './replies'
import type { Settings } from './settings'
import type { PublicProfile } from './members'

/**
 * Indexing rules (brief §14). Approval makes a page public; these rules decide separately whether
 * search engines may index it. Nothing here is access control: private pages are protected by
 * sign-in, not by "noindex".
 *
 * The whole site also stays noindex until launch (NEXT_PUBLIC_INDEXABLE in the site layout).
 */
export const siteIndexable = (): boolean => process.env.NEXT_PUBLIC_INDEXABLE === 'true'

export type IndexDecision = { index: boolean; reason: string }

export function contributionIndexing(post: Pick<Detail, 'type' | 'indexing' | 'replyCount'> & { questionDetail?: Detail['questionDetail'] }, settings: Settings): IndexDecision {
  if (post.indexing === 'block') return { index: false, reason: 'A moderator kept this page out of search engines.' }
  if (post.indexing === 'allow') return { index: true, reason: 'An administrator allowed indexing.' }
  if (post.type === 'question') {
    // A linked duplicate points readers to the fuller thread, so it is not indexed on its own.
    if (post.questionDetail?.duplicateOf) return { index: false, reason: 'Linked to an earlier thread that answers it.' }
    if (!settings.questionsAuto) return { index: false, reason: 'Questions need an administrator decision before indexing.' }
    return post.replyCount >= settings.questionMinAnswers
      ? { index: true, reason: `Has at least ${settings.questionMinAnswers} approved answer(s).` }
      : { index: false, reason: 'No approved answer yet.' }
  }
  // Trip reports and activities are indexed only after an eligibility review ("allow").
  return { index: false, reason: 'Waiting for an eligibility review by an administrator.' }
}

export const profileIndexing = (profile: Pick<PublicProfile, 'publishedCount' | 'answerCount'>, settings: Settings): IndexDecision =>
  profile.publishedCount + profile.answerCount >= settings.profileMinPublished
    ? { index: true, reason: 'Has enough approved contributions.' }
    : { index: false, reason: 'Not enough approved contributions yet.' }

/** A hub is indexable only when an administrator ticked it AND it currently has approved content. */
export const hubIndexing = (hub: { hubIndexable: boolean }, counts: { questions: number; trips: number; activities: number }): IndexDecision =>
  hub.hubIndexable && counts.questions + counts.trips + counts.activities > 0
    ? { index: true, reason: 'Reviewed by an administrator and has approved content.' }
    : { index: false, reason: hub.hubIndexable ? 'No approved content at the moment.' : 'Not reviewed for indexing yet.' }

export const robotsFor = (decision: IndexDecision) => (decision.index ? undefined : { index: false, follow: true })

const abs = (path: string) => `${siteUrl}${path}`
const person = (author: Card['author']) => ({ '@type': 'Person', name: author.displayName, ...(author.hasProfile && author.handle ? { url: abs(`/travellers/${author.handle}`) } : {}) })

/**
 * Structured data. Every value is taken from what is visible on the page. Counts are the real
 * numbers of approved answers and helpful marks; nothing is rounded up or invented.
 */
export function questionJsonLd(post: Detail, answers: ReplyView[]): Record<string, unknown> | null {
  // QAPage needs at least one answer. Without one the page carries no question markup at all.
  if (!answers.length) return null
  const answer = (a: ReplyView) => ({
    '@type': 'Answer', text: a.body, url: abs(`${post.path}#reply-${a.id}`), datePublished: a.publishedAt, upvoteCount: a.helpfulCount, author: person(a.author),
  })
  const accepted = answers.find((a) => a.accepted)
  const others = answers.filter((a) => !a.accepted)
  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question', name: post.title, text: post.body, answerCount: post.replyCount, datePublished: post.publishedAt, author: person(post.author),
      ...(accepted ? { acceptedAnswer: answer(accepted) } : {}),
      ...(others.length ? { suggestedAnswer: others.map(answer) } : {}),
    },
  }
}

export function tripJsonLd(post: Detail, comments: ReplyView[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: post.title, text: post.body, url: abs(post.path), datePublished: post.publishedAt, ...(post.updatedAt && post.updatedAt !== post.publishedAt ? { dateModified: post.updatedAt } : {}),
    author: person(post.author),
    ...(post.photos.length ? { image: post.photos.map((p) => abs(p.url)) } : {}),
    interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: post.replyCount },
    ...(comments.length ? { comment: comments.map((c) => ({ '@type': 'Comment', text: c.body, datePublished: c.publishedAt, author: person(c.author), url: abs(`${post.path}#reply-${c.id}`) })) } : {}),
  }
}

const EVENT_STATUS: Record<string, string> = {
  scheduled: 'https://schema.org/EventScheduled', ended: 'https://schema.org/EventScheduled', rescheduled: 'https://schema.org/EventRescheduled',
  postponed: 'https://schema.org/EventPostponed', cancelled: 'https://schema.org/EventCancelled',
}

/** Offset text such as "+07:00" for an instant in a zone, so the start time is unambiguous. */
function isoInZone(local: string, instant: string | null, allDay: boolean): string {
  if (allDay || !instant) return local.slice(0, 10)
  const minutes = Math.round((Date.parse(`${local}:00Z`) - Date.parse(instant)) / 60_000)
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${local}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/**
 * Event markup, only for a listing that really is a dated event with a place or an online format.
 * A general activity with no date gets none. Travel Notes is never named as the organiser.
 */
export function eventJsonLd(post: Detail): Record<string, unknown> | null {
  const a = post.activity
  if (!a || !a.startLocal || !a.timeZone) return null
  const online = a.format === 'online'
  if (!online && !a.venueName && !a.venueAddress) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: post.title, description: post.body, url: abs(post.path),
    startDate: isoInZone(a.startLocal, a.startsAt, a.allDay),
    ...(a.endLocal ? { endDate: isoInZone(a.endLocal, a.allDay ? null : a.endsAt, a.allDay) } : {}),
    ...(a.status === 'rescheduled' && a.originalStartLocal ? { previousStartDate: a.originalStartLocal.slice(0, a.allDay ? 10 : 16) } : {}),
    eventStatus: EVENT_STATUS[a.status] ?? EVENT_STATUS.scheduled,
    eventAttendanceMode: online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: online
      ? { '@type': 'VirtualLocation', url: a.bookingUrl ?? a.sourceUrl ?? abs(post.path) }
      : { '@type': 'Place', name: a.venueName || a.venueAddress, ...(a.venueAddress ? { address: a.venueAddress } : {}) },
    ...(a.organiserName ? { organizer: { '@type': 'Organization', name: a.organiserName } } : {}),
    ...(post.photos.length ? { image: post.photos.map((p) => abs(p.url)) } : {}),
    ...(a.priceState === 'free' ? { isAccessibleForFree: true } : {}),
    ...(a.priceState === 'paid' && a.priceMinor !== null && a.priceCurrency && a.bookingUrl
      ? { offers: { '@type': 'Offer', url: a.bookingUrl, priceCurrency: a.priceCurrency, price: (a.priceMinor / 10 ** new Intl.NumberFormat('en', { style: 'currency', currency: a.priceCurrency }).resolvedOptions().maximumFractionDigits!).toFixed(new Intl.NumberFormat('en', { style: 'currency', currency: a.priceCurrency }).resolvedOptions().maximumFractionDigits!) } }
      : {}),
  }
}

export function profileJsonLd(profile: PublicProfile): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: abs(`/travellers/${profile.handle}`),
    dateCreated: profile.memberSince,
    mainEntity: { '@type': 'Person', name: profile.displayName, alternateName: profile.handle, url: abs(`/travellers/${profile.handle}`), ...(profile.bio ? { description: profile.bio } : {}) },
  }
}

export const breadcrumbJsonLd = (crumbs: { label: string; href?: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.href ? { item: abs(c.href) } : {}) })),
})

/** Serialise JSON-LD so that text typed by a member can never close the script tag. */
export const jsonLdScript = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export const activityCategoryLabel = (value: string | null) => ACTIVITY_CATEGORIES.find((c) => c.value === value)?.label ?? 'Activity'
