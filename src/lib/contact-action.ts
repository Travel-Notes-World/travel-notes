'use server'

import { formValues, str, toState, type ActionState } from './community/next/forms'
import { clientIp } from './community/next/session'
import { submitContactMessage } from './contact'

/** The contact form's server action. Anyone may call it, so all checks live in submitContactMessage. */
export async function contactAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await submitContactMessage(
      { name: str(form, 'name'), email: str(form, 'email'), topic: str(form, 'topic'), subject: str(form, 'subject'), pageUrl: str(form, 'pageUrl'), message: str(form, 'message'), website: str(form, 'website') },
      { ip: await clientIp() },
    )
    return { ok: true, message: 'Thank you. Your message has reached us, and we will reply by email.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}
