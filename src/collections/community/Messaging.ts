import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator, isCommunityAdministrator, nobody, ownerOnlyPrivate } from '../../access/community'
import { EMAIL_TEMPLATES, NOTIFICATION_TYPES } from '../../lib/community/constants'

const group = 'Community (read-only, moderate at /moderation)'

/** In-app notifications. `dedupeKey` stops a retried job from telling someone twice. */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: { group, defaultColumns: ['type', 'recipient', 'readAt', 'createdAt'], hidden: hiddenUnlessModerator },
  access: ownerOnlyPrivate,
  indexes: [{ fields: ['recipient', 'readAt', 'createdAt'] }],
  fields: [
    { name: 'dedupeKey', type: 'text', required: true, unique: true, index: true },
    { name: 'recipient', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'type', type: 'select', required: true, options: [...NOTIFICATION_TYPES] },
    { name: 'message', type: 'text', required: true, maxLength: 300 },
    { name: 'path', type: 'text', maxLength: 300, admin: { description: 'Site address to open. Always a public or own page.' } },
    { name: 'readAt', type: 'date' },
  ],
}

/**
 * Durable email queue. A row is written in the same database transaction as the change that
 * caused it, and delivered afterwards. Failed deliveries are retried with a growing delay and stay
 * visible here. `idempotencyKey` stops a retry from queueing the same email twice.
 *
 * Administrators only: the data for security email contains one-time links.
 */
export const EmailOutbox: CollectionConfig = {
  slug: 'email-outbox',
  labels: { singular: 'Queued email', plural: 'Email queue' },
  admin: { group, defaultColumns: ['template', 'status', 'attempts', 'createdAt'], hidden: hiddenUnlessModerator },
  access: { read: isCommunityAdministrator, create: nobody, update: nobody, delete: nobody },
  indexes: [{ fields: ['status', 'nextAttemptAt'] }],
  fields: [
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    { name: 'template', type: 'select', required: true, options: [...EMAIL_TEMPLATES] },
    { name: 'recipient', type: 'relationship', relationTo: 'members', admin: { description: 'The address is read from the member at send time, so a changed or deleted address is respected.' } },
    { name: 'data', type: 'json' },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', index: true, options: ['pending', 'sent', 'captured', 'suppressed', 'failed'] },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'nextAttemptAt', type: 'date' },
    { name: 'lastError', type: 'text' },
    { name: 'transport', type: 'text', admin: { description: 'resend = sent to the provider. capture = stored for testing, not sent to anyone.' } },
    { name: 'providerId', type: 'text' },
    { name: 'sentAt', type: 'date' },
  ],
}
