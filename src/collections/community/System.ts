import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator, isCommunityAdministrator, moderatorReadOnly, nobody } from '../../access/community'

const group = 'Community (read-only, moderate at /moderation)'

/** Shared counters for rate limits, so limits hold across serverless instances. */
export const RateLimits: CollectionConfig = {
  slug: 'rate-limits',
  admin: { group, hidden: true },
  access: { read: isCommunityAdministrator, create: nobody, update: nobody, delete: nobody },
  timestamps: false,
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'count', type: 'number', required: true, defaultValue: 0 },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}

/**
 * Daily totals for the owner dashboard. No member id, no email, no text typed by anyone:
 * only an event name, a day and, where it applies, a public content or destination id.
 */
export const MetricCounters: CollectionConfig = {
  slug: 'metric-counters',
  admin: { group, hidden: true },
  access: { read: isCommunityAdministrator, create: nobody, update: nobody, delete: nobody },
  timestamps: false,
  indexes: [{ fields: ['event', 'day'] }],
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'event', type: 'text', required: true },
    { name: 'day', type: 'text', required: true, maxLength: 10 },
    { name: 'dimension', type: 'text' },
    { name: 'count', type: 'number', required: true, defaultValue: 0 },
  ],
}

/** One row per run of a scheduled job, so a failure is visible. */
export const JobRuns: CollectionConfig = {
  slug: 'job-runs',
  admin: { group, defaultColumns: ['job', 'ok', 'summary', 'createdAt'], hidden: hiddenUnlessModerator },
  access: moderatorReadOnly,
  indexes: [{ fields: ['job', 'createdAt'] }],
  fields: [
    { name: 'job', type: 'text', required: true },
    { name: 'ok', type: 'checkbox', required: true, defaultValue: true },
    { name: 'summary', type: 'text' },
    { name: 'durationMs', type: 'number' },
  ],
}
