import type { CollectionConfig } from 'payload'

import { blockPublishBelowPublisher, draftOnlyBelowPublisher } from '../access/publishGuard'
import { isEditor, isPublisher, publishedOrStaff } from '../access/roles'
import { TOPICS_TAG, expireTags } from '../lib/content/revalidate'
import { seoFields, slugField } from './fields'

/** Curated topic landing pages, for example budget travel or gear. */
export const Topics: CollectionConfig = {
  slug: 'topics',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', '_status', 'updatedAt'], group: 'Editorial' },
  access: {
    read: publishedOrStaff,
    readVersions: isEditor,
    create: isEditor,
    update: isEditor,
    delete: isPublisher,
  },
  versions: { drafts: true, maxPerDoc: 25 },
  hooks: {
    beforeOperation: [draftOnlyBelowPublisher],
    beforeChange: [blockPublishBelowPublisher],
    // Refresh topic pages, the footer links and the homepage when a change touches what readers can see.
    afterChange: [
      async ({ doc, previousDoc }) => {
        if (doc._status === 'published' || previousDoc?._status === 'published') await expireTags([TOPICS_TAG])
        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        await expireTags([TOPICS_TAG])
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('Used in the topic page address: /topics/your-slug'),
    { name: 'introduction', type: 'textarea', required: true, admin: { description: 'Original introduction for the topic page.' } },
    {
      name: 'featuredArticles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { description: 'Optional. Articles to feature at the top of this topic page.' },
    },
    seoFields,
  ],
}
