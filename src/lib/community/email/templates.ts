import { createHmac, timingSafeEqual } from 'node:crypto'

import { siteUrl } from '../../site'
import type { EmailCategory, EmailTemplate } from '../constants'

/** Which preference switches a template. Security email has none and is always sent. */
export const TEMPLATE_CATEGORY: Record<EmailTemplate, EmailCategory | null> = {
  verify_email: null,
  password_reset: null,
  reply_published: 'replies',
  answer_accepted: 'replies',
  moderation_decision: 'moderation',
  event_changed: 'events',
  destination_digest: 'digest',
}

const secret = () => process.env.PAYLOAD_SECRET || ''

/** A signature for one-click unsubscribe links, so the link works without signing in and cannot be forged. */
export const unsubscribeSignature = (memberId: string, category: string): string =>
  createHmac('sha256', secret()).update(`unsubscribe:${memberId}:${category}`).digest('hex').slice(0, 40)

export function validUnsubscribeSignature(memberId: string, category: string, signature: string): boolean {
  const expected = Buffer.from(unsubscribeSignature(memberId, category))
  const given = Buffer.from(signature || '')
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export const unsubscribeUrl = (memberId: string, category: EmailCategory): string =>
  `${siteUrl}/account/unsubscribe?m=${encodeURIComponent(memberId)}&c=${category}&s=${unsubscribeSignature(memberId, category)}`

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Rendered = { subject: string; text: string; html: string; unsubscribeUrl?: string }
type Data = Record<string, unknown>
const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
/** Only site-relative paths are ever turned into links, so email can never point somewhere else. */
const link = (path: unknown): string => {
  const p = str(path)
  return p.startsWith('/') && !p.startsWith('//') ? `${siteUrl}${p}` : siteUrl
}

function layout(lines: (string | { href: string; label: string })[], footer: string[]): { text: string; html: string } {
  const text = [...lines.map((l) => (typeof l === 'string' ? l : `${l.label}: ${l.href}`)), '', '--', ...footer].join('\n\n')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1f2a2c;max-width:560px">${lines
    .map((l) => (typeof l === 'string' ? `<p>${escapeHtml(l)}</p>` : `<p><a href="${escapeHtml(l.href)}" style="color:#1f5f6b">${escapeHtml(l.label)}</a></p>`))
    .join('')}<hr style="border:0;border-top:1px solid #ddd"><p style="font-size:13px;color:#5b6b6e">${footer.map(escapeHtml).join('<br>')}</p></div>`
  return { text, html }
}

/** Build the subject and body for one queued email. Everything a member typed is escaped. */
export function renderEmail(template: EmailTemplate, data: Data, member: { id: string; displayName: string }): Rendered {
  const hello = `Hello ${member.displayName},`
  const category = TEMPLATE_CATEGORY[template]
  const unsub = category ? unsubscribeUrl(member.id, category) : undefined
  const footer = category
    ? ['You are receiving this because of your Travel Notes email settings.', `Stop these emails: ${unsub}`, `All email settings: ${siteUrl}/account/settings`]
    : ['This is a security email about your Travel Notes account. If you did not ask for it, you can ignore it.']
  const title = str(data.title, 'your post')
  let subject = 'Travel Notes'
  let lines: (string | { href: string; label: string })[] = [hello]

  switch (template) {
    case 'verify_email':
      subject = 'Confirm your email address for Travel Notes'
      lines = [hello, 'Please confirm your email address to finish creating your Travel Notes account.', { href: `${siteUrl}/account/verify?token=${encodeURIComponent(str(data.token))}`, label: 'Confirm my email address' }, 'Confirming your email shows that the address works. It does not verify your identity.']
      break
    case 'password_reset':
      subject = 'Reset your Travel Notes password'
      lines = [hello, 'Use this link to choose a new password. It works once and expires in one hour.', { href: `${siteUrl}/account/reset-password?token=${encodeURIComponent(str(data.token))}`, label: 'Choose a new password' }]
      break
    case 'reply_published':
      subject = `New reply on “${title}”`
      lines = [hello, `${str(data.authorName, 'A member')} replied on “${title}”.`, { href: link(data.path), label: 'Read the reply' }]
      break
    case 'answer_accepted':
      subject = `Your answer was accepted on “${title}”`
      lines = [hello, `The person who asked “${title}” marked your answer as the one that helped.`, { href: link(data.path), label: 'See the question' }]
      break
    case 'moderation_decision':
      subject = `Update on “${title}”`
      lines = [hello, str(data.summary, 'A moderator reviewed your post.'), ...(str(data.reason) ? [`Moderator’s note: ${str(data.reason)}`] : []), { href: link(data.path), label: 'Open it on Travel Notes' }]
      break
    case 'event_changed':
      subject = `Change to “${title}”`
      lines = [hello, str(data.summary, 'An activity you are interested in has changed.'), { href: link(data.path), label: 'See the current details' }, 'An RSVP on Travel Notes is not a ticket. Check with the organiser before you travel.']
      break
    case 'destination_digest': {
      subject = 'New on Travel Notes in places you follow'
      const items = Array.isArray(data.items) ? (data.items as Data[]).slice(0, 20) : []
      lines = [hello, 'New approved posts in the destinations you follow:', ...items.map((i) => ({ href: link(i.path), label: `${str(i.kind)}: ${str(i.title)}` }))]
      break
    }
  }
  return { subject, ...layout(lines, footer), unsubscribeUrl: unsub }
}
