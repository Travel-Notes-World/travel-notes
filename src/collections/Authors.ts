import type { CollectionConfig } from 'payload'

import { isEditor, isPublisher } from '../access/roles'
import { ARTICLES_TAG, AUTHORS_TAG, authorTag, expireTags } from '../lib/content/revalidate'
import { slugField } from './fields'

/** Public author profiles shown on the site. Separate from private staff logins. */
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'updatedAt'], group: 'Editorial' },
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isPublisher,
  },
  hooks: {
    // An author's name and address also appear on their articles, so article pages are refreshed too.
    afterChange: [
      async ({ doc, previousDoc }) => {
        const slugs = [doc.slug, previousDoc?.slug].filter((s): s is string => typeof s === 'string' && s.length > 0)
        await expireTags([AUTHORS_TAG, ARTICLES_TAG, ...slugs.map(authorTag)])
        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        if (typeof doc?.slug === 'string') await expireTags([AUTHORS_TAG, ARTICLES_TAG, authorTag(doc.slug)])
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('Used in the author page address: /authors/your-slug'),
    { name: 'biography', type: 'textarea', required: true, admin: { description: 'Short public biography.' } },
    {
      name: 'relevantExperience',
      type: 'textarea',
      admin: { description: 'First-hand travel or subject experience that supports this author’s articles.' },
    },
    {
      name: 'links',
      type: 'array',
      labels: { singular: 'Profile link', plural: 'Profile links' },
      admin: { description: 'Verified external profiles only.' },
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (value: string | null | undefined) =>
            typeof value === 'string' && /^https:\/\/\S+$/.test(value) ? true : 'Enter a full https:// address.',
        },
      ],
    },
  ],
}
