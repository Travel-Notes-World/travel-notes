import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator, moderatorReadOnly } from '../../access/community'

/**
 * One row per AI Trip Planner request: who asked, for which plan, the model, the tokens used and
 * the estimated cost. Used to enforce the daily spending limit and the free allowance, and kept as
 * a record of what was charged for. No plan text is stored here.
 */
export const AiRuns: CollectionConfig = {
  slug: 'ai-runs',
  labels: { singular: 'AI plan request', plural: 'AI plan requests' },
  admin: {
    group: 'Community (read-only, moderate at /moderation)',
    defaultColumns: ['createdAt', 'status', 'model', 'costMicroUsd', 'free'],
    hidden: hiddenUnlessModerator,
  },
  access: moderatorReadOnly,
  indexes: [{ fields: ['member', 'status'] }],
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', index: true },
    { name: 'plan', type: 'relationship', relationTo: 'plans', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'started',
      options: [
        { value: 'started', label: 'Started' },
        { value: 'ok', label: 'Finished' },
        { value: 'failed', label: 'Failed (not counted)' },
      ],
    },
    { name: 'model', type: 'text', required: true },
    { name: 'kind', type: 'select', defaultValue: 'brief', options: [{ value: 'brief', label: 'Free brief plan' }, { value: 'detailed', label: 'Detailed plan' }, { value: 'revision', label: 'Revision' }] },
    { name: 'free', type: 'checkbox', defaultValue: false, admin: { description: 'Used the member’s free allowance.' } },
    { name: 'payment', type: 'relationship', relationTo: 'listing-payments', admin: { description: 'The paid plan this request used, if any.' } },
    { name: 'inputTokens', type: 'number', defaultValue: 0 },
    { name: 'outputTokens', type: 'number', defaultValue: 0 },
    { name: 'costMicroUsd', type: 'number', defaultValue: 0, index: true, admin: { description: 'Estimated cost in millionths of a US dollar, from the published token prices.' } },
    { name: 'error', type: 'text' },
  ],
}
