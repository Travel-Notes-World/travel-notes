import type { CollectionConfig } from 'payload'

import { isAdministrator, nobodyField } from '../access/roles'

/**
 * People who asked for the weekly Travel Notes email.
 *
 * - Sign-up is double opt-in: a row starts as "pending" and becomes "confirmed" only when the person
 *   presses the button in the confirmation email. That click is the consent record (Spam Act 2003).
 * - Confirmed people are copied to a Resend segment, which is where newsletters are written and sent
 *   and where unsubscribes are handled. This table keeps the consent record.
 * - Personal data: only administrators can see it. Nobody can create or edit rows through the CMS
 *   or its API; src/lib/newsletter.ts writes them as trusted server code.
 */
const locked = { update: nobodyField }

export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: { singular: 'Newsletter subscriber', plural: 'Newsletter subscribers' },
  admin: {
    group: 'Inbox',
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'confirmedAt', 'syncStatus'],
    description: 'Weekly email sign-ups. Write and send newsletters in Resend (Broadcasts); unsubscribes are handled there.',
  },
  access: { read: isAdministrator, create: () => false, update: () => false, delete: isAdministrator },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true, access: locked, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      access: locked,
      admin: { readOnly: true },
      options: [
        { label: 'Waiting for confirmation', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
      ],
    },
    { name: 'requestedAt', type: 'date', required: true, access: locked, admin: { readOnly: true } },
    { name: 'confirmedAt', type: 'date', access: locked, admin: { readOnly: true, description: 'When they pressed "Confirm" in the email: the consent record.' } },
    { name: 'source', type: 'text', access: locked, admin: { readOnly: true, description: 'The page they signed up on.' } },
    // Only a hash of the confirmation token is stored, so a database leak cannot be used to confirm anyone.
    { name: 'tokenHash', type: 'text', index: true, access: { read: nobodyField, create: nobodyField, update: nobodyField }, admin: { hidden: true } },
    { name: 'tokenExpiresAt', type: 'date', access: { read: nobodyField, create: nobodyField, update: nobodyField }, admin: { hidden: true } },
    {
      type: 'collapsible',
      label: 'Copy to Resend',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'syncStatus',
          type: 'select',
          required: true,
          defaultValue: 'not-needed',
          index: true,
          access: locked,
          admin: { readOnly: true },
          options: [
            { label: 'Not needed yet', value: 'not-needed' },
            { label: 'Waiting', value: 'pending' },
            { label: 'Copied', value: 'synced' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        { name: 'syncAttempts', type: 'number', required: true, defaultValue: 0, access: locked, admin: { readOnly: true } },
        { name: 'syncError', type: 'text', access: locked, admin: { readOnly: true } },
      ],
    },
  ],
}
