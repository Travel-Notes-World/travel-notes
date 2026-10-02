import type { CollectionConfig } from 'payload'

import { isEditor, isPublisher } from '../access/roles'
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
