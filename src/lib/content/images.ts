import type { StaticImageData } from 'next/image'
import media from '@/content/data/images.json'
import tasmania from '@/content/images/tasmania.jpg'

/** A Wikimedia Commons photo, served from this site and always shown with its author and licence. */
export type CommonsImage = { file: string; src: StaticImageData; author: string; license: string; licenseUrl: string; alt: string }

type ImageKey = keyof typeof media.images
type LicenseKey = keyof typeof media.licenses

/**
 * The photo files, copied from Commons into src/content/images (2000 px wide) so the page does not wait on
 * Wikimedia's redirects. Every key in images.json needs a file here, or the build fails.
 */
const FILES: Record<ImageKey, StaticImageData> = { tasmania }

const IMAGES = Object.fromEntries(
  Object.entries(media.images).map(([key, { license, ...rest }]) => [key, { ...rest, src: FILES[key as ImageKey], ...media.licenses[license as LicenseKey] }]),
) as Record<ImageKey, CommonsImage>

/** Looks up a licensed image by its key in src/content/data/images.json; an unknown key fails the build, not the page. */
export const licensedImage = (key: string): CommonsImage => {
  if (!(key in IMAGES)) throw new Error(`Unknown image "${key}" in src/content/data/images.json`)
  return IMAGES[key as ImageKey]
}
