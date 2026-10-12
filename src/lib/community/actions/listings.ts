'use server'

import { redirect } from 'next/navigation'

import { startListingCheckout } from '../listings'
import { getViewer } from '../next/session'
import { str, toState, type ActionState } from '../next/forms'
import { siteUrl } from '../../site'

/** Open Stripe's checkout page for the member's own business listing. */
export async function startListingCheckoutAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'id')
  let target: string
  try {
    const { member } = await getViewer()
    const result = await startListingCheckout(member!, id, { base: siteUrl })
    target = 'url' in result ? result.url : `/account/posts/${id}/pay/done?already=1`
  } catch (error) {
    return toState(error)
  }
  redirect(target)
}
