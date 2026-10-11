import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { blockPublishBelowPublisher, draftOnlyBelowPublisher } from '../access/publishGuard'
import { administratorOnlyField, isEditor, isPublisher, publishedOrStaff } from '../access/roles'
import { FACT_KINDS, factNeedsSource, MONTH_NAMES, MONTHS } from '../lib/content/destinationFacts'
import { DESTINATIONS_TAG, expireTags } from '../lib/content/revalidate'
import { normaliseSlug, seoFields, validateSlug } from './fields'

const MAX_DEPTH = 4

const httpsLink = (value: string | null | undefined) => !value || /^https:\/\/[^\s]+$/.test(value) || 'Use a full web address that starts with https://.'

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
    // Refresh destination pages and the index when a change touches what readers can see.
    afterChange: [
      async ({ doc, previousDoc }) => {
        if (doc._status === 'published' || previousDoc?._status === 'published') await expireTags([DESTINATIONS_TAG])
        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        await expireTags([DESTINATIONS_TAG])
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Introduction',
          description: 'What readers see first. A destination appears in the Destinations list once it has an introduction or a published guide.',
          fields: [
            { name: 'summary', type: 'textarea', required: true, maxLength: 300, admin: { description: 'One or two sentences: what this place is and who it suits. Used at the top of the page, on cards and in search results.' } },
            {
              name: 'heroImage',
              label: 'Main photo',
              type: 'upload',
              relationTo: 'images',
              admin: { description: 'Optional. Shown at the top of the page with its credit. Upload it under Editorial photos first.' },
            },
            { name: 'body', label: 'Introduction', type: 'richText', admin: { description: 'Original writing: what the place is like, main experiences and trade-offs, getting there and around, where to stay. Use headings (H2) for each part.' } },
            {
              name: 'goodFor',
              label: 'Good for',
              type: 'text',
              maxLength: 160,
              admin: { description: 'Optional. Short and specific, for example "First trips to Asia, food lovers, rail travel".' },
            },
            {
              name: 'timeNeeded',
              label: 'Time to allow',
              type: 'text',
              maxLength: 120,
              admin: { description: 'Optional. For example "10 to 14 days for a first trip". Explain the reasoning in the introduction.' },
            },
            {
              name: 'author',
              type: 'relationship',
              relationTo: 'authors',
              admin: { description: 'Optional. Who wrote this page. Shown with a link to their author page.' },
            },
          ],
        },
        {
          label: 'When to go',
          fields: [
            {
              name: 'bestMonths',
              label: 'Best months',
              type: 'select',
              hasMany: true,
              options: MONTHS.map((m) => ({ label: MONTH_NAMES[m], value: m })),
              admin: { description: 'The months most travellers will enjoy most. Explain why below.' },
            },
            {
              name: 'goodMonths',
              label: 'Good months',
              type: 'select',
              hasMany: true,
              options: MONTHS.map((m) => ({ label: MONTH_NAMES[m], value: m })),
              admin: { description: 'Also worth it, with trade-offs (heat, rain, crowds, prices). Months in neither list show as "check conditions".' },
            },
            {
              name: 'whenToGo',
              label: 'When to go: explanation',
              type: 'textarea',
              maxLength: 900,
              validate: (value: string | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
                const rated = (Array.isArray(siblingData?.bestMonths) && siblingData.bestMonths.length > 0) || (Array.isArray(siblingData?.goodMonths) && siblingData.goodMonths.length > 0)
                return !rated || (value && value.trim().length >= 40) ? true : 'Explain the months you chose in a sentence or two: weather, crowds, prices, events.'
              },
              admin: { description: 'Required when months are chosen. Say why: weather, crowds, prices, school holidays in Australia, festivals.' },
            },
          ],
        },
        {
          label: 'Key facts and sources',
          description: 'Facts readers may act on. Entry rules, government advice, health and emergency numbers need an official source.',
          fields: [
            {
              name: 'facts',
              label: 'Key facts',
              type: 'array',
              maxRows: 12,
              labels: { singular: 'Fact', plural: 'Facts' },
              admin: { initCollapsed: false },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'kind', type: 'select', required: true, options: FACT_KINDS.map((k) => ({ label: k.label, value: k.value })), admin: { width: '40%' } },
                    {
                      name: 'label',
                      type: 'text',
                      maxLength: 40,
                      validate: (value: string | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) =>
                        siblingData?.kind !== 'other' || (value && value.trim()) ? true : 'Write a label for this fact.',
                      admin: { width: '60%', condition: (_, sibling) => sibling?.kind === 'other', description: 'For example "Local SIM cards".' },
                    },
                  ],
                },
                { name: 'value', type: 'textarea', required: true, maxLength: 300, admin: { description: 'Short and exact. For example "Japanese yen (JPY). Cards are widely accepted in cities; carry cash for rural areas."' } },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'sourceName',
                      label: 'Source',
                      type: 'text',
                      maxLength: 120,
                      validate: (value: string | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) =>
                        !factNeedsSource(siblingData?.kind) || (value && value.trim()) ? true : 'This fact needs an official source, for example "Smartraveller" or "Embassy of Japan in Australia".',
                      admin: { width: '40%' },
                    },
                    {
                      name: 'sourceUrl',
                      label: 'Source link',
                      type: 'text',
                      validate: (value: string | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
                        if (factNeedsSource(siblingData?.kind) && !value) return 'Add the link to the official page.'
                        if (siblingData?.sourceName && !value) return 'Add the link for this source.'
                        return httpsLink(value)
                      },
                      admin: { width: '60%' },
                    },
                  ],
                },
              ],
            },
            {
              name: 'factsCheckedAt',
              label: 'Facts checked on',
              type: 'date',
              validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
                !Array.isArray(siblingData?.facts) || siblingData.facts.length === 0 || value ? true : 'Enter the date you checked these facts against their sources.',
              admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'The day you last checked every fact against its source. Shown on the page. Change it only after a real check.' },
            },
            {
              name: 'sources',
              label: 'Other sources used on this page',
              type: 'array',
              maxRows: 20,
              labels: { singular: 'Source', plural: 'Sources' },
              admin: { description: 'Official or reliable pages that support the introduction and "When to go". Shown at the bottom of the page.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', required: true, maxLength: 120, admin: { width: '40%' } },
                    { name: 'url', type: 'text', required: true, validate: httpsLink, admin: { width: '60%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Questions',
          fields: [
            {
              name: 'faqs',
              label: 'Common questions',
              type: 'array',
              maxRows: 8,
              labels: { singular: 'Question', plural: 'Questions' },
              admin: { description: 'Optional. Real questions travellers ask, answered directly in two to four sentences. Do not repeat what the page already says.' },
              fields: [
                { name: 'question', type: 'text', required: true, maxLength: 160 },
                { name: 'answer', type: 'textarea', required: true, maxLength: 800 },
              ],
            },
          ],
        },
        { label: 'Search appearance', fields: [seoFields] },
        {
          label: 'Names and import record',
          fields: [
          {
            name: 'aliases',
            type: 'text',
            hasMany: true,
            admin: { description: 'Other names people search for, for example "Saigon" for Ho Chi Minh City.' },
          },
          {
            name: 'source',
            type: 'group',
            admin: { description: 'Where this record came from. Imported records keep their licence and source id.' },
            fields: [
              { name: 'name', type: 'text', admin: { readOnly: true } },
              { name: 'externalId', type: 'text', index: true, admin: { readOnly: true } },
              { name: 'licence', type: 'text', admin: { readOnly: true } },
              { name: 'importedAt', type: 'date', admin: { readOnly: true } },
            ],
          },
          ],
        },
      ],
    },
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
        { label: 'Travel area (island, coast, national park)', value: 'area' },
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
    { name: 'latitude', type: 'number', min: -90, max: 90, admin: { position: 'sidebar' } },
    { name: 'longitude', type: 'number', min: -180, max: 180, admin: { position: 'sidebar' } },
    {
      name: 'timeZone',
      type: 'text',
      maxLength: 64,
      validate: (value: string | null | undefined) => {
        if (!value) return true
        try {
          new Intl.DateTimeFormat('en', { timeZone: value })
          return true
        } catch {
          return 'Use an IANA time zone name, for example Asia/Bangkok.'
        }
      },
      admin: { position: 'sidebar', description: 'IANA time zone, for example Asia/Bangkok. Used for event times.' },
    },
    { name: 'population', type: 'number', min: 0, admin: { position: 'sidebar', description: 'Only used to order search suggestions.' } },
    {
      name: 'hubIndexable',
      type: 'checkbox',
      defaultValue: false,
      // An editorial decision: only an administrator can let search engines index a community hub.
      access: { create: administratorOnlyField, update: administratorOnlyField },
      admin: { position: 'sidebar', description: 'Tick only after checking that this destination’s community page has useful content. Until then the page stays out of search engines and the sitemap.' },
    },
  ],
}
