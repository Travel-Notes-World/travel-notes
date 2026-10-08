import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { hasRole } from './roles'

/**
 * Community permissions.
 *
 * Members never write to community collections through Payload's access rules. Every member
 * action goes through the service functions in src/lib/community, which check the session, the
 * account status and ownership and then write as trusted server code. The rules below therefore
 * only decide what can be READ through the REST API and the admin panel, and they deny all writes.
 * A member who sends a crafted REST request with a valid session cookie can change nothing.
 */

type StaffLike = { collection?: string; role?: string | null; active?: boolean | null; communityModerator?: boolean | null }

/** Staff who may moderate the community: administrators, and staff with the moderator tick. */
export const userCanModerate = (user: unknown): boolean => {
  const u = user as StaffLike | null | undefined
  if (!u || u.collection !== 'staff' || u.active === false) return false
  return u.role === 'administrator' || u.communityModerator === true
}

export const canModerate = (req: PayloadRequest): boolean => userCanModerate(req.user)

export const isModerator: Access = ({ req }) => canModerate(req)
export const moderatorOnlyField: FieldAccess = ({ req }) => canModerate(req)
export const isCommunityAdministrator: Access = ({ req }) => hasRole(req, 'administrator')

/** Nobody writes through the API. Trusted service code uses the Local API with overrideAccess. */
export const nobody: Access = () => false

/** Hide a collection from staff who do not moderate. */
export const hiddenUnlessModerator = ({ user }: { user: unknown }): boolean => !userCanModerate(user)

export const isMemberRequest = (req: PayloadRequest): boolean => Boolean(req.user && req.user.collection === 'members')

/** A request that arrived through Payload's REST API (as opposed to trusted server code). */
export const isRestRequest = (req: PayloadRequest): boolean => req.payloadAPI === 'REST'

/** A request for an uploaded file's address (…/file/<name>), which still has to work for public photos. */
export const isFileRequest = (req: PayloadRequest): boolean => {
  try {
    return new URL(req.url ?? '', 'http://local.invalid').pathname.includes('/file/')
  } catch {
    return false
  }
}

/**
 * Moderators read everything. The website's own pages read approved rows only (through trusted
 * server code that shapes what is shown). The raw REST API is closed to everyone else: it would
 * otherwise return fields the pages deliberately hide (author ids of deleted members, moderator
 * notes) and replies under threads that moderators have taken down.
 */
export const publishedOrModerator: Access = ({ req }) => {
  if (canModerate(req)) return true
  if (isRestRequest(req)) return false
  return { state: { equals: 'published' } }
}

/** A read-only, moderator-only collection. */
export const moderatorReadOnly = { read: isModerator, create: nobody, update: nobody, delete: nobody } as const

/** Private to the member: no one reads it through the API or the admin panel. Service code shows it to its owner only. */
export const ownerOnlyPrivate = { read: nobody, create: nobody, update: nobody, delete: nobody } as const
