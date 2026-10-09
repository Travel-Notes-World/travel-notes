import type { CollectionConfig } from 'payload'

import { administratorOnlyField, hasRole, isAdministrator, ROLES } from '../access/roles'
import { siteUrl } from '../lib/site'

/**
 * Private staff login records (implementation plan §5).
 * Public author profiles live in the separate Authors collection, so staff
 * accounts are never listed or exposed to readers.
 */
/** The staff password-reset email. The link always uses the site's own address, never the request's host. */
export function staffResetEmailHtml(token: string): string {
  const url = `${siteUrl}/admin/reset/${encodeURIComponent(token)}`
  return [
    '<p>Someone asked to reset the password for your Travel Notes CMS staff account.</p>',
    `<p><a href="${url}">Choose a new password</a></p>`,
    `<p>Or paste this address into your browser:<br>${url}</p>`,
    '<p>The link works once and expires in one hour. If you did not ask for this, ignore this email; your password stays the same.</p>',
  ].join('')
}

export const Staff: CollectionConfig = {
  slug: 'staff',
  labels: { singular: 'Staff member', plural: 'Staff' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'active'],
    group: 'Administration',
  },
  auth: {
    tokenExpiration: 60 * 60 * 8, // 8 hours
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15 minutes
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
    forgotPassword: {
      // Payload builds the link from the incoming request, which comes out empty on Vercel and
      // would be untrusted anyway. The fixed public address is used instead.
      generateEmailSubject: () => 'Reset your Travel Notes CMS password',
      generateEmailHTML: (args) => staffResetEmailHtml(String(args?.token ?? '')),
    },
  },
  access: {
    // Suspended accounts cannot use the admin panel.
    admin: ({ req }) => hasRole(req, 'contributor'),
    // The very first account is created through Payload's own first-user screen, which bypasses this rule.
    create: isAdministrator,
    delete: isAdministrator,
    // No enumeration: staff can read and edit their own record only; administrators manage everyone.
    read: ({ req }) => {
      if (hasRole(req, 'administrator')) return true
      if (hasRole(req, 'contributor') && req.user) return { id: { equals: req.user.id } }
      return false
    },
    update: ({ req }) => {
      if (hasRole(req, 'administrator')) return true
      if (hasRole(req, 'contributor') && req.user) return { id: { equals: req.user.id } }
      return false
    },
    unlock: isAdministrator,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // The first account ever created becomes the administrator, otherwise nobody could manage staff.
        if (operation === 'create') {
          const existing = await req.payload.count({ collection: 'staff', req })
          if (existing.totalDocs === 0) {
            data.role = 'administrator'
            data.active = true
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'contributor',
      options: ROLES.map((role) => ({ label: role.charAt(0).toUpperCase() + role.slice(1), value: role })),
      // Only administrators can grant or change roles, including through the API.
      access: { create: administratorOnlyField, update: administratorOnlyField },
      admin: {
        description:
          'Contributor: own drafts. Editor: edits and reviews all content. Publisher: publishes and withdraws. Administrator: manages staff and settings.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      access: { create: administratorOnlyField, update: administratorOnlyField },
      admin: { description: 'Untick to suspend this account without deleting it.' },
    },
    {
      name: 'communityModerator',
      type: 'checkbox',
      defaultValue: false,
      // Only administrators can grant moderation rights. Moderators cannot grant roles.
      access: { create: administratorOnlyField, update: administratorOnlyField },
      admin: { description: 'Tick to let this person moderate the community at /moderation. Administrators can always moderate.' },
    },
  ],
}
