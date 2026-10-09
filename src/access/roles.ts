import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { staffSecondStepDone } from './twoFactor'

/**
 * Editorial roles, lowest to highest (implementation plan §5).
 * contributor: edits own drafts.
 * editor: edits and reviews all editorial content.
 * publisher: publishes, schedules and withdraws.
 * administrator: manages staff and configuration.
 */
export const ROLES = ['contributor', 'editor', 'publisher', 'administrator'] as const
export type Role = (typeof ROLES)[number]

type StaffUser = { id: string; role?: Role | null; active?: boolean | null }

/** The signed-in staff member, only once they have also passed the two-step login (see ./twoFactor). */
const staffUser = (req: PayloadRequest): StaffUser | null =>
  req.user && req.user.collection === 'staff' && staffSecondStepDone(req.user) ? (req.user as unknown as StaffUser) : null

/** An active staff account that has signed in with its password, whether or not it has entered its code yet. */
export const isSignedInStaff = (req: PayloadRequest): boolean =>
  Boolean(req.user && req.user.collection === 'staff' && (req.user as unknown as StaffUser).active !== false)

/** True when the request comes from an active staff member whose role is at least `min`. */
export const hasRole = (req: PayloadRequest, min: Role): boolean => {
  const user = staffUser(req)
  if (!user || user.active === false || !user.role) return false
  return ROLES.indexOf(user.role) >= ROLES.indexOf(min)
}

export const isStaff: Access = ({ req }) => hasRole(req, 'contributor')
export const isEditor: Access = ({ req }) => hasRole(req, 'editor')
export const isPublisher: Access = ({ req }) => hasRole(req, 'publisher')
export const isAdministrator: Access = ({ req }) => hasRole(req, 'administrator')

export const staffOnlyField: FieldAccess = ({ req }) => hasRole(req, 'contributor')
export const administratorOnlyField: FieldAccess = ({ req }) => hasRole(req, 'administrator')
export const nobodyField: FieldAccess = () => false

/** Public visitors see published documents only; any active staff member sees everything. */
export const publishedOrStaff: Access = ({ req }) => {
  if (hasRole(req, 'contributor')) return true
  return { _status: { equals: 'published' } }
}
