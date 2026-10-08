import type { CollectionConfig, Field } from 'payload'

import { hiddenUnlessModerator, moderatorOnlyField, nobody, publishedOrModerator } from '../../access/community'
import {
  ACTIVITY_CATEGORIES, ACTIVITY_FORMATS, COMMERCIAL_DISCLOSURES, CONTRIBUTION_STATES, CONTRIBUTION_TYPES, COST_BASES, COST_CATEGORIES,
  COST_KINDS, COST_SCOPES, EVENT_STATUSES, INDEXING_CHOICES, PARTY_TYPES, PRICE_STATES, TRAVEL_STYLES,
} from '../../lib/community/constants'

const opts = (list: readonly { value: string; label: string }[]) => list.map(({ value, label }) => ({ value, label }))
const onlyFor = (type: string) => ({ condition: (data: { type?: string } | undefined) => data?.type === type })

/** Date-only values (a calendar day with no time zone) are stored as text, for example "2026-10-08". */
const localDate = (name: string, description: string): Field => ({ name, type: 'text', maxLength: 10, admin: { description } })

/**
 * Member contributions: questions, trip reports and activities.
 *
 * One collection holds all three types so that moderation, revisions, search, bookmarks and
 * reports work the same way for each. Type-specific details sit in their own group.
 *
 * The row always holds the last APPROVED content. An edit to a published contribution is stored
 * as a pending row in `revisions` and copied here only when a moderator approves it.
 *
 * Nothing writes here through the API: see src/access/community.ts.
 */
