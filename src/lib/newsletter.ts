import { createHash, randomBytes } from 'node:crypto'

import { cms } from './community/db'
import { emailMode, sendEmail } from './community/email/transport'
import { invalid } from './community/errors'
import { hashSubject, limit } from './community/ratelimit'
import { siteUrl } from './site'

/**
 * The weekly newsletter sign-up (double opt-in).
 *
 * 1. requestSubscription: validate, rate-limit, store a "pending" row with a hashed one-time token,
 *    and email a confirmation link. The visitor always sees the same answer, whether or not the
 *    address is already on the list, so the form cannot be used to find out who subscribed.
 * 2. confirmSubscription: called from a button on the confirmation page (not by simply opening the
 *    link, because email scanners open links). Marks the row "confirmed" and copies the address to
 *    the Resend segment the newsletter is sent to.
 * 3. syncPendingSubscribers (daily job): retries copies to Resend that failed or were waiting for
 *    the Resend settings.
 *
 * Resend needs a FULL-ACCESS key for contacts (the site's normal key can only send), so it uses its
 * own variable: RESEND_CONTACTS_API_KEY, plus RESEND_NEWSLETTER_SEGMENT_ID.
 */

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/
const TOKEN_HOURS = 48
const MAX_SYNC_ATTEMPTS = 6

export const hashToken = (token: string): string => createHash('sha256').update(`tn-newsletter:${token}`).digest('hex')
const newToken = (): string => randomBytes(32).toString('base64url')

const safeSource = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  return path.startsWith('/') && !path.startsWith('//') && path.length <= 200 ? path : undefined
}

