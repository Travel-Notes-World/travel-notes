import sharp from 'sharp'

import { LIMITS } from './constants'
import { cms, relId, run, sql } from './db'
import { isUuid } from './destinations'
import { fail, invalid } from './errors'
import { newShortId } from './ids'
import { requireActive } from './members'
import { limit } from './ratelimit'
import { assertSubmissionsOpen } from './settings'
import { ensureLocalFolder, uploadsAvailable } from './storage'
import { cleanLine } from './text'
import type { MemberActor } from './types'

const ALLOWED = new Map([['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']])

export type UploadInput = { data: Buffer; alt: unknown; rightsConfirmed: unknown }
export type UploadedPhoto = { id: string; thumbUrl: string; alt: string }

/**
 * Store one photo from a member.
 *
 * - Refused outright when photo storage is not configured, instead of pretending to work.
 * - The real image data is inspected: the browser's file name and declared type are ignored, and
 *   anything that is not a JPEG, PNG or WebP image is rejected.
 * - Size and pixel count are capped before any heavy processing.
 * - The stored files are re-encoded copies with all camera metadata (including GPS) removed, under
 *   a random name, so nothing from the original file name is kept either.
 * - The photo starts as "pending": only its owner and moderators can open it until it is approved.
 */
export async function uploadPhoto(actor: MemberActor, input: UploadInput): Promise<UploadedPhoto> {
  const member = await requireActive(actor)
  await assertSubmissionsOpen()
  if (!uploadsAvailable()) fail('unavailable', 'Photo uploads are not available yet. You can submit without photos and add them later.')
  ensureLocalFolder()
  await limit('upload', member.id)
  if (input.rightsConfirmed !== true && input.rightsConfirmed !== 'on') invalid({ rights: 'Please confirm that you took this photo or have permission to share it.' })
  const alt = cleanLine(input.alt, 300)
  if (alt.length < 3) invalid({ alt: 'Describe the photo in a few words for people who cannot see it.' })
  const data = input.data
  if (!Buffer.isBuffer(data) || data.length === 0) invalid({ file: 'Choose a photo to upload.' })
  if (data.length > LIMITS.uploadMaxBytes) invalid({ file: `The photo is too large. The limit is ${Math.round(LIMITS.uploadMaxBytes / 1024 / 1024)} MB.` })

  let format: string | undefined
  let width = 0
  let height = 0
  try {
    // limitInputPixels makes sharp refuse a "decompression bomb" before decoding it.
    const meta = await sharp(data, { limitInputPixels: LIMITS.uploadMaxPixels, failOn: 'error' }).metadata()
    format = meta.format
    width = meta.width ?? 0
    height = meta.height ?? 0
    // Animated images are refused: every frame would be decoded when the photo is re-encoded.
    if ((meta.pages ?? 1) > 1) format = undefined
  } catch {
    invalid({ file: 'That file is not a photo we can read. Upload a JPEG, PNG or WebP image.' })
  }
  const mimetype = format ? ALLOWED.get(format) : undefined
  if (!mimetype) return invalid({ file: 'Upload a JPEG, PNG or WebP image.' })
  if (width < 200 || height < 200) invalid({ file: 'The photo is too small. Use an image at least 200 pixels wide and tall.' })

  const payload = await cms()
  const open = await payload.count({ collection: 'media', where: { and: [{ owner: { equals: member.id } }, { state: { equals: 'pending' } }, { contribution: { exists: false } }] } })
  if (open.totalDocs >= LIMITS.maxPhotos * 2) fail('conflict', 'You have several uploaded photos that are not attached to a post yet. Use or remove those first.')
  const name = `${newShortId(16)}.${format === 'jpeg' ? 'jpg' : format}`
  try {
    const doc = await payload.create({
      collection: 'media',
      data: { owner: member.id, alt, state: 'pending', rightsConfirmedAt: new Date().toISOString(), purpose: 'photo' },
      file: { data, mimetype, name, size: data.length },
    })
    return { id: doc.id, thumbUrl: doc.sizes?.thumb?.url ?? doc.url ?? '', alt }
  } catch (error) {
    payload.logger.error({ err: error }, '[community] photo upload failed')
    return fail('unavailable', 'The photo could not be saved. Please try again.')
  }
}

/** The member removes one of their own photos that is not part of a published post. */
export async function removeOwnPhoto(actor: MemberActor, id: unknown): Promise<{ ok: true }> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  if (!isUuid(id)) fail('not_found', 'That photo could not be found.')
  const payload = await cms()
  const media = await payload.findByID({ collection: 'media', id: id as string, depth: 0, disableErrors: true })
  if (!media || relId(media.owner) !== actor.id) return fail('not_found', 'That photo could not be found.')
  if (media.state === 'approved') fail('conflict', 'This photo is part of a published post. Edit the post to take it out.')
  await payload.update({ collection: 'media', id: media.id, data: { state: 'removed' } })
  return { ok: true }
}

/** The member's own photos that can be attached to the post being edited: its current ones and unattached uploads. */
export async function ownPhotos(actor: MemberActor, ids: string[]): Promise<UploadedPhoto[]> {
  const valid = ids.filter(isUuid)
  if (!valid.length) return []
  const payload = await cms()
  const found = await payload.find({ collection: 'media', where: { and: [{ id: { in: valid } }, { owner: { equals: actor.id } }, { state: { in: ['pending', 'approved'] } }] }, limit: valid.length, pagination: false, depth: 0 })
  const byId = new Map(found.docs.map((m) => [m.id, { id: m.id, thumbUrl: m.sizes?.thumb?.url ?? m.url ?? '', alt: m.alt ?? '' }]))
  return valid.map((id) => byId.get(id)).filter((p): p is UploadedPhoto => Boolean(p))
}

/**
 * Scheduled job: delete photo files that will never be shown.
 * - uploads never attached to a post, after two days;
 * - photos marked removed or rejected, after seven days (kept briefly in case of a mistake or dispute).
 * Deleting the record also deletes its files from storage. Safe to run repeatedly.
 */
export async function cleanupPhotos(now = new Date()): Promise<number> {
  const payload = await cms()
  const twoDays = new Date(now.getTime() - 2 * 86_400_000).toISOString()
  const sevenDays = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const stale = await payload.find({
    collection: 'media',
    where: { or: [{ and: [{ state: { equals: 'pending' } }, { contribution: { exists: false } }, { createdAt: { less_than: twoDays } }] }, { and: [{ state: { in: ['removed', 'rejected'] } }, { updatedAt: { less_than: sevenDays } }] }] },
    limit: 200, pagination: false, depth: 0, select: {},
  })
  let deleted = 0
  for (const doc of stale.docs) {
    try {
      await run(payload, sql`DELETE FROM "contributions_rels" WHERE "media_id" = ${doc.id}::uuid`)
      await payload.delete({ collection: 'media', id: doc.id })
      deleted++
    } catch (error) {
      payload.logger.error({ err: error }, '[community] could not delete a stale photo')
    }
  }
  return deleted
}
