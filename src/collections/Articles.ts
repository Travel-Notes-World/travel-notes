import type { Access, CollectionConfig, Where } from 'payload'
import { Forbidden } from 'payload'

import { blockPublishBelowPublisher, draftOnlyBelowPublisher } from '../access/publishGuard'
import { hasRole, isPublisher, isStaff, nobodyField, staffOnlyField } from '../access/roles'
import { ARTICLES_TAG, articleTag, expireTags } from '../lib/content/revalidate'
import { seoFields, slugField } from './fields'

export const ARTICLE_TYPES = [
  { label: 'Destination guide', value: 'destination-guide' },
  { label: 'Itinerary', value: 'itinerary' },
  { label: 'Practical advice', value: 'practical-advice' },
  { label: 'Gear review', value: 'gear-review' },
  { label: 'Photo essay', value: 'photo-essay' },
  { label: 'Video story', value: 'video-story' },
  { label: 'Sponsored feature', value: 'sponsored-feature' },
] as const

/** Readers: published only. Contributors: published plus their own drafts. Editors and above: everything. */
const readArticles: Access = ({ req }) => {
  if (hasRole(req, 'editor')) return true
  if (hasRole(req, 'contributor') && req.user) {
    const own: Where = { or: [{ _status: { equals: 'published' } }, { createdBy: { equals: req.user.id } }] }
    return own
  }
  return { _status: { equals: 'published' } }
}

/** Version history holds unpublished text, so it is never public. Contributors see versions of their own articles. */
const readArticleVersions: Access = ({ req }) => {
  if (hasRole(req, 'editor')) return true
  if (hasRole(req, 'contributor') && req.user) return { 'version.createdBy': { equals: req.user.id } }
  return false
}

