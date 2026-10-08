'use server'

import { revalidatePath } from 'next/cache'

import { setBookmark, setFollow, setRsvp, setVote } from '../engagement'
import { createReport } from '../reports'
import { postReply, removeOwnReply, setAcceptedAnswer, setResolved } from '../replies'
import { addPostToPlan, copyItinerary } from '../plans'
import { redirect } from 'next/navigation'
import { bool, str, toState, type ActionState } from '../next/forms'
import { getViewer, safeReturnPath } from '../next/session'

/** Each action re-renders the page it was used on, so counts and buttons show the new state. */
const refresh = (form: FormData) => {
  const path = safeReturnPath(str(form, 'returnTo'), '')
  if (path) revalidatePath(path)
}

export async function voteAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const result = await setVote(member!, { targetType: str(form, 'targetType'), targetId: str(form, 'targetId'), on: bool(form, 'on') })
    refresh(form)
    return { ok: true, message: result.on ? 'Marked as helpful.' : 'Helpful mark removed.', data: result }
  } catch (error) {
    return toState(error)
  }
}

export async function bookmarkAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const result = await setBookmark(member!, { targetType: str(form, 'targetType'), targetId: str(form, 'targetId'), on: bool(form, 'on') })
    refresh(form)
    return { ok: true, message: result.on ? 'Saved to your bookmarks.' : 'Removed from your bookmarks.', data: result }
  } catch (error) {
    return toState(error)
  }
}

export async function followAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const result = await setFollow(member!, { destinationId: str(form, 'destinationId'), on: bool(form, 'on') })
    refresh(form)
    return { ok: true, message: result.on ? 'You are following this destination.' : 'You no longer follow this destination.', data: result }
  } catch (error) {
    return toState(error)
  }
}

export async function rsvpAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const status = str(form, 'status')
    const result = await setRsvp(member!, { activityId: str(form, 'activityId'), status: status === 'none' ? null : status, showPublicly: bool(form, 'showPublicly') })
    refresh(form)
    return { ok: true, message: result.status === 'going' ? 'You said you are going. This is not a ticket.' : result.status === 'interested' ? 'You said you are interested.' : 'Your response is removed.', data: result }
  } catch (error) {
    return toState(error)
  }
}

export async function reportAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const result = await createReport(member!, { targetType: str(form, 'targetType'), targetId: str(form, 'targetId'), category: str(form, 'category'), details: str(form, 'details') })
    return { ok: true, message: result.alreadyReported ? 'You already reported this. Moderators will review it.' : 'Thank you. Moderators will review your report.' }
  } catch (error) {
    return toState(error, { details: str(form, 'details'), category: str(form, 'category') })
  }
}

export async function replyAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    const result = await postReply(member!, { contributionId: str(form, 'contributionId'), parentId: str(form, 'parentId') || null, body: str(form, 'body') })
    refresh(form)
    return {
      ok: true,
      message: result.state === 'published' ? 'Your reply is published.' : 'Thank you. Your reply will appear after a moderator reviews it. You will get a notification.',
      data: { state: result.state },
    }
  } catch (error) {
    return toState(error, { body: str(form, 'body') })
  }
}

export async function acceptAnswerAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await setAcceptedAnswer(member!, { contributionId: str(form, 'contributionId'), replyId: str(form, 'replyId') || null })
    refresh(form)
    return { ok: true, message: str(form, 'replyId') ? 'Marked as the answer that helped you.' : 'The accepted answer is cleared.' }
  } catch (error) {
    return toState(error)
  }
}

export async function resolvedAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await setResolved(member!, { contributionId: str(form, 'contributionId'), resolved: bool(form, 'resolved') })
    refresh(form)
    return { ok: true, message: bool(form, 'resolved') ? 'Marked as resolved.' : 'Marked as open again.' }
  } catch (error) {
    return toState(error)
  }
}

export async function removeReplyAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await removeOwnReply(member!, str(form, 'replyId'))
    refresh(form)
    return { ok: true, message: 'Your reply is removed.' }
  } catch (error) {
    return toState(error)
  }
}

export async function copyItineraryAction(form: FormData): Promise<void> {
  const { member } = await getViewer()
  if (!member) redirect(`/account/sign-in?next=${encodeURIComponent(safeReturnPath(str(form, 'returnTo'), '/community/trips'))}`)
  let id: string
  try {
    id = (await copyItinerary(member, str(form, 'contributionId'))).id
  } catch (error) {
    const state = toState(error)
    redirect(`${safeReturnPath(str(form, 'returnTo'), '/account/trips')}?copyError=${encodeURIComponent(state.message ?? 'error')}`)
  }
  redirect(`/account/trips/${id}?copied=1`)
}

export async function addToPlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { member } = await getViewer()
    await addPostToPlan(member!, { planId: str(form, 'planId'), contributionId: str(form, 'contributionId') })
    return { ok: true, message: 'Added to your plan.' }
  } catch (error) {
    return toState(error)
  }
}