export async function requestSubscription(input: { email: unknown; source?: unknown; website?: unknown }, context: { ip: string | null }): Promise<{ ok: true }> {
  // Hidden field filled in: a bot. Same answer as everyone else, nothing stored or sent.
  if (typeof input.website === 'string' && input.website.trim()) return { ok: true }

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email) || email.length > 254) invalid({ email: 'Enter a valid email address.' })

  await limit('newsletter_ip', context.ip ? hashSubject(context.ip) : null)
  await limit('newsletter_email', hashSubject(email))

  const payload = await cms()
  const existing = (await payload.find({ collection: 'newsletter-subscribers', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0]
  // Already confirmed: nothing to do, and the answer gives nothing away.
  if (existing?.status === 'confirmed') return { ok: true }

  const token = newToken()
  const data = {
    email,
    status: 'pending' as const,
    requestedAt: new Date().toISOString(),
    source: safeSource(input.source),
    tokenHash: hashToken(token),
    tokenExpiresAt: new Date(Date.now() + TOKEN_HOURS * 3600_000).toISOString(),
  }
  const saved = existing
    ? await payload.update({ collection: 'newsletter-subscribers', id: existing.id, data, overrideAccess: true })
    : await payload.create({ collection: 'newsletter-subscribers', data: { ...data, syncStatus: 'not-needed', syncAttempts: 0 }, overrideAccess: true })

  const link = `${siteUrl}/newsletter/confirm?token=${encodeURIComponent(token)}`
  const result = await sendEmail({
    to: email,
    subject: 'Confirm your Travel Notes newsletter subscription',
    text: [
      'Please confirm that you want the weekly Travel Notes email.',
      '',
      `Confirm here: ${link}`,
      '',
      `The link works for ${TOKEN_HOURS} hours. If you did not ask for this, ignore this email and you will not be added.`,
    ].join('\n'),
    html: [
      '<p>Please confirm that you want the weekly Travel Notes email: new guides, travel updates and one practical tip.</p>',
      `<p><a href="${link}">Confirm my subscription</a></p>`,
      `<p style="color:#555">The link works for ${TOKEN_HOURS} hours. If you did not ask for this, ignore this email and you will not be added.</p>`,
    ].join(''),
    idempotencyKey: `newsletter-confirm:${saved.id}:${data.tokenHash.slice(0, 16)}`,
  })
  if (!result.ok) console.error('[newsletter] confirmation email failed', result.error)
  return { ok: true }
}

export type ConfirmResult = 'confirmed' | 'already' | 'invalid'

/** Look up a pending sign-up by its token without changing anything (for the confirmation page). */
export async function findPendingByToken(token: unknown): Promise<{ email: string } | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const payload = await cms()
  const row = (await payload.find({ collection: 'newsletter-subscribers', where: { tokenHash: { equals: hashToken(token) } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0]
  if (!row || row.status !== 'pending' || !row.tokenExpiresAt || new Date(row.tokenExpiresAt) < new Date()) return null
  return { email: row.email }
}

export async function confirmSubscription(token: unknown): Promise<ConfirmResult> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return 'invalid'
  const payload = await cms()
  const row = (await payload.find({ collection: 'newsletter-subscribers', where: { tokenHash: { equals: hashToken(token) } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0]
  if (!row) return 'invalid'
  if (row.status === 'confirmed') return 'already'
  if (!row.tokenExpiresAt || new Date(row.tokenExpiresAt) < new Date()) return 'invalid'
  await payload.update({
    collection: 'newsletter-subscribers',
    id: row.id,
    overrideAccess: true,
    data: { status: 'confirmed', confirmedAt: new Date().toISOString(), tokenHash: null, tokenExpiresAt: null, syncStatus: 'pending', syncAttempts: 0, syncError: null },
  })
  await syncSubscriber(String(row.id)).catch((error) => console.error('[newsletter] copy to Resend failed', error))
  return 'confirmed'
}

type ResendCall = { ok: true } | { ok: false; status: number; error: string }

async function resend(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<ResendCall> {
  try {
    const response = await fetch(`https://api.resend.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${process.env.RESEND_CONTACTS_API_KEY}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return { ok: true }
    return { ok: false, status: response.status, error: (await response.text().catch(() => '')).slice(0, 300) }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Network error' }
  }
}

/**
 * Copy one confirmed subscriber to Resend: create the contact (or, if it exists, make sure it is
 * subscribed again, since they have just confirmed), then add it to the newsletter segment.
 */
export async function syncSubscriber(id: string): Promise<'synced' | 'pending' | 'failed' | 'skipped'> {
  const payload = await cms()
  const row = await payload.findByID({ collection: 'newsletter-subscribers', id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!row || row.status !== 'confirmed' || row.syncStatus === 'synced') return 'skipped'

  const record = (status: 'synced' | 'pending' | 'failed', error: string | null, countAttempt: boolean) =>
    payload.update({
      collection: 'newsletter-subscribers',
      id,
      overrideAccess: true,
      data: { syncStatus: status, syncError: error, syncAttempts: (row.syncAttempts ?? 0) + (countAttempt ? 1 : 0) },
    })

  const segment = (process.env.RESEND_NEWSLETTER_SEGMENT_ID || '').trim()
  if (emailMode() === 'capture') {
    await record('synced', 'Test mode: not copied to Resend.', false)
    return 'synced'
  }
  if (!process.env.RESEND_CONTACTS_API_KEY || !segment) {
    await record('pending', 'RESEND_CONTACTS_API_KEY or RESEND_NEWSLETTER_SEGMENT_ID is not set. The sign-up is saved here.', false)
    return 'pending'
  }

  const email = encodeURIComponent(row.email)
  let step = await resend('POST', '/contacts', { email: row.email, unsubscribed: false, segments: [{ id: segment }] })
  if (!step.ok && (step.status === 409 || step.status === 422 || /already exists/i.test(step.error))) {
    step = await resend('PATCH', `/contacts/${email}`, { unsubscribed: false })
    if (step.ok) step = await resend('POST', `/contacts/${email}/segments/${encodeURIComponent(segment)}`)
  }
  if (step.ok) {
    await record('synced', null, true)
    return 'synced'
  }
  const attempts = (row.syncAttempts ?? 0) + 1
  const retry = step.status === 0 || step.status === 429 || step.status >= 500
  const final = !retry || attempts >= MAX_SYNC_ATTEMPTS
  await record(final ? 'failed' : 'pending', `Resend answered ${step.status}: ${step.error}`, true)
  return final ? 'failed' : 'pending'
}

/** Daily job: copy confirmed subscribers that are still waiting. */
export async function syncPendingSubscribers(): Promise<{ attempted: number; synced: number; waiting: number }> {
  const payload = await cms()
  const due = await payload.find({
    collection: 'newsletter-subscribers',
    where: { and: [{ status: { equals: 'confirmed' } }, { syncStatus: { equals: 'pending' } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const report = { attempted: 0, synced: 0, waiting: 0 }
  for (const row of due.docs) {
    report.attempted++
    const outcome = await syncSubscriber(String(row.id)).catch(() => 'pending' as const)
    if (outcome === 'synced') report.synced++
    else report.waiting++
  }
  // Sign-ups never confirmed are removed after 30 days: no consent, so no reason to keep the address.
  await payload.delete({
    collection: 'newsletter-subscribers',
    where: { and: [{ status: { equals: 'pending' } }, { requestedAt: { less_than: new Date(Date.now() - 30 * 86_400_000).toISOString() } }] },
    overrideAccess: true,
  })
  return report
}
