import type { PayloadRequest } from 'payload'

import { targetPath, validFrom } from './rules'

/**
 * Automatic redirect rules, kept in step with published articles and topics:
 * - a published address changes  → a permanent redirect from the old address to the new one;
 * - content is published at an address → automatic or "gone" rules for that address are removed;
 * - published content is deleted  → the address is marked gone (410).
 *
 * A failure here is logged and never blocks the editor's save: losing one automatic redirect is
 * better than refusing to publish.
 */

const rulesFrom = (req: PayloadRequest, from: string) =>
  req.payload.find({ collection: 'redirects', where: { from: { equals: from } }, limit: 1, depth: 0, req }).then((r) => r.docs[0] ?? null)

async function guarded(req: PayloadRequest, label: string, task: () => Promise<void>) {
  try {
    await task()
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `[redirects] ${label} failed` })
  }
}

/** Content is live at this address: it must not be redirected away or reported as gone. */
export const addressLive = (req: PayloadRequest, path: string, previousPath?: string) =>
  guarded(req, `clearing rules for ${path}`, async () => {
    const from = validFrom(path)
    const rule = from ? await rulesFrom(req, from) : null
    if (!rule) return
    // An editor's manual redirect stays, unless it points back at the address being left (a loop).
    const loops = previousPath && targetPath(rule.to ?? '') === validFrom(previousPath)
    if (rule.source === 'automatic' || rule.type === 'gone' || loops) await req.payload.delete({ collection: 'redirects', id: rule.id, req })
  })

/** A published address changed: send the old one to the new one, permanently. */
export const addressChanged = (req: PayloadRequest, oldPath: string, newPath: string) =>
  guarded(req, `redirecting ${oldPath}`, async () => {
    const from = validFrom(oldPath)
    if (!from || from === validFrom(newPath)) return
    await addressLive(req, newPath, oldPath)
    const existing = await rulesFrom(req, from)
    const data = { from, to: newPath, type: 'permanent' as const, source: 'automatic' as const }
    if (existing) await req.payload.update({ collection: 'redirects', id: existing.id, data, req })
    else await req.payload.create({ collection: 'redirects', data, req })
  })

/**
 * Called after an article or topic is published. If it was published before under another slug,
 * the old address is redirected to the new one; otherwise its address is simply marked live.
 *
 * The previous public slug comes from version history, not `previousDoc`: when a draft is
 * published, `previousDoc` is that draft, which may already carry the new slug.
 */
export async function published(req: PayloadRequest, collection: 'articles' | 'topics' | 'travel-updates', doc: { id: string; slug: string }, prefix: string) {
  let previousSlug: string | undefined
  try {
    const versions = await req.payload.findVersions({
      collection,
      where: { and: [{ parent: { equals: doc.id } }, { 'version._status': { equals: 'published' } }] },
      sort: '-createdAt',
      limit: 2,
      depth: 0,
      req,
    })
    // The newest published version may already be this save; the one before it is what readers saw.
    previousSlug = versions.docs.map((v) => (v.version as { slug?: string }).slug).find((s) => s && s !== doc.slug)
  } catch (error) {
    req.payload.logger.error({ err: error, msg: '[redirects] version history could not be read' })
  }
  if (previousSlug) await addressChanged(req, `${prefix}${previousSlug}`, `${prefix}${doc.slug}`)
  else await addressLive(req, `${prefix}${doc.slug}`)
}

/** Published content was deleted: its address is gone (410), unless an editor already redirects it. */
export const addressGone = (req: PayloadRequest, path: string) =>
  guarded(req, `marking ${path} gone`, async () => {
    const from = validFrom(path)
    if (!from) return
    const existing = await rulesFrom(req, from)
    if (existing?.source === 'manual') return
    const data = { from, to: null, type: 'gone' as const, source: 'automatic' as const }
    if (existing) await req.payload.update({ collection: 'redirects', id: existing.id, data, req })
    else await req.payload.create({ collection: 'redirects', data, req })
  })
