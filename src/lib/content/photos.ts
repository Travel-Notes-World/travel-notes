import type { Payload } from 'payload'

import type { Image } from '@/payload-types'

/** An editorial photo ready to show: the sizes to choose from and the credit line. */
export type Photo = {
  src: string
  /** "url 480w, url 960w, ..." from the stored sizes, smallest first. */
  srcSet: string
  width: number
  height: number
  alt: string
  caption: string | null
  credit: string
  licence: Image['licence']
  licenceUrl: string | null
  sourceUrl: string | null
  /** Focal point in percent, for object-position when the photo is cropped. */
  focus: { x: number; y: number }
}

const SIZE_ORDER = ['thumb', 'card', 'large'] as const

/** Turn a stored editorial photo into what the page needs. A photo without a file is skipped. */
export function toPhoto(img: Image | null | undefined): Photo | null {
  if (!img?.url || !img.width || !img.height) return null
  const candidates = [
    // The thumbnail is cropped to 3:2, so it is only offered when the original has the same shape.
    ...SIZE_ORDER.map((name) => img.sizes?.[name]).filter((s, i) => s?.url && s.width && (i > 0 || Math.abs((s.height ?? 0) / s.width - img.height! / img.width!) < 0.02)),
    { url: img.url, width: img.width },
  ] as { url: string; width: number }[]
  const seen = new Set<number>()
  const srcSet = candidates
    .filter((c) => c.url && c.width && !seen.has(c.width) && seen.add(c.width))
    .sort((a, b) => a.width - b.width)
    .map((c) => `${c.url} ${c.width}w`)
    .join(', ')
  const pct = (v: number | null | undefined) => (typeof v === 'number' && v >= 0 && v <= 100 ? v : 50)
  return {
    src: img.sizes?.large?.url || img.url,
    srcSet,
    width: img.width,
    height: img.height,
    alt: img.alt,
    caption: img.caption || null,
    credit: img.credit,
    licence: img.licence,
    licenceUrl: img.licenceUrl || null,
    sourceUrl: img.sourceUrl || null,
    focus: { x: pct(img.focalX), y: pct(img.focalY) },
  }
}

/** Load editorial photos by id in one query. */
export async function photosByIds(payload: Payload, ids: (string | null)[]): Promise<Map<string, Photo>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (!wanted.length) return new Map()
  const found = await payload.find({ collection: 'images', where: { id: { in: wanted } }, limit: wanted.length, depth: 0, overrideAccess: false })
  const out = new Map<string, Photo>()
  for (const img of found.docs) {
    const photo = toPhoto(img)
    if (photo) out.set(img.id, photo)
  }
  return out
}

