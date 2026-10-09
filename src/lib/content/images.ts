import media from '@/content/data/images.json'

/** A Wikimedia Commons photo, always shown with its author and licence. */
export type CommonsImage = { file: string; author: string; license: string; licenseUrl: string; alt: string }

type ImageKey = keyof typeof media.images
type LicenseKey = keyof typeof media.licenses

const IMAGES = Object.fromEntries(
  Object.entries(media.images).map(([key, { license, ...rest }]) => [key, { ...rest, ...media.licenses[license as LicenseKey] }]),
) as Record<ImageKey, CommonsImage>

/** Looks up a licensed image by its key in src/content/data/images.json; an unknown key fails the build, not the page. */
export const licensedImage = (key: string): CommonsImage => {
  if (!(key in IMAGES)) throw new Error(`Unknown image "${key}" in src/content/data/images.json`)
  return IMAGES[key as ImageKey]
}
