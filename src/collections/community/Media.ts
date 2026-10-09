import path from 'path'
import type { Access, CollectionConfig, Where } from 'payload'

import { canModerate, hiddenUnlessModerator, isFileRequest, isMemberRequest, isRestRequest, nobody } from '../../access/community'

const approvedOnly: Where = { state: { equals: 'approved' } }
const readMedia: Access = ({ req }) => {
  if (canModerate(req)) return true
  // Through the REST API only the image files themselves can be fetched, never the list of records.
  if (isRestRequest(req) && !isFileRequest(req)) return false
  // The owner can see their own photo while it waits for review.
  if (isMemberRequest(req) && req.user) {
    const own: Where = { or: [approvedOnly, { owner: { equals: req.user.id } }] }
    return own
  }
  return approvedOnly
}

/**
 * Member photos.
 *
 * - Only JPEG, PNG and WebP are accepted, and the real file content is checked, not the name.
 * - Every stored file, including the main one, is re-encoded. That removes camera metadata such
 *   as the GPS position where the photo was taken.
 * - A file is public only when its state is "approved". The same rule guards the file address
 *   itself, so a pending or rejected photo cannot be opened by guessing its name.
 * - On Vercel there is no permanent disk. Files go to S3-compatible storage (Cloudflare R2) when
 *   it is configured (see src/lib/community/storage.ts). Without it uploads are switched off.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Photo', plural: 'Photos' },
  admin: { group: 'Community (read-only, moderate at /moderation)', defaultColumns: ['filename', 'owner', 'state', 'createdAt'], hidden: hiddenUnlessModerator },
  access: {
    read: readMedia,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  indexes: [{ fields: ['state', 'createdAt'] }, { fields: ['owner', 'state'] }],
  upload: {
    // An absolute folder at the project root. Only used where there is a real disk (a developer's computer, tests).
    staticDir: path.resolve(process.cwd(), 'media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // Re-encoding the main file is what strips the metadata. Do not remove these two options.
    resizeOptions: { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
    withMetadata: false,
    imageSizes: [
      { name: 'thumb', width: 480, height: 360, fit: 'cover', formatOptions: { format: 'webp', options: { quality: 78 } } },
      { name: 'card', width: 960, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 80 } } },
    ],
    adminThumbnail: 'thumb',
    crop: false,
    focalPoint: false,
    pasteURL: false,
    bulkUpload: false,
  },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'alt', type: 'text', maxLength: 300, admin: { description: 'Describes the photo for people who cannot see it.' } },
    { name: 'state', type: 'select', required: true, defaultValue: 'pending', index: true, options: ['pending', 'approved', 'rejected', 'withheld', 'removed'] },
    { name: 'rightsConfirmedAt', type: 'date', required: true, admin: { description: 'When the member confirmed they took the photo or have permission to share it.' } },
    { name: 'contribution', type: 'relationship', relationTo: 'contributions', index: true },
    { name: 'purpose', type: 'select', required: true, defaultValue: 'photo', options: ['photo', 'avatar'] },
    // The cloud-storage plugin stores each file's object key here. It adds the same field itself when a
    // bucket is configured; declaring it here keeps the database columns identical with or without one,
    // so a migration made on a laptop without a bucket never drops it.
    { name: '_objectKey', type: 'text', admin: { hidden: true, readOnly: true } },
  ],
}
