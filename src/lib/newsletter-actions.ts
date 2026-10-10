'use server'

import { formValues, str, toState, type ActionState } from './community/next/forms'
import { clientIp } from './community/next/session'
import { confirmSubscription, requestSubscription } from './newsletter'

/** Sign-up form. Anyone may call it, so every check is inside requestSubscription. */
export async function subscribeAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requestSubscription({ email: str(form, 'email'), source: str(form, 'source'), website: str(form, 'website') }, { ip: await clientIp() })
    return { ok: true, message: 'Almost done: we have sent you an email. Open the link in it to confirm your subscription.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** The confirm form on /newsletter/confirm: sent by the page itself in a real browser, or by its button. */
export async function confirmAction(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await confirmSubscription(str(form, 'token'))
  if (result === 'invalid') return { ok: false, code: 'invalid', message: 'This confirmation link has expired or was already used. Please sign up again.' }
  return { ok: true, message: result === 'already' ? 'You are already subscribed. Thank you!' : 'You are subscribed. You will get the next weekly email.' }
}
