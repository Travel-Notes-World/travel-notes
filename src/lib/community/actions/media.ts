'use server'

import { LIMITS } from '../constants'
import { invalid } from '../errors'
import { removeOwnPhoto, uploadPhoto } from '../media'
import { str, toState, type ActionState } from '../next/forms'
import { getViewer } from '../next/session'

/**
 * Upload one photo for a post the member is writing. The service checks the real image data,
 * strips camera metadata (including GPS) and keeps the photo private until a moderator approves
 * the post. The photo is attached to the post when the draft is next saved.
 */
export async function uploadPhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const file = form.get('file')
    if (!(file instanceof Blob) || file.size === 0) invalid({ file: 'Choose a photo to upload.' })
    const blob = file as Blob
    // Checked before reading the data into memory; the service checks again.
    if (blob.size > LIMITS.uploadMaxBytes) invalid({ file: `The photo is too large. The limit is ${Math.round(LIMITS.uploadMaxBytes / 1024 / 1024)} MB.` })
    const data = Buffer.from(await blob.arrayBuffer())
    const photo = await uploadPhoto(member!, { data, alt: str(form, 'alt'), rightsConfirmed: str(form, 'rights') })
    return { ok: true, message: 'Photo added. It appears publicly only after a moderator approves your post.', data: { photo } }
  } catch (error) {
    return toState(error)
  }
}

/** Take one of the member's own photos out of use. A photo in a published post is refused by the service. */
export async function removePhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await removeOwnPhoto(member!, str(form, 'id'))
    return { ok: true, message: 'Photo removed.' }
  } catch (error) {
    return toState(error)
  }
}