const updateArticles: Access = ({ req }) => {
  if (hasRole(req, 'editor')) return true
  if (hasRole(req, 'contributor') && req.user) return { createdBy: { equals: req.user.id } }
  return false
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'editorialState', '_status', 'updatedAt'],
    group: 'Editorial',
  },
  access: {
    read: readArticles,
    readVersions: readArticleVersions,
    create: isStaff,
    update: updateArticles,
    delete: isPublisher,
  },
  // Drafts: saving never changes the published revision. Revision history is capped to bound database growth.
  versions: { drafts: true, maxPerDoc: 50 },
  indexes: [{ fields: ['_status', 'firstPublishedAt'] }],
  hooks: {
    beforeOperation: [draftOnlyBelowPublisher],
    beforeChange: [
      blockPublishBelowPublisher,
      ({ data, operation, originalDoc, req }) => {
        // Record who created the article. This drives contributor ownership and cannot be edited.
        if (operation === 'create' && req.user) data.createdBy = req.user.id

        // Only editors and above can mark an article as approved or archived.
        const stateChanged = data.editorialState !== undefined && data.editorialState !== originalDoc?.editorialState
        if (
          req.user &&
          stateChanged &&
          (data.editorialState === 'approved' || data.editorialState === 'archived') &&
          !hasRole(req, 'editor')
        ) {
          throw new Forbidden(req.t)
        }

        // Stamp the first publication time once and keep it.
        if (data._status === 'published' && !data.firstPublishedAt && !originalDoc?.firstPublishedAt) {
          data.firstPublishedAt = new Date().toISOString()
        }
        return data
      },
    ],
    // Refresh the public pages whenever a change touches what readers can see:
    // publish, an edit to a published article, a slug change, or a withdrawal.
    afterChange: [
      async ({ doc, previousDoc }) => {
        if (doc._status === 'published' || previousDoc?._status === 'published') {
          const slugs = [doc.slug, previousDoc?.slug].filter((s): s is string => typeof s === 'string' && s.length > 0)
          await expireTags([ARTICLES_TAG, ...slugs.map(articleTag)])
        }
        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        if (typeof doc?.slug === 'string') await expireTags([ARTICLES_TAG, articleTag(doc.slug)])
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'deck', type: 'textarea', required: true, admin: { description: 'One or two sentences under the title.' } },
            { name: 'excerpt', type: 'textarea', required: true, admin: { description: 'Short summary used on article cards.' } },
            {
              name: 'takeaways',
              type: 'array',
              labels: { singular: 'Takeaway', plural: 'Key takeaways' },
              maxRows: 6,
              admin: { description: 'Optional summary box at the top of the article.' },
              fields: [{ name: 'text', type: 'text', required: true }],
            },
            { name: 'body', type: 'richText', required: true },
            {
              name: 'days',
              type: 'array',
              labels: { singular: 'Itinerary day', plural: 'Itinerary days' },
              admin: {
                description: 'Itineraries only: one entry per day.',
                condition: (data) => data?.type === 'itinerary',
              },
              fields: [
                { name: 'title', type: 'text', required: true },
                {
                  name: 'stops',
                  type: 'array',
                  fields: [
                    { name: 'time', type: 'text', admin: { description: 'For example 8:30 am.' } },
                    { name: 'name', type: 'text', required: true },
                    { name: 'note', type: 'textarea' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Commercial',
          fields: [
            {
              name: 'disclosure',
              type: 'group',
              fields: [
                {
                  name: 'kind',
                  type: 'select',
                  required: true,
                  defaultValue: 'none',
                  options: [
                    { label: 'None', value: 'none' },
                    { label: 'Contains affiliate links', value: 'affiliate' },
                    { label: 'Sponsored', value: 'sponsored' },
                  ],
                  validate: (value: unknown, { data }: { data: unknown }) => {
                    const type = (data as { type?: string } | undefined)?.type
                    if (type === 'sponsored-feature' && value !== 'sponsored') {
                      return 'A sponsored feature must carry the Sponsored disclosure.'
                    }
                    return value ? true : 'Choose a disclosure option.'
                  },
                },
                {
                  name: 'sponsorName',
                  type: 'text',
                  admin: { condition: (_, sibling) => sibling?.kind === 'sponsored' },
                  validate: (value: string | null | undefined, { siblingData }: { siblingData: unknown }) => {
                    const kind = (siblingData as { kind?: string } | undefined)?.kind
                    return kind === 'sponsored' && !value ? 'Name the sponsor.' : true
                  },
                },
              ],
            },
            {
              name: 'adPolicy',
              type: 'select',
              required: true,
              defaultValue: 'standard',
              options: [
                { label: 'Standard ad placements', value: 'standard' },
                { label: 'No ads on this article', value: 'none' },
              ],
            },
          ],
        },
        { label: 'Search', fields: [seoFields] },
      ],
    },
    slugField('Used in the article address: /stories/your-slug'),
    { name: 'type', type: 'select', required: true, options: [...ARTICLE_TYPES], admin: { position: 'sidebar' } },
    {
      name: 'editorialState',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'In review', value: 'in-review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Workflow stage. Approving needs an editor. Publishing needs a publisher and uses the Publish button.',
      },
    },
    { name: 'primaryAuthor', type: 'relationship', relationTo: 'authors', required: true, admin: { position: 'sidebar' } },
    { name: 'coauthors', type: 'relationship', relationTo: 'authors', hasMany: true, admin: { position: 'sidebar' } },
    {
      name: 'primaryDestination',
      type: 'relationship',
      relationTo: 'destinations',
      admin: { position: 'sidebar', description: 'Used for breadcrumbs and the destination hub.' },
    },
    { name: 'additionalDestinations', type: 'relationship', relationTo: 'destinations', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'topics', type: 'relationship', relationTo: 'topics', hasMany: true, admin: { position: 'sidebar' } },
    {
      name: 'firstPublishedAt',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' }, description: 'Set automatically on first publication.' },
    },
    {
      name: 'editorialUpdatedAt',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' }, description: 'Set only for a real content update, not a typo fix.' },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' }, description: 'Last time prices, transport and opening details were checked.' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'staff',
      index: true,
      // Staff ids are never shown to readers and cannot be changed through any interface.
      access: { read: staffOnlyField, create: nobodyField, update: nobodyField },
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
