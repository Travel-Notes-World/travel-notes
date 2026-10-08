import type { CollectionConfig, Field } from 'payload'

import { hiddenUnlessModerator, moderatorReadOnly, ownerOnlyPrivate } from '../../access/community'

const group = 'Community (read-only, moderate at /moderation)'
/**
 * `key` joins the member and the target, and is unique. A repeated or retried request can
 * therefore never create a second row: the database refuses it and the service treats that as done.
 */
const uniqueKey: Field = { name: 'key', type: 'text', required: true, unique: true, index: true }
const member: Field = { name: 'member', type: 'relationship', relationTo: 'members', required: true, index: true }

/** One helpful vote per member per answer or contribution. */
export const Votes: CollectionConfig = {
  slug: 'votes',
  admin: { group, hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  indexes: [{ fields: ['targetType', 'targetId'] }],
  fields: [
    uniqueKey,
    member,
    { name: 'targetType', type: 'select', required: true, options: ['contribution', 'reply'] },
    { name: 'targetId', type: 'text', required: true },
  ],
}

/** Private bookmarks of approved contributions and editorial guides. */
export const Bookmarks: CollectionConfig = {
  slug: 'bookmarks',
  admin: { group, hidden: hiddenUnlessModerator },
  access: ownerOnlyPrivate,
  fields: [
    uniqueKey,
    member,
    { name: 'targetType', type: 'select', required: true, options: ['contribution', 'article'] },
    { name: 'targetId', type: 'text', required: true },
  ],
}

/** A member following a destination. */
export const Follows: CollectionConfig = {
  slug: 'follows',
  admin: { group, hidden: hiddenUnlessModerator },
  access: ownerOnlyPrivate,
  fields: [uniqueKey, member, { name: 'destination', type: 'relationship', relationTo: 'destinations', required: true, index: true }],
}

/** Interested or Going. Not a ticket and not a guarantee of entry. Private unless the member opts in. */
export const Rsvps: CollectionConfig = {
  slug: 'rsvps',
  admin: { group, hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  fields: [
    uniqueKey,
    member,
    { name: 'activity', type: 'relationship', relationTo: 'contributions', required: true, index: true },
    { name: 'status', type: 'select', required: true, options: ['interested', 'going'] },
    { name: 'showPublicly', type: 'checkbox', defaultValue: false },
  ],
}

/**
 * Private saved trip plans. Only the owner can read or change a plan; there is no public sharing
 * in this release. A plan copied from a published itinerary is the member's own snapshot and
 * keeps a note of where it came from.
 */
export const Plans: CollectionConfig = {
  slug: 'plans',
  admin: { group, useAsTitle: 'title', hidden: hiddenUnlessModerator },
  access: ownerOnlyPrivate,
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'title', type: 'text', required: true, maxLength: 140 },
    { name: 'startDate', type: 'text', maxLength: 10 },
    { name: 'endDate', type: 'text', maxLength: 10 },
    { name: 'notes', type: 'textarea' },
    {
      name: 'days',
      type: 'array',
      fields: [
        { name: 'title', type: 'text', maxLength: 140 },
        { name: 'date', type: 'text', maxLength: 10 },
        {
          name: 'stops',
          type: 'array',
          fields: [
            { name: 'title', type: 'text', required: true, maxLength: 140 },
            { name: 'place', type: 'text', maxLength: 200 },
            { name: 'notes', type: 'textarea' },
            { name: 'savedContribution', type: 'relationship', relationTo: 'contributions' },
          ],
        },
      ],
    },
    {
      name: 'source',
      type: 'group',
      admin: { description: 'Set when the plan was copied from a published itinerary.' },
      fields: [
        { name: 'contribution', type: 'relationship', relationTo: 'contributions' },
        { name: 'title', type: 'text' },
        { name: 'authorName', type: 'text' },
        { name: 'copiedAt', type: 'date' },
      ],
    },
  ],
}
