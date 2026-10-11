import path from 'path'
import type { CollectionConfig } from 'payload'

import { isEditor, isPublisher } from '../access/roles'
import { ARTICLES_TAG, AUTHORS_TAG, DESTINATIONS_TAG, expireTags } from '../lib/content/revalidate'

/** Licences an editorial photo can be used under. Each one decides what the credit line says. */
export const IMAGE_LICENCES = [
  { value: 'own', label: 'Our own photo (taken by Travel Notes staff or a writer for us)' },
  { value: 'permission', label: 'Used with written permission from the owner' },
  { value: 'cc-by', label: 'Creative Commons Attribution (CC BY)' },
  { value: 'cc-by-sa', label: 'Creative Commons Attribution-ShareAlike (CC BY-SA)' },
  { value: 'cc0', label: 'Public domain (CC0 or no known copyright)' },
] as const
export type ImageLicence = (typeof IMAGE_LICENCES)[number]['value']

const needsLicenceLink = (licence: unknown) => licence === 'cc-by' || licence === 'cc-by-sa'

const httpsUrl = (value: string | null | undefined) => !value || /^https:\/\/[^\s]+$/.test(value) || 'Use a full web address that starts with https://.'

/**
 * Editorial photos: destination heroes and, later, article images. Separate from member photos
 * (`media`), which have their own moderation rules.
 *
 * - Staff upload them (editor and above); anyone can view them.
 * - Every photo needs a description (alt text), a credit and a licence, and the uploader confirms
 *   we have the right to use it. The credit line under the photo is built from these fields.
 * - Every stored size is re-encoded as WebP, which also removes camera metadata such as GPS.
 * - On Vercel the files go to the same S3-compatible bucket (Cloudflare R2) as member photos.
 */
export const Images: CollectionConfig = {
  slug: 'images',
  labels: { singular: 'Editorial photo', plural: 'Editorial photos' },
  admin: {
    group: 'Editorial',
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'credit', 'licence', 'createdAt'],
    description: 'Photos for destination pages and guides. Only upload a photo we have the right to use.',
  },
  hooks: {
    // A changed credit, description or file shows on every page that uses the photo straight away.
    afterChange: [async ({ doc }) => (await expireTags([ARTICLES_TAG, DESTINATIONS_TAG, AUTHORS_TAG]), doc)],
    afterDelete: [async ({ doc }) => (await expireTags([ARTICLES_TAG, DESTINATIONS_TAG, AUTHORS_TAG]), doc)],
  },
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isPublisher,
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media-editorial'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // The main file is re-encoded too, so no original with its camera metadata is ever kept.
    resizeOptions: { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 80 } },
    withMetadata: false,
    imageSizes: [
      { name: 'thumb', width: 480, height: 320, fit: 'cover', position: 'centre', formatOptions: { format: 'webp', options: { quality: 76 } } },
      { name: 'card', width: 960, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 78 } } },
      { name: 'large', width: 1600, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 78 } } },
    ],
    adminThumbnail: 'thumb',
    focalPoint: true,
    crop: false,
    pasteURL: false,
  },
  fields: [
    {
      name: 'alt',
      label: 'Description (alt text)',
      type: 'text',
      required: true,
      maxLength: 250,
      admin: { description: 'What the photo shows, for people who cannot see it. For example: "Boat shed on Dove Lake with Cradle Mountain behind".' },
    },
    {
      name: 'caption',
      type: 'text',
      maxLength: 200,
      admin: { description: 'Optional. Where and when it was taken, if that helps the reader. For example: "Cradle Mountain, Tasmania, May 2025".' },
    },
    {
      name: 'credit',
      type: 'text',
      required: true,
      maxLength: 120,
      admin: { description: 'Who took the photo, exactly as the owner wants to be credited.' },
    },
    {
      name: 'licence',
      type: 'select',
      required: true,
      options: IMAGE_LICENCES.map((l) => ({ label: l.label, value: l.value })),
    },
    {
      name: 'licenceUrl',
      label: 'Licence link',
      type: 'text',
      validate: (value: string | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
        if (needsLicenceLink(siblingData?.licence) && !value) return 'A Creative Commons photo needs a link to its licence, for example https://creativecommons.org/licenses/by-sa/4.0/.'
        return httpsUrl(value)
      },
      admin: { description: 'Required for Creative Commons photos.', condition: (_, sibling) => needsLicenceLink(sibling?.licence) },
    },
    {
      name: 'sourceUrl',
      label: 'Where the photo came from',
      type: 'text',
      validate: httpsUrl,
      admin: { description: 'Optional. The page where the photo was found, for example its Wikimedia Commons page.' },
    },
    {
      name: 'rightsConfirmed',
      label: 'I confirm we have the right to use this photo on Travel Notes',
      type: 'checkbox',
      required: true,
      validate: (value: boolean | null | undefined) => value === true || 'Tick this box to confirm we may use the photo.',
    },
    // The cloud-storage plugin stores each file's object key here when a bucket is configured.
    // Declaring it keeps the database columns the same with or without a bucket (see Media).
    { name: '_objectKey', type: 'text', admin: { hidden: true, readOnly: true } },
  ],
}
