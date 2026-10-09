import type { CollectionConfig } from 'payload'

import { isAdministrator, isEditor, nobodyField } from '../access/roles'

/**
 * Messages sent through the public contact form at /contact.
 *
 * - Nobody can create a message through the CMS or its API. The form saves them through
 *   src/lib/contact.ts, which validates, rate-limits and then writes with the server's own rights.
 * - Editors and above can read them and change only the handling fields (status and note).
 *   What the visitor wrote can never be edited.
 * - Each message is also emailed to CONTACT_INBOX. The message is saved first, so a failed email
 *   never loses it; the daily job retries the email.
 */
const readOnlyAfterCreate = { update: nobodyField }

export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  labels: { singular: 'Contact message', plural: 'Contact messages' },
  admin: {
    group: 'Inbox',
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'name', 'topic', 'status', 'createdAt'],
    description: 'Messages sent through the contact form. Reply from your own email; mark the message handled here.',
  },
  access: { read: isEditor, create: () => false, update: isEditor, delete: isAdministrator },
  fields: [
    { name: 'subject', type: 'text', required: true, access: readOnlyAfterCreate, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true, access: readOnlyAfterCreate, admin: { readOnly: true } },
    { name: 'email', type: 'email', required: true, access: readOnlyAfterCreate, admin: { readOnly: true } },
    {
      name: 'topic',
      type: 'select',
      required: true,
      access: readOnlyAfterCreate,
      admin: { readOnly: true },
      options: [
        { label: 'General question', value: 'general' },
        { label: 'Correction to an article', value: 'correction' },
        { label: 'Advertising or partnership', value: 'advertising' },
        { label: 'Guest article pitch', value: 'pitch' },
        { label: 'Privacy or my data', value: 'privacy' },
        { label: 'Something else', value: 'other' },
      ],
    },
    { name: 'pageUrl', type: 'text', access: readOnlyAfterCreate, admin: { readOnly: true, description: 'The article or page the message is about, if the visitor gave one.' } },
    { name: 'message', type: 'textarea', required: true, access: readOnlyAfterCreate, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Handled', value: 'handled' },
        { label: 'Spam', value: 'spam' },
      ],
    },
    { name: 'note', type: 'textarea', admin: { description: 'Private note for staff, for example what was done.' } },
    {
      type: 'collapsible',
      label: 'Email delivery',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'emailStatus',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          index: true,
          access: readOnlyAfterCreate,
          admin: { readOnly: true },
          options: [
            { label: 'Waiting to be emailed', value: 'pending' },
            { label: 'Emailed', value: 'sent' },
            { label: 'Kept here only (test mode)', value: 'captured' },
            { label: 'Email failed', value: 'failed' },
          ],
        },
        { name: 'emailAttempts', type: 'number', required: true, defaultValue: 0, access: readOnlyAfterCreate, admin: { readOnly: true } },
        { name: 'emailError', type: 'text', access: readOnlyAfterCreate, admin: { readOnly: true } },
      ],
    },
  ],
}
