import 'server-only'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { generateExpiredPayloadCookie, generatePayloadCookie } from 'payload'
import { cache } from 'react'

import type { Member } from '../../../payload-types'
import { userCanModerate } from '../../../access/community'
import { cms } from '../db'
import { toActor } from '../members'
import type { MemberActor, StaffActor } from '../types'

export type Viewer = { member: MemberActor | null; staff: StaffActor | null; sessionId: string | null }

/**
 * Who is making this request, read from the CMS session cookie. Cached for the duration of one
 * request only. Reading cookies makes a page dynamic, so this is only called from community
 * pages and actions, never from the shared site layout.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const payload = await cms()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return { member: null, staff: null, sessionId: null }
  const sessionId = (user as unknown as { _sid?: string })._sid ?? null
  if (user.collection === 'members') {
    const doc = user as unknown as Member
    if (doc.status === 'deleted') return { member: null, staff: null, sessionId: null }
    return { member: toActor(doc), staff: null, sessionId }
  }
  if (user.collection === 'staff') {
    const s = user as unknown as { id: string; name?: string; role?: string; active?: boolean; communityModerator?: boolean }
    if (s.active === false) return { member: null, staff: null, sessionId: null }
    return { member: null, staff: { kind: 'staff', id: s.id, name: s.name ?? 'Staff', canModerate: userCanModerate(user), isAdministrator: s.role === 'administrator' }, sessionId }
  }
  return { member: null, staff: null, sessionId: null }
})

/** The signed-in member, or a redirect to sign-in that comes back to `returnTo` afterwards. */
export async function requireMemberPage(returnTo: string): Promise<MemberActor> {
  const { member } = await getViewer()
  if (!member) redirect(`/account/sign-in?next=${encodeURIComponent(returnTo)}`)
  return member
}

/** Staff who can moderate. Anyone else gets "not found", so the console's existence is not advertised. */
export async function requireModeratorPage(): Promise<StaffActor> {
  const { staff } = await getViewer()
  if (!staff?.canModerate) {
    const { notFound } = await import('next/navigation')
    notFound()
  }
  return staff!
}

const authConfig = async () => {
  const payload = await cms()
  return { collectionAuthConfig: payload.collections.members.config.auth, cookiePrefix: payload.config.cookiePrefix }
}

/** Store the session token the CMS issued at sign-in. httpOnly, SameSite=Lax, Secure in production. */
export async function setSessionCookie(token: string): Promise<void> {
  const cookie = generatePayloadCookie({ ...(await authConfig()), token, returnCookieAsObject: true })
  const store = await cookies()
  store.set(cookie.name, cookie.value ?? '', {
    httpOnly: true,
    path: cookie.path ?? '/',
    sameSite: 'lax',
    secure: Boolean(cookie.secure),
    expires: cookie.expires ? new Date(cookie.expires) : undefined,
    domain: cookie.domain,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookie = generateExpiredPayloadCookie({ ...(await authConfig()), returnCookieAsObject: true })
  const store = await cookies()
  store.set(cookie.name, '', { httpOnly: true, path: cookie.path ?? '/', sameSite: 'lax', secure: Boolean(cookie.secure), expires: new Date(0), domain: cookie.domain })
}

/** The visitor's network address, used only (hashed) as a rate-limit key. */
export async function clientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

export { safeReturnPath } from '../paths'
