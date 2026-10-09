import { cms } from './community/db'
import { sendEmail, emailMode } from './community/email/transport'
import { invalid, type FieldErrors } from './community/errors'
import { hashSubject, limit } from './community/ratelimit'
import { cleanLine, cleanText, countLinks, safeHttpUrl } from './community/text'
import { siteUrl } from './site'

/**
 * The public contact form.
 *
 * 1. Validate. A hidden "website" field catches simple bots: when it is filled in, the visitor
 *    sees the normal thank-you message but nothing is saved or sent.
 * 2. Rate-limit per network address (hashed, never stored raw) and across the whole site.
 * 3. Save the message, then email it to CONTACT_INBOX with the visitor's address as "reply to".
 *    Saving first means a failed email never loses a message; the daily job retries it.
 */
export const CONTACT_TOPICS = {
  general: 'General question',
  correction: 'Correction to an article',
  advertising: 'Advertising or partnership',
  pitch: 'Guest article pitch',
  privacy: 'Privacy or my data',
  other: 'Something else',
} as const
export type ContactTopic = keyof typeof CONTACT_TOPICS

export const CONTACT_LIMITS = { name: 100, email: 254, subject: 150, messageMin: 20, messageMax: 5000, links: 5 } as const
const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/
const MAX_EMAIL_ATTEMPTS = 6

export type ContactInput = { name: unknown; email: unknown; topic: unknown; subject: unknown; pageUrl?: unknown; message: unknown; website?: unknown }

