import type { CollectionConfig, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

import { isEditor, isPublisher } from '../access/roles'
import { targetPath, validFrom, validTo } from '../lib/redirects/rules'

/**
 * Redirects: an old address sent permanently (308) or temporarily (307) to a new one, or marked as
 * gone (410). Served by src/proxy.ts before any page runs. Paths are normalised on save the same way
 * they are matched (lower case, no trailing slash).
 *
 * Every rule is one step. Saving A → B when B → C exists stores A → C, and rules that pointed at A
 * are moved on to the new target. A rule that would lead back to its own address is refused.
 * Automatic rules are created when a published article or topic changes its address or is deleted.
 */
const fail = (path: string, message: string): never => {
  throw new ValidationError({ collection: 'redirects', errors: [{ path, message }] })
}

async function ruleFrom(req: PayloadRequest, from: string, excludeId?: string | number) {
  const found = await req.payload.find({
    collection: 'redirects',
    where: excludeId ? { and: [{ from: { equals: from } }, { id: { not_equals: excludeId } }] } : { from: { equals: from } },
    limit: 1,
    depth: 0,
    req,
  })
  return found.docs[0] ?? null
}

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'type', 'source', 'updatedAt'],
    group: 'Editorial',
    description: 'Send an old address to a new one, or mark it as gone. Changes are live within about a minute.',
  },
  access: {
    read: isEditor,
    create: isEditor,
    update: isEditor,
    delete: isPublisher,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (typeof data.from === 'string') data.from = validFrom(data.from) ?? data.from
        if (typeof data.to === 'string' && data.to.trim()) data.to = validTo(data.to) ?? data.to
        if (data.type === 'gone') data.to = null
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const from: string = data.from ?? originalDoc?.from
        const type = data.type ?? originalDoc?.type
        if (type === 'gone') return data
        let to: string | null = data.to ?? originalDoc?.to ?? null
        if (!to) fail('to', 'Enter where this address should go.')
        // One step only: if the target itself redirects, point straight at its final target.
        const next = targetPath(to as string)
        if (next) {
          const onward = await ruleFrom(req, next, originalDoc?.id)
          if (onward?.type === 'gone') fail('to', 'That address is marked as gone. Choose a page that exists.')
          if (onward?.to) to = onward.to
        }
        if (targetPath(to as string) === from) fail('to', 'This would send the address back to itself.')
        data.to = to
        return data
      },
    ],
    afterChange: [
      // Rules that pointed at this address now point at its target, so no chain is ever two steps.
      async ({ doc, req, context }) => {
        if (context.skipRetarget) return doc
        const pointing = await req.payload.find({
          collection: 'redirects',
          where: { or: [{ to: { equals: doc.from } }, { to: { like: `${doc.from}?` } }] },
          limit: 0,
          pagination: false,
          depth: 0,
          req,
        })
        for (const rule of pointing.docs) {
          if (rule.id === doc.id || targetPath(rule.to ?? '') !== doc.from) continue
          if (doc.type === 'gone' || targetPath(doc.to ?? '') === rule.from) {
            // Pointing at a gone address, or it would loop: the old address is gone too.
            await req.payload.update({ collection: 'redirects', id: rule.id, data: { type: 'gone', to: null }, req, context: { skipRetarget: true } })
          } else {
            await req.payload.update({ collection: 'redirects', id: rule.id, data: { to: doc.to }, req, context: { skipRetarget: true } })
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: string | null | undefined) =>
        value && validFrom(value) === value ? true : 'Enter a site address starting with "/", for example /stories/old-name. Not /admin, /api or the homepage.',
      admin: { description: 'The old address, for example /stories/old-name. Saved in lower case without a trailing slash.' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'permanent',
      options: [
        { label: 'Permanent (308)', value: 'permanent' },
        { label: 'Temporary (307)', value: 'temporary' },
        { label: 'Gone (410): the page was removed for good', value: 'gone' },
      ],
    },
    {
      name: 'to',
      type: 'text',
      validate: (value: string | null | undefined, { siblingData }: { siblingData: { type?: string } }) => {
        if (siblingData?.type === 'gone') return true
        if (!value) return 'Enter where this address should go.'
        return validTo(value) === value ? true : 'Enter a site address starting with "/" or a full https:// address.'
      },
      admin: {
        description: 'The new address: a site address such as /stories/new-name, or a full https:// address.',
        condition: (_, siblingData) => siblingData?.type !== 'gone',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Added by an editor', value: 'manual' },
        { label: 'Automatic (address change or deletion)', value: 'automatic' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'note', type: 'textarea', admin: { description: 'Optional. Why this redirect exists.' } },
  ],
}
