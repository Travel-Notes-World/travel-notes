import type { CollectionConfig, Field } from 'payload'

import { blockPublishBelowPublisher, draftOnlyBelowPublisher } from '../access/publishGuard'
import { isEditor, isPublisher, publishedOrStaff } from '../access/roles'
import { DESTINATIONS_TAG, UPDATES_TAG, expireTags, updateTag } from '../lib/content/revalidate'
import { scheduleFields, scheduleGuard } from '../lib/content/schedule'
import { UPDATE_CATEGORIES, validSourceUrl } from '../lib/content/updateRules'
import { addressGone, published } from '../lib/redirects/automatic'
import { slugField, validateSlug } from './fields'

const RESERVED_SLUGS = ['weekly']

/**
 * Travel updates (/updates/<slug>): short, dated reports of a change that matters to travellers,
 * such as a new entry rule, a new route, a closure or a safety advisory.
 *
 * Trust rules, enforced here rather than left to habit:
 * - every update links to at least one official source (https only);
 * - the first publication time is stamped once and never changes; a real correction or change sets
 *   "Updated on" and a short note saying what changed, which the page shows;
 * - same draft → publish rules as guides: editors write, only publishers publish.
 */
export const TravelUpdates: CollectionConfig = {
  slug: 'travel-updates',
  labels: { singular: 'Travel update', plural: 'Travel updates' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'publishAt', 'firstPublishedAt'],
    group: 'Editorial',
    description: 'Short, dated reports of changes that matter to travellers. Each one needs an official source.',
  },
  access: {
    read: publishedOrStaff,
    readVersions: isEditor,
    create: isEditor,
    update: isEditor,
    delete: isPublisher,
  },
  versions: { drafts: true, maxPerDoc: 25 },
  defaultSort: '-firstPublishedAt',
  hooks: {
    beforeOperation: [draftOnlyBelowPublisher],
    beforeChange: [
      blockPublishBelowPublisher,
      ({ data, originalDoc }) => {
        // Stamp the first publication time once and keep it.
        if (data._status === 'published' && !data.firstPublishedAt && !originalDoc?.firstPublishedAt) {
          data.firstPublishedAt = new Date().toISOString()
        }
        return data
      },
      scheduleGuard,
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc._status === 'published' || previousDoc?._status === 'published') {
          const slugs = [doc.slug, previousDoc?.slug].filter((s): s is string => typeof s === 'string' && s.length > 0)
          // Destination pages show the latest updates, so they refresh too.
          await expireTags([UPDATES_TAG, DESTINATIONS_TAG, ...slugs.map(updateTag)])
        }
        // An address change on a published update redirects the old address.
        if (doc._status === 'published') await published(req, 'travel-updates', doc, '/updates/')
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (typeof doc?.slug !== 'string') return doc
        await expireTags([UPDATES_TAG, DESTINATIONS_TAG, updateTag(doc.slug)])
        if (doc._status === 'published') await addressGone(req, `/updates/${doc.slug}`)
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 110,
      admin: { description: 'Say what changed, plainly. For example: "Japan starts charging a departure tax of ¥3,000 from 1 July".' },
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      maxLength: 300,
      admin: { description: 'One or two sentences: what changed, for whom, and from when. Shown in lists, the newsletter and search results.' },
    },
    {
      name: 'body',
      type: 'richText',
      admin: { description: 'Optional. What it means for travellers and what to do now.' },
    },
    {
      name: 'sources',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 5,
      labels: { singular: 'Source', plural: 'Sources' },
      admin: { description: 'The official source first (government, airline, park authority). At least one is required.', initCollapsed: false },
      fields: [
        { name: 'name', type: 'text', required: true, maxLength: 120, admin: { description: 'For example: Smartraveller, Japan Ministry of Foreign Affairs.' } },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (value: string | null | undefined) => (validSourceUrl(value) ? true : 'Enter the full https:// address of the source page.'),
        },
      ],
    },
    {
      name: 'updateNote',
      type: 'textarea',
      maxLength: 300,
      admin: { description: 'Only after a real change or correction: what changed since first publication. Set "Updated on" too.' },
    },
    {
      ...slugField('Used in the address: /updates/your-slug'),
      // "weekly" is the address of the newsletter list page, so no update can use it.
      validate: (value: string | null | undefined, args: Parameters<typeof validateSlug>[1]) =>
        RESERVED_SLUGS.includes(value ?? '') ? 'This address is used by another page. Choose a different slug.' : validateSlug(value, args),
    } as Field,
    {
      name: 'category',
      type: 'select',
      required: true,
      options: UPDATE_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'affectsAustralians',
      type: 'checkbox',
      label: 'Affects travellers from Australia',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Tick when Australian passport holders or flights from Australia are directly affected.' },
    },
    {
      name: 'destinations',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: { position: 'sidebar', description: 'Where it applies. Shown on these destination pages and the places inside them. Leave empty for worldwide.' },
    },
    { name: 'author', type: 'relationship', relationTo: 'authors', required: true, admin: { position: 'sidebar' } },
    {
      name: 'effectiveDate',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' }, description: 'Optional. When the change starts.' },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' }, description: 'Optional. When it ends (for a closure or a temporary rule). After this date it leaves destination pages.' },
      validate: (value: unknown, { siblingData }: { siblingData: { effectiveDate?: string | null } }) => {
        if (!value || !siblingData?.effectiveDate) return true
        return new Date(value as string) >= new Date(siblingData.effectiveDate) ? true : 'The end date must be on or after the start date.'
      },
    },
    ...scheduleFields,
    {
      name: 'firstPublishedAt',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' }, description: 'Set automatically on first publication.' },
    },
    {
      name: 'editorialUpdatedAt',
      label: 'Updated on',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' }, description: 'Set only for a real change or correction, with a note above.' },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'Search appearance (optional)',
      admin: { description: 'Leave empty to use the title and summary.' },
      fields: [
        { name: 'title', type: 'text', maxLength: 70 },
        { name: 'description', type: 'textarea', maxLength: 200 },
        { name: 'noindex', type: 'checkbox', defaultValue: false, admin: { description: 'Tick to ask search engines not to index this update.' } },
      ],
    },
  ],
}