export async function submitContactMessage(input: ContactInput, context: { ip: string | null }): Promise<{ ok: true }> {
  if (typeof input.website === 'string' && input.website.trim()) return { ok: true }

  const errors: FieldErrors = {}
  const name = cleanLine(input.name, CONTACT_LIMITS.name)
  if (!name) errors.name = 'Enter your name.'
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email) || email.length > CONTACT_LIMITS.email) errors.email = 'Enter a valid email address, so we can reply.'
  const topic = typeof input.topic === 'string' && input.topic in CONTACT_TOPICS ? (input.topic as ContactTopic) : null
  if (!topic) errors.topic = 'Choose what your message is about.'
  const subject = cleanLine(input.subject, CONTACT_LIMITS.subject)
  if (!subject) errors.subject = 'Enter a short subject.'
  const rawUrl = typeof input.pageUrl === 'string' ? input.pageUrl.trim() : ''
  const pageUrl = rawUrl ? safeHttpUrl(rawUrl) : null
  if (rawUrl && !pageUrl) errors.pageUrl = 'Enter a full web address starting with https://, or leave this empty.'
  const message = cleanText(input.message, CONTACT_LIMITS.messageMax + 1)
  if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Please write at least ${CONTACT_LIMITS.messageMin} characters.`
  else if (message.length > CONTACT_LIMITS.messageMax) errors.message = `Please keep your message under ${CONTACT_LIMITS.messageMax.toLocaleString('en-AU')} characters.`
  else if (countLinks(message) > CONTACT_LIMITS.links) errors.message = `Please include no more than ${CONTACT_LIMITS.links} links.`
  if (Object.keys(errors).length) invalid(errors)

  await limit('contact_ip', context.ip ? hashSubject(context.ip) : null)
  await limit('contact_all', 'site')

  const payload = await cms()
  const saved = await payload.create({
    collection: 'contact-messages',
    data: { name, email, topic: topic!, subject, pageUrl: pageUrl ?? undefined, message, status: 'new', emailStatus: 'pending', emailAttempts: 0 },
    overrideAccess: true,
  })
  // A failed email is recorded on the message and retried later; the visitor's message is already safe.
  await deliverContactMessage(String(saved.id)).catch((error) => console.error('[contact] email failed', error))
  return { ok: true }
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Email one saved message to the inbox. Safe to call again: Resend ignores a repeated idempotency key. */
export async function deliverContactMessage(id: string): Promise<'sent' | 'captured' | 'pending' | 'failed'> {
  const payload = await cms()
  const doc = await payload.findByID({ collection: 'contact-messages', id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!doc || doc.status === 'spam' || doc.emailStatus === 'sent' || doc.emailStatus === 'captured') return (doc?.emailStatus as 'sent') ?? 'failed'

  const record = (data: { emailStatus: 'sent' | 'captured' | 'pending' | 'failed'; emailError?: string | null; countAttempt?: boolean }) =>
    payload.update({
      collection: 'contact-messages',
      id,
      overrideAccess: true,
      data: { emailStatus: data.emailStatus, emailError: data.emailError ?? null, emailAttempts: (doc.emailAttempts ?? 0) + (data.countAttempt ? 1 : 0) },
    })

  const inbox = (process.env.CONTACT_INBOX || '').trim()
  const mode = emailMode()
  if (mode === 'capture') {
    await record({ emailStatus: 'captured' })
    return 'captured'
  }
  // Not configured yet: keep waiting without using up attempts. The message is visible in the CMS.
  if (!inbox || !EMAIL_PATTERN.test(inbox)) {
    await record({ emailStatus: 'pending', emailError: 'CONTACT_INBOX is not set, so the message was not emailed. It is saved here.' })
    return 'pending'
  }
  if (mode === 'off') {
    await record({ emailStatus: 'pending', emailError: 'Email sending is not configured. The message is saved here.' })
    return 'pending'
  }

  const topicLabel = CONTACT_TOPICS[doc.topic as ContactTopic] ?? doc.topic
  const adminUrl = `${siteUrl}/admin/collections/contact-messages/${id}`
  const lines = [
    `From: ${doc.name} <${doc.email}>`,
    `Topic: ${topicLabel}`,
    doc.pageUrl ? `Page: ${doc.pageUrl}` : null,
    '',
    doc.message,
    '',
    '---',
    'Reply to this email to answer the sender directly.',
    `Mark it handled in the CMS: ${adminUrl}`,
  ].filter((line): line is string => line !== null)
  const html = [
    `<p><strong>From:</strong> ${escapeHtml(doc.name)} &lt;${escapeHtml(doc.email)}&gt;<br><strong>Topic:</strong> ${escapeHtml(String(topicLabel))}`,
    doc.pageUrl ? `<br><strong>Page:</strong> ${escapeHtml(doc.pageUrl)}` : '',
    '</p>',
    `<p style="white-space:pre-wrap">${escapeHtml(doc.message)}</p>`,
    `<hr><p style="color:#555">Reply to this email to answer the sender directly.<br><a href="${escapeHtml(adminUrl)}">Mark it handled in the CMS</a></p>`,
  ].join('')

  const result = await sendEmail({
    to: inbox,
    subject: `[Contact] ${doc.subject}`.slice(0, 200),
    text: lines.join('\n'),
    html,
    replyTo: doc.email,
    idempotencyKey: `contact:${id}`,
  })
  if (result.ok) {
    await record({ emailStatus: result.transport === 'resend' ? 'sent' : 'captured', countAttempt: true })
    return result.transport === 'resend' ? 'sent' : 'captured'
  }
  const attempts = (doc.emailAttempts ?? 0) + 1
  const finalFailure = !result.retry || attempts >= MAX_EMAIL_ATTEMPTS
  await record({ emailStatus: finalFailure ? 'failed' : 'pending', emailError: result.error.slice(0, 300), countAttempt: true })
  return finalFailure ? 'failed' : 'pending'
}

/** Daily job: email any saved messages that could not be emailed yet. */
export async function deliverPendingContactMessages(): Promise<{ attempted: number; sent: number; waiting: number }> {
  const payload = await cms()
  const due = await payload.find({
    collection: 'contact-messages',
    where: { and: [{ emailStatus: { equals: 'pending' } }, { status: { not_equals: 'spam' } }] },
    sort: 'createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  const report = { attempted: 0, sent: 0, waiting: 0 }
  for (const doc of due.docs) {
    report.attempted++
    const outcome = await deliverContactMessage(String(doc.id)).catch(() => 'pending' as const)
    if (outcome === 'sent' || outcome === 'captured') report.sent++
    else report.waiting++
  }
  return report
}
