import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator, moderatorReadOnly } from '../../access/community'
import { MODERATION_ACTIONS, REPORT_CATEGORIES, REPORT_TARGETS } from '../../lib/community/constants'

const group = 'Community (read-only, moderate at /moderation)'

/**
 * Immutable content snapshots. One is written every time a member submits a contribution for
 * review, including an edit to something already published. The snapshot itself is never changed;
 * only the review outcome is recorded on it.
 */
export const Revisions: CollectionConfig = {
  slug: 'revisions',
  admin: { group, defaultColumns: ['contribution', 'number', 'kind', 'reviewState', 'createdAt'], hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  indexes: [{ fields: ['contribution', 'number'], unique: true }, { fields: ['reviewState', 'createdAt'] }],
  fields: [
    { name: 'contribution', type: 'relationship', relationTo: 'contributions', required: true, index: true },
    { name: 'number', type: 'number', required: true },
    { name: 'kind', type: 'select', required: true, options: ['submission', 'edit'] },
    { name: 'editor', type: 'relationship', relationTo: 'members', required: true },
    { name: 'snapshot', type: 'json', required: true, admin: { description: 'The content exactly as the member submitted it.' } },
    { name: 'reviewState', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'approved', 'changes_requested', 'rejected', 'superseded'] },
    { name: 'reason', type: 'textarea' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'staff' },
    { name: 'reviewedAt', type: 'date' },
  ],
}

/** Member reports about content or accounts. */
export const Reports: CollectionConfig = {
  slug: 'reports',
  admin: { group, defaultColumns: ['category', 'targetType', 'status', 'createdAt'], hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['targetType', 'targetId'] }],
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true, admin: { description: 'One open report per member per item.' } },
    { name: 'reporter', type: 'relationship', relationTo: 'members', required: true },
    { name: 'targetType', type: 'select', required: true, options: [...REPORT_TARGETS] },
    { name: 'targetId', type: 'text', required: true },
    { name: 'contribution', type: 'relationship', relationTo: 'contributions', admin: { description: 'The page the report belongs to, for quick review.' } },
    { name: 'category', type: 'select', required: true, options: REPORT_CATEGORIES.map(({ value, label }) => ({ value, label })) },
    { name: 'details', type: 'textarea' },
    { name: 'status', type: 'select', required: true, defaultValue: 'open', index: true, options: ['open', 'resolved', 'dismissed'] },
    { name: 'resolution', type: 'textarea' },
    { name: 'resolvedBy', type: 'relationship', relationTo: 'staff' },
    { name: 'resolvedAt', type: 'date' },
  ],
}

/**
 * Audit record. One row for every moderation decision and every lifecycle change, with who did
 * it, to what, why and when. Rows are only ever added.
 */
export const ModerationActions: CollectionConfig = {
  slug: 'moderation-actions',
  labels: { singular: 'Audit record', plural: 'Audit records' },
  admin: { group, defaultColumns: ['action', 'targetType', 'actorType', 'createdAt'], hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  indexes: [{ fields: ['targetType', 'targetId', 'createdAt'] }],
  fields: [
    { name: 'action', type: 'select', required: true, index: true, options: [...MODERATION_ACTIONS] },
    { name: 'actorType', type: 'select', required: true, options: ['staff', 'member', 'system'] },
    { name: 'staff', type: 'relationship', relationTo: 'staff' },
    { name: 'member', type: 'relationship', relationTo: 'members' },
    { name: 'targetType', type: 'select', required: true, options: ['contribution', 'reply', 'revision', 'member', 'media', 'report', 'suggestion'] },
    { name: 'targetId', type: 'text', required: true },
    { name: 'contribution', type: 'relationship', relationTo: 'contributions' },
    { name: 'reason', type: 'textarea' },
    { name: 'details', type: 'json' },
  ],
}

/** A member asking for a place that is not in the destination list. Never published automatically. */
export const DestinationSuggestions: CollectionConfig = {
  slug: 'destination-suggestions',
  admin: { group, useAsTitle: 'name', defaultColumns: ['name', 'country', 'status', 'createdAt'], hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  indexes: [{ fields: ['status', 'createdAt'] }],
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', required: true },
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    { name: 'country', type: 'text', required: true, maxLength: 120 },
    { name: 'details', type: 'textarea' },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'accepted', 'rejected'] },
    { name: 'destination', type: 'relationship', relationTo: 'destinations', admin: { description: 'The destination record created or matched by a moderator.' } },
    { name: 'resolution', type: 'textarea' },
  ],
}