export const Contributions: CollectionConfig = {
  slug: 'contributions',
  labels: { singular: 'Contribution', plural: 'Contributions' },
  admin: {
    group: 'Community (read-only, moderate at /moderation)',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'state', 'author', 'publishedAt'],
    hidden: hiddenUnlessModerator,
  },
  access: { read: publishedOrModerator, create: nobody, update: nobody, delete: nobody },
  indexes: [
    { fields: ['type', 'state', 'publishedAt'] },
    { fields: ['state', 'submittedAt'] },
    { fields: ['author', 'state'] },
    { fields: ['activity.eventStatus', 'activity.startsAt'] },
    { fields: ['activity.endsAt'] },
  ],
  fields: [
    { name: 'shortId', type: 'text', required: true, unique: true, index: true, admin: { description: 'Stable public id used in the address. Never changes.' } },
    { name: 'type', type: 'select', required: true, options: opts(CONTRIBUTION_TYPES) },
    { name: 'author', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'text', required: true, maxLength: 120, admin: { description: 'Readable part of the address. Old addresses keep working because the id decides which page opens.' } },
    { name: 'body', type: 'textarea', admin: { description: 'Plain text. HTML is never stored or rendered.' } },
    { name: 'language', type: 'text', required: true, defaultValue: 'en', maxLength: 12 },
    { name: 'destinations', type: 'relationship', relationTo: 'destinations', hasMany: true },
    { name: 'destinationTree', type: 'relationship', relationTo: 'destinations', hasMany: true, admin: { description: 'The chosen destinations plus their parents, so a country hub also lists its cities. Set automatically.' } },
    { name: 'topics', type: 'relationship', relationTo: 'topics', hasMany: true },
    { name: 'style', type: 'select', options: opts(TRAVEL_STYLES) },

    { name: 'state', type: 'select', required: true, defaultValue: 'draft', index: true, options: opts(CONTRIBUTION_STATES) },
    { name: 'submittedAt', type: 'date' },
    { name: 'publishedAt', type: 'date', index: true, admin: { description: 'First approval. Never changed to look fresh.' } },
    { name: 'contentUpdatedAt', type: 'date', admin: { description: 'Last approved change to the content.' } },
    { name: 'publishedRevision', type: 'relationship', relationTo: 'revisions' },
    { name: 'pendingRevision', type: 'relationship', relationTo: 'revisions', admin: { description: 'An edit waiting for review. The public page keeps showing the approved content.' } },
    { name: 'indexing', type: 'select', required: true, defaultValue: 'policy', options: opts(INDEXING_CHOICES), admin: { description: 'Approval and search-engine indexing are separate decisions.' } },
    {
      name: 'moderation',
      type: 'group',
      fields: [
        { name: 'note', type: 'textarea', admin: { description: 'Reason shown to the author.' } },
        { name: 'internalNote', type: 'textarea', access: { read: moderatorOnlyField }, admin: { description: 'Moderators only.' } },
        { name: 'reviewedBy', type: 'relationship', relationTo: 'staff', access: { read: moderatorOnlyField } },
        { name: 'reviewedAt', type: 'date' },
      ],
    },
    { name: 'replyCount', type: 'number', defaultValue: 0, admin: { description: 'Approved replies only.' } },
    { name: 'helpfulCount', type: 'number', defaultValue: 0 },
    { name: 'photos', type: 'relationship', relationTo: 'media', hasMany: true },
    { name: 'searchText', type: 'textarea', admin: { description: 'Plain text used for search. Set automatically from approved content.' } },

    {
      name: 'question',
      type: 'group',
      admin: onlyFor('question'),
      fields: [
        { name: 'travelMonth', type: 'text', maxLength: 7, admin: { description: 'Year and month, for example 2027-03.' } },
        { name: 'durationDays', type: 'number', min: 1, max: 730 },
        { name: 'partyType', type: 'select', options: opts(PARTY_TYPES) },
        { name: 'budgetMinor', type: 'number', min: 0, admin: { description: 'Whole number of the smallest unit of the currency (cents, yen).' } },
        { name: 'budgetCurrency', type: 'text', maxLength: 3 },
        { name: 'resolved', type: 'checkbox', defaultValue: false },
        { name: 'acceptedAnswer', type: 'relationship', relationTo: 'replies' },
        { name: 'duplicateOf', type: 'relationship', relationTo: 'contributions', admin: { description: 'Set by a moderator when an earlier thread already answers this.' } },
      ],
    },

    {
      name: 'trip',
      type: 'group',
      admin: onlyFor('trip'),
      fields: [
        localDate('startDate', 'First day of the trip, if the author gave exact dates.'),
        localDate('endDate', 'Last day of the trip.'),
        { name: 'travelMonth', type: 'text', maxLength: 7 },
        { name: 'durationDays', type: 'number', min: 1, max: 730 },
        { name: 'nights', type: 'number', min: 0, max: 730 },
        { name: 'partySize', type: 'number', min: 1, max: 100 },
        { name: 'partyType', type: 'select', options: opts(PARTY_TYPES) },
        { name: 'costScope', type: 'select', options: opts(COST_SCOPES) },
        { name: 'flightsIncluded', type: 'checkbox' },
        { name: 'costNotes', type: 'textarea', admin: { description: 'What the costs include and leave out.' } },
        { name: 'transport', type: 'textarea' },
        { name: 'recommendations', type: 'textarea' },
        { name: 'mistakes', type: 'textarea' },
        { name: 'permissionGivenAt', type: 'date', admin: { description: 'When the author confirmed this is their own first-hand account and may be published.' } },
      ],
    },
    {
      name: 'tripCosts',
      type: 'array',
      admin: onlyFor('trip'),
      fields: [
        { name: 'category', type: 'select', required: true, options: opts(COST_CATEGORIES) },
        { name: 'amountMinor', type: 'number', required: true, min: 0, admin: { description: 'Exact whole number of the smallest currency unit. Never a floating-point total.' } },
        { name: 'currency', type: 'text', required: true, maxLength: 3 },
        { name: 'basis', type: 'select', required: true, defaultValue: 'total', options: opts(COST_BASES), admin: { description: 'Whether the amount is the whole cost or a rate.' } },
        { name: 'quantity', type: 'number', required: true, defaultValue: 1, min: 1, max: 1000, admin: { description: 'Number of days or nights when the amount is a rate. 1 for a total.' } },
        localDate('date', 'Optional day the money was spent.'),
        { name: 'kind', type: 'select', required: true, defaultValue: 'measured', options: opts(COST_KINDS) },
        { name: 'note', type: 'text', maxLength: 200 },
      ],
    },
    {
      name: 'itineraryDays',
      type: 'array',
      admin: onlyFor('trip'),
      fields: [
        { name: 'title', type: 'text', maxLength: 140 },
        localDate('date', 'Optional calendar day.'),
        {
          name: 'stops',
          type: 'array',
          fields: [
            { name: 'title', type: 'text', required: true, maxLength: 140 },
            { name: 'destination', type: 'relationship', relationTo: 'destinations' },
            { name: 'place', type: 'text', maxLength: 200, admin: { description: 'A public place, for example a museum or market.' } },
            { name: 'timeNote', type: 'text', maxLength: 200 },
            { name: 'costMinor', type: 'number', min: 0 },
            { name: 'costCurrency', type: 'text', maxLength: 3 },
            { name: 'description', type: 'textarea' },
          ],
        },
      ],
    },

    {
      name: 'activity',
      type: 'group',
      admin: onlyFor('activity'),
      fields: [
        { name: 'category', type: 'select', options: ACTIVITY_CATEGORIES.map(({ value, label }) => ({ value, label })) },
        { name: 'format', type: 'select', options: opts(ACTIVITY_FORMATS) },
        { name: 'venueName', type: 'text', maxLength: 200 },
        { name: 'venueAddress', type: 'text', maxLength: 300 },
        { name: 'timeZone', type: 'text', maxLength: 64, admin: { description: 'IANA time zone of the venue, for example Asia/Bangkok.' } },
        { name: 'allDay', type: 'checkbox', defaultValue: false },
        { name: 'startsAt', type: 'date', admin: { description: 'Start instant in UTC.', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endsAt', type: 'date', admin: { description: 'End instant in UTC. For all-day events, the end of the last local day.', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'startLocal', type: 'text', maxLength: 16, admin: { description: 'What the organiser entered, in venue time: 2026-11-01T18:30, or 2026-11-01 for all-day.' } },
        { name: 'endLocal', type: 'text', maxLength: 16 },
        { name: 'originalStartLocal', type: 'text', maxLength: 16, admin: { description: 'Kept when an event is rescheduled.' } },
        { name: 'eventStatus', type: 'select', defaultValue: 'scheduled', options: opts(EVENT_STATUSES) },
        { name: 'statusNote', type: 'text', maxLength: 300 },
        { name: 'statusChangedAt', type: 'date' },
        { name: 'priceState', type: 'select', options: opts(PRICE_STATES) },
        { name: 'priceMinor', type: 'number', min: 0 },
        { name: 'priceCurrency', type: 'text', maxLength: 3 },
        { name: 'bookingUrl', type: 'text', maxLength: 500 },
        { name: 'sourceUrl', type: 'text', maxLength: 500, admin: { description: 'Where the details can be checked.' } },
        { name: 'organiserName', type: 'text', maxLength: 140 },
        // Never sent to the public: readable by moderators only, and left out of every public page.
        { name: 'organiserContact', type: 'text', maxLength: 200, access: { read: moderatorOnlyField }, admin: { description: 'Private contact for verification. Moderators only.' } },
        { name: 'organiserVerified', type: 'checkbox', defaultValue: false, admin: { description: 'A moderator confirmed the organiser. Separate from sponsorship or affiliation.' } },
        { name: 'disclosure', type: 'select', defaultValue: 'none', options: opts(COMMERCIAL_DISCLOSURES) },
        { name: 'audience', type: 'text', maxLength: 200 },
        { name: 'accessibility', type: 'textarea' },
        { name: 'capacity', type: 'number', min: 1, max: 100000 },
        { name: 'lastCheckedAt', type: 'date', admin: { description: 'When a moderator last checked the facts. Different from the date it was posted.' } },
        { name: 'interestedCount', type: 'number', defaultValue: 0 },
        { name: 'goingCount', type: 'number', defaultValue: 0 },
      ],
    },
  ],
}
