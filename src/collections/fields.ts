import type { Field, TextFieldSingleValidation } from 'payload'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const validateSlug: TextFieldSingleValidation = (value) => {
  if (!value) return 'A URL slug is required.'
  if (value.length > 96) return 'Keep the slug under 96 characters.'
  if (!SLUG_PATTERN.test(value)) return 'Use lowercase letters, numbers and single hyphens only, for example "three-days-in-kyoto".'
  return true
}

/** Trim and lowercase what the editor typed; the validator then rejects anything that is still not a clean slug. */
export const normaliseSlug = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '-') : value

export const slugField = (description: string): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  validate: validateSlug,
  hooks: { beforeValidate: [({ value }) => normaliseSlug(value)] },
  admin: { position: 'sidebar', description },
})

/** Search metadata. Required when publishing; drafts can be saved without it. */
export const seoFields: Field = {
  name: 'seo',
  type: 'group',
  label: 'Search appearance',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 70,
      admin: { description: 'Title shown in search results. Aim for about 50 to 60 characters.' },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      maxLength: 200,
      admin: { description: 'Summary shown in search results. Aim for about 140 to 160 characters.' },
    },
    {
      name: 'noindex',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Tick to ask search engines not to index this page.' },
    },
  ],
}
