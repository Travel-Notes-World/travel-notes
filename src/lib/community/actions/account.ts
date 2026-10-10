'use server'

import { redirect } from 'next/navigation'

import { EMAIL_CATEGORIES } from '../constants'
import { changePassword, deleteAccount, endSession, requestPasswordReset, resendVerification, resetPassword, signIn, signUp, updateEmailPrefs, updateProfile } from '../members'
import { suggestDestination } from '../destinations'
import { markAllRead, markRead } from '../notifications'
import { bool, formValues, str, toState, type ActionState } from '../next/forms'
import { clearSessionCookie, clientIp, getViewer, safeReturnPath, setSessionCookie } from '../next/session'

/**
 * Account form actions. Each one is a public endpoint, so each one checks who is asking itself.
 * Next.js also rejects a form post that comes from another website (Origin check), which protects
 * these cookie-based actions against cross-site request forgery.
 */

export async function signUpAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await signUp({ email: str(form, 'email'), password: str(form, 'password'), handle: str(form, 'handle'), displayName: str(form, 'displayName'), acceptTerms: bool(form, 'acceptTerms'), website: str(form, 'website') }, { ip: await clientIp() })
  } catch (error) {
    return toState(error, formValues(form))
  }
  redirect('/account/sign-up?sent=1')
}

export async function signInAction(_: ActionState, form: FormData): Promise<ActionState> {
  const next = safeReturnPath(str(form, 'next'))
  try {
    const result = await signIn({ email: str(form, 'email'), password: str(form, 'password') }, { ip: await clientIp() })
    await setSessionCookie(result.token)
  } catch (error) {
    const state = toState(error, { email: str(form, 'email'), next })
    // An unconfirmed account gets a way to ask for the link again, right there.
    if (state.code === 'forbidden' && /confirm your email/i.test(state.message ?? '')) state.data = { unverified: true }
    return state
  }
  redirect(next)
}

export async function signOutAction(): Promise<void> {
  const { member, sessionId } = await getViewer()
  if (member) await endSession(member.id, sessionId).catch(() => undefined)
  await clearSessionCookie()
  redirect('/')
}

export async function resendVerificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await resendVerification(str(form, 'email'), { ip: await clientIp() })
    return { ok: true, message: 'If that address has an account that is not confirmed yet, we have sent the link again. Check your inbox and spam folder.' }
  } catch (error) {
    return toState(error)
  }
}

export async function forgotPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requestPasswordReset(str(form, 'email'), { ip: await clientIp() })
    return { ok: true, message: 'If that address has an account, we have sent a link to choose a new password. It works for one hour.' }
  } catch (error) {
    return toState(error, { email: str(form, 'email') })
  }
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await resetPassword({ token: str(form, 'token'), password: str(form, 'password') })
  } catch (error) {
    return toState(error)
  }
  // The reset signs the account out everywhere; start clean in this browser too.
  await clearSessionCookie()
  redirect('/account/sign-in?reset=1')
}

export async function updateProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await updateProfile(member!, { displayName: str(form, 'displayName'), bio: str(form, 'bio'), experience: str(form, 'experience') })
    return { ok: true, message: 'Your profile is updated.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function updateEmailPrefsAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await updateEmailPrefs(member!, Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c, bool(form, c)])))
    return { ok: true, message: 'Your email settings are saved.' }
  } catch (error) {
    return toState(error)
  }
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member, sessionId } = await getViewer()
    await changePassword(member!, { current: str(form, 'current'), next: str(form, 'next') }, sessionId)
    return { ok: true, message: 'Your password is changed.' }
  } catch (error) {
    return toState(error)
  }
}

export async function deleteAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (str(form, 'confirm').trim().toUpperCase() !== 'DELETE') return { ok: false, message: 'Type DELETE to confirm.', fields: { confirm: 'Type DELETE to confirm.' } }
    const { member } = await getViewer()
    await deleteAccount(member!, { password: str(form, 'password'), removeContent: str(form, 'content') === 'remove' })
  } catch (error) {
    return toState(error)
  }
  await clearSessionCookie()
  redirect('/account/deleted')
}

export async function suggestDestinationAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await suggestDestination(member!, { name: str(form, 'name'), country: str(form, 'country'), details: str(form, 'details') })
    return { ok: true, message: 'Thank you. A moderator will check it. You will get a notification when it is added.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function markNotificationReadAction(form: FormData): Promise<void> {
  const { member } = await getViewer()
  if (!member) return
  const id = str(form, 'id')
  await markRead(member, id)
  const path = safeReturnPath(str(form, 'path'), '/account/notifications')
  redirect(path)
}

export async function markAllReadAction(): Promise<void> {
  const { member } = await getViewer()
  if (member) await markAllRead(member)
  redirect('/account/notifications')
}
