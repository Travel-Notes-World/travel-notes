import type { CollectionConfig } from 'payload'

import { canModerate, hiddenUnlessModerator, isMemberRequest, nobody } from '../../access/community'
import { MEMBER_STATUSES } from '../../lib/community/constants'

/**
 * Community member accounts. Separate from staff logins and from editorial author profiles.
 *
 * Passwords, sessions, email verification and reset tokens are handled by Payload's own
 * authentication. Sign-up, sign-in and every profile change go through src/lib/community/members.ts.
 * The REST endpoints for this collection are switched off, so the only way in is that reviewed code.
 *
 * Email verification confirms that the address works. It does not confirm identity or expertise.
 */
export const Members: CollectionConfig = {
  slug: 'members',
  labels: { singular: 'Member', plural: 'Members' },
  admin: {
    group: 'Community (read-only, moderate at /moderation)',
    useAsTitle: 'handle',
    defaultColumns: ['handle', 'displayName', 'email', 'status', 'createdAt'],
    hidden: hiddenUnlessModerator,
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 14, // 14 days
    verify: true,
    // 0 turns off the CMS's own lock: a lock would let anyone shut a member out and would reveal
    // which addresses have accounts. Sign-in attempts are limited in src/lib/community/ratelimit.ts.
    maxLoginAttempts: 0,
    lockTime: 15 * 60 * 1000,
    forgotPassword: { expiration: 60 * 60 * 1000 },
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  endpoints: false,
  access: {
    // Moderators see accounts; a member can load only their own record. The public reads nothing here.
    read: ({ req }) => {
      if (canModerate(req)) return true
      if (isMemberRequest(req) && req.user) return { id: { equals: req.user.id } }
      return false
    },
    create: nobody,
    update: nobody,
    delete: nobody,
    unlock: nobody,
    admin: () => false,
  },
  fields: [
    { name: 'handle', type: 'text', required: true, unique: true, index: true, maxLength: 30, admin: { description: 'Public name in addresses: /travellers/handle.' } },
    { name: 'displayName', type: 'text', required: true, maxLength: 60 },
    { name: 'bio', type: 'textarea', maxLength: 500 },
    { name: 'experience', type: 'text', maxLength: 200, admin: { description: 'Self-declared by the member. Not checked by Travel Notes.' } },
    { name: 'avatar', type: 'relationship', relationTo: 'media' },
    { name: 'status', type: 'select', required: true, defaultValue: 'active', index: true, options: MEMBER_STATUSES.map(({ value, label }) => ({ value, label })) },
    { name: 'statusReason', type: 'textarea', admin: { description: 'Shown to the member when the account is suspended.' } },
    { name: 'suspendedUntil', type: 'date', admin: { description: 'Empty means until a moderator lifts it.' } },
    { name: 'trusted', type: 'checkbox', defaultValue: false, admin: { description: 'Set by a moderator, never automatically. Only matters if lighter review is switched on in Community settings.' } },
    { name: 'termsAcceptedAt', type: 'date' },
    {
      name: 'emailPrefs',
      type: 'group',
      admin: { description: 'Sign-in and security email is always sent. Everything else is the member’s choice.' },
      fields: [
        { name: 'replies', type: 'checkbox', defaultValue: true },
        { name: 'moderation', type: 'checkbox', defaultValue: true },
        { name: 'events', type: 'checkbox', defaultValue: true },
        { name: 'digest', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'lastDigestAt', type: 'date' },
    { name: 'publishedCount', type: 'number', defaultValue: 0, admin: { description: 'Approved contributions.' } },
    { name: 'answerCount', type: 'number', defaultValue: 0, admin: { description: 'Approved replies.' } },
    { name: 'deletedAt', type: 'date' },
  ],
}
