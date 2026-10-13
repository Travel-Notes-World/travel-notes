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
    { name: 'value', type: 'number', required: true, defaultValue: 1, admin: { description: '1 = like (helpful), 2 = love (red heart), -1 = dislike. Posts only take likes.' } },
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
    // Set by the Trip Planner (/trip-planner), so a saved plan can open its ideas again.
    { name: 'destinations', type: 'relationship', relationTo: 'destinations', hasMany: true, maxRows: 5 },
    {
      name: 'party',
      type: 'select',
      options: [
        { value: 'solo', label: 'Solo' },
        { value: 'couple', label: 'Couple' },
        { value: 'family', label: 'Family with children' },
        { value: 'friends', label: 'Friends or group' },
      ],
    },
    {
      name: 'pace',
      type: 'select',
      options: [
        { value: 'relaxed', label: 'Relaxed' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'full', label: 'Full days' },
      ],
    },
    {
      name: 'ai',
      type: 'group',
      admin: { description: 'AI Trip Planner: when the days were filled in, and whether this plan is paid for (paid plans can be printed).' },
      fields: [
        { name: 'generatedAt', type: 'date' },
        { name: 'model', type: 'text' },
        { name: 'summary', type: 'textarea' },
        { name: 'unlocked', type: 'checkbox', defaultValue: false },
      ],
    },
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
            // Where a stop came from: the member, a Travel Notes page, or an unchecked AI idea.
            {
              name: 'origin',
              type: 'select',
              defaultValue: 'own',
              options: [
                { value: 'own', label: 'Added by the member' },
                { value: 'travel_notes', label: 'From a Travel Notes page' },
                { value: 'ai_idea', label: 'AI idea (not checked)' },
              ],
            },
            { name: 'sourcePath', type: 'text', maxLength: 300 },
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
