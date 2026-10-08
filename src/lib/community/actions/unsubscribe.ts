'use server'

import { redirect } from 'next/navigation'

import { isCommunityError } from '../errors'
import { unsubscribe } from '../members'
import { str } from '../next/forms'

/**
 * Confirm an unsubscribe from an email link. No sign-in is needed: the signed link is the proof.
 * It runs only when the person presses the button (a POST), never when the link is opened, so
 * link scanners in mail systems cannot switch emails off by visiting the page.
 */
export async function confirmUnsubscribeAction(form: FormData): Promise<void> {
  let category: string
  try {
    category = (await unsubscribe(str(form, 'm'), str(form, 'c'), str(form, 's'))).category
  } catch (error) {
    if (!isCommunityError(error)) console.error('[community] unsubscribe failed', error)
    redirect(isCommunityError(error) ? '/account/unsubscribe?invalid=1' : '/account/unsubscribe?failed=1')
  }
  redirect(`/account/unsubscribe?done=${encodeURIComponent(category)}`)
}
