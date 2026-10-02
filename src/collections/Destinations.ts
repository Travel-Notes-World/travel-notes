import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { blockPublishBelowPublisher, draftOnlyBelowPublisher } from '../access/publishGuard'
import { isEditor, isPublisher, publishedOrStaff } from '../access/roles'
import { normaliseSlug, seoFields, validateSlug } from './fields'

const MAX_DEPTH = 4

/**
 * Country → region → city hierarchy (implementation plan §4 and §5).
 * A hub is an editorial page: keep it as a draft until it has useful guidance
 * and enough supporting articles.
 */
export const Destinations: CollectionConfig = {
  slug: 'destinations',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'kind', 'path', '_status'], group: 'Editorial' },
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
    beforeChange: [
      blockPublishBelowPublisher,
      // Build the canonical path from the parent chain, for example "japan/kyoto".
      async ({ data, originalDoc, req }) => {
        const slug = data.slug ?? originalDoc?.slug
        if (!slug) return data
        const segments: string[] = [slug]
        const seen = new Set<string>(originalDoc?.id ? [String(originalDoc.id)] : [])
        let parentId = data.parent !== undefined ? data.parent : originalDoc?.parent
        while (parentId) {
          const id = String(typeof parentId === 'object' ? parentId.id : parentId)
          if (seen.has(id) || segments.length >= MAX_DEPTH) {
            throw new ValidationError({
              collection: 'destinations',
              errors: [{ path: 'parent', message: 'This parent would create a loop or a hierarchy deeper than four levels.' }],
            })
          }
          seen.add(id)
          const parent = await req.payload.findByID({ collection: 'destinations', id, depth: 0, draft: true, req })
          segments.unshift(parent.slug)
          parentId = parent.parent
        }
        data.path = segments.join('/')
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      validate: validateSlug,
      hooks: { beforeValidate: [({ value }) => normaliseSlug(value)] },
      admin: { position: 'sidebar', description: 'One URL segment only, for example "kyoto". The full path is built from the parent.' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Country', value: 'country' },
        { label: 'Region', value: 'region' },
        { label: 'City', value: 'city' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'destinations',
      index: true,
      admin: { position: 'sidebar', description: 'Leave empty for a country.' },
    },
    {
      name: 'path',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar', description: 'Canonical path under /destinations/. Set automatically when saved.' },
    },
    {
      name: 'isoCountryCode',
      type: 'text',
      maxLength: 2,
      validate: (value: string | null | undefined) =>
        !value || /^[A-Z]{2}$/.test(value) ? true : 'Use the two-letter ISO code in capitals, for example JP.',
      admin: { position: 'sidebar', description: 'Optional. Two-letter ISO country code, for example JP.' },
    },
    {
      name: 'accentColour',
      type: 'text',
      validate: (value: string | null | undefined) =>
        !value || /^#[0-9a-fA-F]{6}$/.test(value) ? true : 'Use a six-digit hex colour, for example #2e4a50.',
      admin: { position: 'sidebar', description: 'Optional. Destination signature colour. It must be dark enough for light text.' },
    },
    { name: 'summary', type: 'textarea', required: true, admin: { description: 'One or two sentences used on cards and at the top of the hub.' } },
    { name: 'body', type: 'richText', admin: { description: 'Original introduction, best-time guidance and practical notes.' } },
    seoFields,
  ],
}
