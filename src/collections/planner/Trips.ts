import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator } from '../../access/community'

/**
 * Trips made with the single-form Trip Planner. Each is reached by a long random token in its
 * address (/trip-planner/t/<token>); the traveller's details are stored here, never in the
 * address. Rows are written only by server code (src/lib/planner/trip/store.ts); nothing reads or
 * writes them through the API.
 *
 * `plan` holds the generated route, days, alternatives and price facts exactly as shown when the
 * trip was made, so an unlocked trip always matches the preview the traveller paid for.
 */
export const Trips: CollectionConfig = {
  slug: 'trips',
  labels: { singular: 'Planned trip', plural: 'Planned trips' },
  admin: { group: 'Trip Planner', useAsTitle: 'title', defaultColumns: ['title', 'status', 'unlocked', 'createdAt'], hidden: hiddenUnlessModerator },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['visitor', 'createdAt'] }],
  fields: [
    { name: 'token', type: 'text', required: true, unique: true, index: true },
    { name: 'title', type: 'text', required: true },
    // One-way code of the visitor's network address, for the free-plan limit. Never the address itself.
    { name: 'visitor', type: 'text', required: true, index: true },
    { name: 'member', type: 'relationship', relationTo: 'members', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'generating',
      options: [
        { value: 'generating', label: 'Being written' },
        { value: 'ready', label: 'Ready' },
        { value: 'failed', label: 'Failed' },
      ],
    },
    { name: 'error', type: 'text' },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'startedAt', type: 'date' },
    { name: 'form', type: 'json', required: true },
    { name: 'plan', type: 'json' },
    { name: 'selection', type: 'json' },
    { name: 'unlocked', type: 'checkbox', defaultValue: false, index: true },
    { name: 'unlockedAt', type: 'date' },
    { name: 'payment', type: 'relationship', relationTo: 'listing-payments' },
    // A short code of the plan and budget as previewed when checkout started, so a paid trip can be shown to match it.
    { name: 'previewHash', type: 'text' },
    { name: 'model', type: 'text' },
  ],
}
