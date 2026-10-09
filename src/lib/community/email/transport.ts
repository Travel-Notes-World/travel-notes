/**
 * How email leaves the site.
 *
 * - "resend": really sent, through the Resend API. Used only when EMAIL_TRANSPORT=resend and the
 *   key and sender address are set.
 * - "capture": stored in the email queue and shown in the moderation test inbox. Nothing is sent to
 *   anyone. This is the default on a developer's computer and can be chosen for a preview.
 * - "off": email is not configured. Sign-up is closed and the site says so.
 *
 * Capture is refused on the real production deployment, so production can never look as if it
 * sends email while silently keeping it.
 */
export type EmailMode = 'resend' | 'capture' | 'off'

const env = process.env

export function emailMode(): EmailMode {
  const chosen = (env.EMAIL_TRANSPORT || '').toLowerCase()
  if (chosen === 'resend') return env.RESEND_API_KEY && env.EMAIL_FROM ? 'resend' : 'off'
  // Allowed on a developer's computer and on a Vercel preview; refused on any other production server.
  if (chosen === 'capture') {
    if (env.VERCEL_ENV === 'production') return 'off'
    // A production build elsewhere (for example "next start" on a test machine) must opt in.
    if (env.NODE_ENV === 'production' && env.VERCEL_ENV !== 'preview' && env.ALLOW_EMAIL_CAPTURE !== 'yes') return 'off'
    return 'capture'
  }
  if (!chosen) return env.NODE_ENV === 'production' ? 'off' : 'capture'
  return 'off'
}

/** A plain explanation of why email is off, for the owner dashboard. Empty when email works. */
export function emailProblem(): string {
  if (emailMode() !== 'off') return ''
  const chosen = (env.EMAIL_TRANSPORT || '').toLowerCase()
  if (chosen === 'resend') return 'EMAIL_TRANSPORT is "resend" but RESEND_API_KEY or EMAIL_FROM is missing.'
  if (chosen === 'capture') return 'EMAIL_TRANSPORT is "capture", which is only allowed locally, on Vercel previews, or with ALLOW_EMAIL_CAPTURE=yes on a non-production test server.'
  if (!chosen) return 'EMAIL_TRANSPORT is not set. Set it to "resend" (with RESEND_API_KEY and EMAIL_FROM) to send email.'
  return `EMAIL_TRANSPORT has an unknown value: "${chosen}".`
}

export type OutgoingEmail = { to: string; subject: string; text: string; html: string; idempotencyKey: string; unsubscribeUrl?: string; replyTo?: string }
export type SendResult = { ok: true; transport: 'resend' | 'capture'; providerId?: string } | { ok: false; error: string; retry: boolean }

/** Send one email with the configured transport. Never throws. */
export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  const mode = emailMode()
  if (mode === 'capture') return { ok: true, transport: 'capture' }
  if (mode === 'off') return { ok: false, error: emailProblem(), retry: true }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        // Resend ignores a repeat of the same key, so a retry after a timeout cannot send twice.
        'Idempotency-Key': message.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo || env.EMAIL_REPLY_TO ? { reply_to: message.replyTo || env.EMAIL_REPLY_TO } : {}),
        ...(message.unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${message.unsubscribeUrl}>` } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { id?: string }
      return { ok: true, transport: 'resend', providerId: body.id }
    }
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    // 4xx other than "too many requests" will not succeed on a retry (bad address, bad sender).
    return { ok: false, error: `Resend answered ${response.status}: ${detail}`, retry: response.status === 429 || response.status >= 500 }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error', retry: true }
  }
}
