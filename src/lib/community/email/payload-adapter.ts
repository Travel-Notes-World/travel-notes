import { randomUUID } from 'node:crypto'

import type { EmailAdapter, SendEmailOptions } from 'payload'

import { emailMode, sendEmail } from './transport'

/**
 * Email adapter for Payload's own messages (staff "forgot password" in /admin).
 *
 * Without an adapter Payload only logs these, so a staff password reset never arrives. This sends
 * them through the same transport as community email: really sent when EMAIL_TRANSPORT=resend,
 * otherwise logged as before (recipient and subject only, never the body or reset link).
 */
const recipients = (to: SendEmailOptions['to']): string[] => {
  const list = Array.isArray(to) ? to : to ? [to] : []
  return list.map((r) => (typeof r === 'string' ? r : r.address)).filter(Boolean)
}

const asText = (value: SendEmailOptions['html']): string => (typeof value === 'string' ? value : '')

export const payloadEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: 'travel-notes',
  defaultFromAddress: process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] || process.env.EMAIL_FROM || 'no-reply@localhost',
  defaultFromName: 'Travel Notes',
  sendEmail: async (message) => {
    const to = recipients(message.to)
    if (emailMode() !== 'resend') {
      payload.logger.info({ msg: `Email not sent (EMAIL_TRANSPORT is not "resend"). To: '${to.join(', ')}', Subject: '${message.subject}'` })
      return
    }
    for (const address of to) {
      const result = await sendEmail({
        to: address,
        subject: message.subject || '',
        html: asText(message.html),
        text: asText(message.text),
        idempotencyKey: `payload:${randomUUID()}`,
      })
      if (!result.ok) payload.logger.error({ msg: `Payload email to '${address}' failed: ${result.error}` })
    }
  },
})
