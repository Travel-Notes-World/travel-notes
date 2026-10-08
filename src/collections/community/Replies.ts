import type { CollectionConfig } from 'payload'

import { hiddenUnlessModerator, moderatorOnlyField, nobody, publishedOrModerator } from '../../access/community'
import { REPLY_STATES } from '../../lib/community/constants'

/**
 * Answers and replies. A reply with no parent on a question is an answer.
 * A reply to a reply is allowed one level deep only.
 * New replies wait for review; only approved replies are public.
 */
export const Replies: CollectionConfig = {
  slug: 'replies',
  admin: { group: 'Community (read-only, moderate at /moderation)', defaultColumns: ['contribution', 'author', 'state', 'createdAt'], hidden: hiddenUnlessModerator },
  access: { read: publishedOrModerator, create: nobody, update: nobody, delete: nobody },
  indexes: [{ fields: ['contribution', 'state', 'createdAt'] }, { fields: ['state', 'createdAt'] }, { fields: ['author', 'state'] }],
  fields: [
    { name: 'contribution', type: 'relationship', relationTo: 'contributions', required: true, index: true },
    { name: 'parent', type: 'relationship', relationTo: 'replies' },
    { name: 'author', type: 'relationship', relationTo: 'members', required: true, index: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'state', type: 'select', required: true, defaultValue: 'pending', index: true, options: REPLY_STATES.map(({ value, label }) => ({ value, label })) },
    { name: 'publishedAt', type: 'date' },
    { name: 'moderationNote', type: 'textarea', admin: { description: 'Reason shown to the author.' } },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'staff', access: { read: moderatorOnlyField } },
    { name: 'helpfulCount', type: 'number', defaultValue: 0 },
  ],
}
