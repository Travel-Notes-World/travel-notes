import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator, moderatorReadOnly } from '../../access/community'

/**
 * One row per listing-fee checkout. Card details never reach Travel Notes: Stripe holds them.
 * A row records what was charged, the seller and GST details at that moment (so a tax invoice
 * can always be shown again exactly as issued), and whether it was refunded.
 * Rows are written only by server code; nothing writes here through the API.
 */
export const ListingPayments: CollectionConfig = {
  slug: 'listing-payments',
  labels: { singular: 'Listing payment', plural: 'Listing payments' },
  admin: {
    group: 'Community (read-only, moderate at /moderation)',
    defaultColumns: ['invoiceNumber', 'status', 'amountMinor', 'contribution', 'createdAt'],
    useAsTitle: 'invoiceNumber',
    hidden: hiddenUnlessModerator,
  },
  access: moderatorReadOnly,
  indexes: [{ fields: ['contribution', 'status'] }],
  fields: [
    { name: 'invoiceNumber', type: 'text', required: true, unique: true, index: true },
    // Not required: a payment record is kept for tax purposes even if the listing or the account is later deleted.
    { name: 'contribution', type: 'relationship', relationTo: 'contributions', index: true },
    { name: 'member', type: 'relationship', relationTo: 'members', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'created',
      options: [
        { value: 'created', label: 'Checkout started' },
        { value: 'paid', label: 'Paid' },
        { value: 'refunded', label: 'Refunded' },
        { value: 'expired', label: 'Expired or abandoned' },
      ],
    },
    { name: 'description', type: 'text', required: true },
    { name: 'amountMinor', type: 'number', required: true, admin: { description: 'Total charged, in cents, including any GST.' } },
    { name: 'currency', type: 'text', required: true, defaultValue: 'AUD' },
    { name: 'gstMinor', type: 'number', required: true, defaultValue: 0, admin: { description: 'GST included in the total, in cents. 0 when the seller was not registered for GST.' } },
    { name: 'sellerName', type: 'text', required: true },
    { name: 'sellerAbn', type: 'text', required: true },
    { name: 'buyerEmail', type: 'text' },
    { name: 'stripeSessionId', type: 'text', unique: true, index: true },
    { name: 'stripePaymentIntentId', type: 'text' },
    { name: 'paidAt', type: 'date' },
    { name: 'refundedAt', type: 'date' },
    { name: 'refundReason', type: 'text' },
  ],
}
