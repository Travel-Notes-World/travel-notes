'use server'

import { formValues, str, toState, type ActionState } from './community/next/forms'
import { clientIp } from './community/next/session'
import { confirmSubscription, requestSubscription } from './newsletter'

/** Sign-up form. Anyone may call it, so every check is inside requestSubscription. */
export async function subscribeAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requestSubscription({ email: str(form, 'email'), source: str(form, 'source'), website: str(form, 'website') }, { ip: await clientIp() })
    return { ok: true, message: 'Almost done: we have sent you an email. Press the button in it to confirm your subscription.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** The "Confirm" button on /newsletter/confirm. A button press, not the link itself, gives consent. */
export async function confirmAction(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await confirmSubscription(str(form, 'token'))
  if (result === 'invalid') return { ok: false, code: 'invalid', message: 'This confirmation link has expired or was already used. Please sign up again.' }
  return { ok: true, message: result === 'already' ? 'You are already subscribed. Thank you!' : 'You are subscribed. You will get the next weekly email.' }
}
