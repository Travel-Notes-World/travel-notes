import { EMAIL_CATEGORIES, type EmailCategory } from './constants'
import { cms } from './db'
import { fail } from './errors'
import type { MemberActor } from './types'

export type OwnAccount = {
  handle: string
  displayName: string
  bio: string
  experience: string
  /** Shown only to the member on their own settings page. */
  email: string
  emailPrefs: Record<EmailCategory, boolean>
  status: 'active' | 'suspended' | 'deleted'
  statusReason: string
  suspendedUntil: string | null
  /** True while a suspension is in force (an end date in the past means it has ended). */
  suspendedNow: boolean
  createdAt: string
}

/**
 * The signed-in member's own account details for the settings page. Reads by the session's
 * member id only, so it can never return someone else's account. Security fields are not selected.
 */
export async function getOwnAccount(actor: MemberActor): Promise<OwnAccount> {
  if (!actor || actor.kind !== 'member') fail('auth', 'Please sign in to continue.')
  const payload = await cms()
  const doc = await payload.findByID({ collection: 'members', id: actor.id, depth: 0, disableErrors: true })
  if (!doc || doc.status === 'deleted') return fail('auth', 'Please sign in to continue.')
  const prefs = doc.emailPrefs ?? {}
  return {
    handle: doc.handle,
    displayName: doc.displayName,
    bio: doc.bio ?? '',
    experience: doc.experience ?? '',
    email: doc.email,
    // Match how sending decides: the digest goes only to members who switched it on; the other
    // categories are sent unless switched off (see email/outbox.ts and digest.ts).
    emailPrefs: Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c, c === 'digest' ? prefs[c] === true : prefs[c] !== false])) as Record<EmailCategory, boolean>,
    status: doc.status,
    statusReason: doc.statusReason ?? '',
    suspendedUntil: doc.suspendedUntil ?? null,
    suspendedNow: doc.status === 'suspended' && (!doc.suspendedUntil || new Date(doc.suspendedUntil).getTime() > Date.now()),
    createdAt: doc.createdAt,
  }
}
