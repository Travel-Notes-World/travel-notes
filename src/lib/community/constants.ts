/**
 * Shared option lists and limits for the community. Used by the CMS schema, the service layer and
 * the forms, so a value can never be valid in one place and invalid in another.
 */

type Option<T extends string> = { value: T; label: string }
const values = <T extends string>(options: readonly Option<T>[]) => options.map((o) => o.value) as T[]
export const labelOf = <T extends string>(options: readonly Option<T>[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? ''

export const CONTRIBUTION_TYPES = [
  { value: 'question', label: 'Question' },
  { value: 'trip', label: 'Trip report' },
  { value: 'activity', label: 'Activity' },
] as const
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number]['value']

/** Where each contribution type lives in the site. One canonical address per contribution. */
export const TYPE_PATH: Record<ContributionType, string> = {
  question: '/community/questions',
  trip: '/community/trips',
  activity: '/activities',
}

/**
 * Lifecycle of a contribution.
 * draft → pending → published, or changes_requested (author edits and resubmits) or rejected.
 * published → hidden (reversible) or removed (not public any more).
 */
export const CONTRIBUTION_STATES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Waiting for review' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Not accepted' },
  { value: 'hidden', label: 'Hidden by a moderator' },
  { value: 'removed', label: 'Removed' },
] as const
export type ContributionState = (typeof CONTRIBUTION_STATES)[number]['value']

export const REPLY_STATES = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Not accepted' },
  { value: 'hidden', label: 'Hidden by a moderator' },
  { value: 'removed', label: 'Removed' },
] as const
export type ReplyState = (typeof REPLY_STATES)[number]['value']

export const TRAVEL_STYLES = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid_range', label: 'Mid-range' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'backpacking', label: 'Backpacking' },
  { value: 'family', label: 'Family' },
  { value: 'adventure', label: 'Adventure and outdoors' },
  { value: 'slow', label: 'Slow travel' },
  { value: 'road_trip', label: 'Road trip' },
  { value: 'city_break', label: 'City break' },
  { value: 'food', label: 'Food and drink' },
  { value: 'business', label: 'Work trip' },
] as const

export const PARTY_TYPES = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family with children' },
  { value: 'friends', label: 'Friends' },
  { value: 'group', label: 'Organised group' },
] as const

export const COST_CATEGORIES = [
  { value: 'flights', label: 'Flights' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'transport', label: 'Local transport' },
  { value: 'food', label: 'Food and drink' },
  { value: 'activities', label: 'Activities and entry fees' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'visas', label: 'Visas and fees' },
  { value: 'other', label: 'Other' },
] as const

export const COST_SCOPES = [
  { value: 'per_person', label: 'Per person' },
  { value: 'per_party', label: 'For the whole party' },
] as const

export const COST_BASES = [
  { value: 'total', label: 'Total' },
  { value: 'per_day', label: 'Per day' },
  { value: 'per_night', label: 'Per night' },
] as const

export const COST_KINDS = [
  { value: 'measured', label: 'What I actually spent' },
  { value: 'estimate', label: 'My estimate' },
] as const

export const ACTIVITY_CATEGORIES = [
  { value: 'community_gathering', label: 'Community gathering', help: 'An informal meet-up organised by a member.' },
  { value: 'public_event', label: 'Public event', help: 'A festival, market, show or other event run by someone else.' },
  { value: 'commercial_activity', label: 'Commercial activity', help: 'A paid tour, class or experience run by a business.' },
] as const

export const ACTIVITY_FORMATS = [
  { value: 'in_person', label: 'In person' },
  { value: 'online', label: 'Online' },
] as const

export const PRICE_STATES = [
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
  { value: 'unknown', label: 'Price not known' },
] as const

export const EVENT_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'ended', label: 'Ended' },
] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]['value']

export const COMMERCIAL_DISCLOSURES = [
  { value: 'none', label: 'No commercial interest' },
  { value: 'business', label: 'I represent the organiser or business' },
  { value: 'affiliate', label: 'The link is an affiliate link' },
  { value: 'sponsored', label: 'This listing is sponsored' },
] as const

export const REPORT_CATEGORIES = [
  { value: 'spam', label: 'Spam' },
  { value: 'misleading_promotion', label: 'Misleading commercial promotion' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'privacy', label: 'Shares private information' },
  { value: 'copyright', label: 'Copyright or copied content' },
  { value: 'incorrect', label: 'Incorrect or out-of-date facts' },
  { value: 'event_problem', label: 'Problem with an event listing' },
  { value: 'other', label: 'Something else' },
] as const

export const REPORT_TARGETS = ['contribution', 'reply', 'member', 'media'] as const
export type ReportTarget = (typeof REPORT_TARGETS)[number]

export const INDEXING_CHOICES = [
  { value: 'policy', label: 'Follow the quality policy' },
  { value: 'allow', label: 'Allow search engines to index' },
  { value: 'block', label: 'Keep out of search engines' },
] as const

export const MEMBER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deleted', label: 'Deleted' },
] as const

export const MODERATION_ACTIONS = [
  'submit', 'withdraw', 'approve', 'request_changes', 'reject', 'hide', 'unhide', 'remove', 'author_remove',
  'propose_revision', 'approve_revision', 'reject_revision',
  'approve_reply', 'reject_reply', 'hide_reply', 'remove_reply', 'auto_approve_reply',
  'accept_answer', 'unaccept_answer', 'override_accepted_answer', 'mark_duplicate', 'set_indexing',
  'event_status', 'verify_organiser', 'fact_check',
  'approve_media', 'reject_media', 'remove_media',
  'resolve_report', 'dismiss_report',
  'suspend', 'unsuspend', 'set_trust', 'account_deleted',
  'accept_suggestion', 'reject_suggestion',
] as const
export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

export const NOTIFICATION_TYPES = [
  'reply_published', 'answer_accepted', 'moderation_decision', 'event_changed', 'account_notice',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const EMAIL_TEMPLATES = [
  'verify_email', 'password_reset', 'reply_published', 'answer_accepted', 'moderation_decision', 'event_changed', 'destination_digest',
] as const
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number]

/** Email categories a member can switch off. Security email cannot be switched off. */
export const EMAIL_CATEGORIES = ['replies', 'moderation', 'events', 'digest'] as const
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

export const LIMITS = {
  titleMin: 10,
  titleMax: 140,
  bodyMin: 30,
  bodyMax: 20000,
  replyMin: 10,
  replyMax: 6000,
  shortTextMax: 200,
  longTextMax: 3000,
  maxDestinations: 5,
  maxTopics: 3,
  maxLinksInBody: 6,
  maxCostLines: 30,
  maxItineraryDays: 60,
  maxStopsPerDay: 12,
  maxPhotos: 12,
  maxPlanDays: 60,
  maxPlans: 50,
  bioMax: 500,
  /** Vercel rejects request bodies over 4.5 MB, so uploads are capped below that. */
  uploadMaxBytes: 4 * 1024 * 1024,
  uploadMaxPixels: 40_000_000,
  pageSize: 20,
  replyPageSize: 30,
  searchCandidateCap: 400,
} as const

/** Handles that would be confused with site routes or staff. */
export const RESERVED_HANDLES = [
  'admin', 'administrator', 'moderator', 'moderation', 'staff', 'support', 'help', 'travelnotes', 'travel-notes',
  'editor', 'team', 'official', 'system', 'deleted', 'anonymous', 'me', 'new', 'settings', 'account', 'null', 'undefined',
]

export const optionValues = values
