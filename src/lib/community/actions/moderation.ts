'use server'

import { revalidatePath } from 'next/cache'

import {
  decideContribution,
  decideMedia,
  decideReply,
  decideSuggestion,
  markDuplicate,
  markMemberVerified,
  moderateEventStatus,
  overrideAcceptedAnswer,
  recordFactCheck,
  resendMemberVerification,
  resolveReport,
  restrictAccount,
  sendMemberPasswordReset,
  setIndexing,
  setTrusted,
  setVisibility,
  type Decision,
  type ReplyDecision,
} from '../moderation'
import { publicPathsForContribution, publicPathsForMedia, publicPathsForMember, publicPathsForReply } from '../moderation-extra'
import { fail } from '../errors'
import { bool, formValues, str, toState, type ActionState } from '../next/forms'
import { getViewer, safeReturnPath } from '../next/session'
import type { StaffActor } from '../types'

/**
 * Moderation console actions. Each one reads the acting staff member from the session on the
 * server (never from the form), and the service function checks the moderator permission again
 * before it changes anything. After a decision, the public pages that show the item and the
 * console page the decision was made on are refreshed, so nothing stale is served.
 */

async function moderator(): Promise<StaffActor> {
  const { staff } = await getViewer()
  if (!staff?.canModerate) fail('forbidden', 'Only moderators can do this. Sign in to the CMS with a moderator account.')
  return staff!
}

function refresh(form: FormData, paths: string[]) {
  for (const p of new Set(paths)) revalidatePath(p)
  revalidatePath('/moderation', 'layout')
  const back = safeReturnPath(str(form, 'returnTo'), '')
  if (back) revalidatePath(back)
}

export async function decideContributionAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    const decision = str(form, 'decision') as Decision
    const before = await publicPathsForContribution(id)
    await decideContribution(staff, id, { decision, reason: str(form, 'reason') })
    refresh(form, [...before, ...(await publicPathsForContribution(id))])
    return { ok: true, message: decision === 'approve' ? 'Approved. The post is public now.' : decision === 'reject' ? 'Rejected. The author has been told why.' : 'Changes requested. The author has been told what to change.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function setVisibilityAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    const action = str(form, 'action') as 'hide' | 'unhide' | 'remove'
    await setVisibility(staff, id, { action, reason: str(form, 'reason') })
    refresh(form, await publicPathsForContribution(id))
    return { ok: true, message: action === 'hide' ? 'Hidden. It is no longer public.' : action === 'unhide' ? 'Restored. It is public again.' : 'Removed. It is no longer public.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function decideReplyAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const replyId = str(form, 'replyId')
    const decision = str(form, 'decision') as ReplyDecision
    await decideReply(staff, replyId, { decision, reason: str(form, 'reason') })
    refresh(form, await publicPathsForReply(replyId))
    const done: Record<ReplyDecision, string> = { approve: 'Reply approved and published.', reject: 'Reply rejected.', hide: 'Reply hidden.', unhide: 'Reply restored.', remove: 'Reply removed.' }
    return { ok: true, message: done[decision] ?? 'Done.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** Search-engine indexing. The service allows administrators only. */
export async function setIndexingAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    await setIndexing(staff, id, str(form, 'indexing'))
    refresh(form, [...(await publicPathsForContribution(id)), '/sitemap.xml'])
    return { ok: true, message: 'Search-engine setting saved.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function markDuplicateAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    const other = str(form, 'other')
    await markDuplicate(staff, id, other)
    refresh(form, await publicPathsForContribution(id))
    return { ok: true, message: other ? 'Linked to the earlier question.' : 'Duplicate link removed.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function overrideAcceptedAnswerAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    const replyId = str(form, 'replyId') || null
    await overrideAcceptedAnswer(staff, id, { replyId, reason: str(form, 'reason') })
    refresh(form, await publicPathsForContribution(id))
    return { ok: true, message: replyId ? 'Accepted answer changed.' : 'Accepted answer cleared.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function moderateEventStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    await moderateEventStatus(staff, id, { status: str(form, 'status'), note: str(form, 'note') })
    refresh(form, [...(await publicPathsForContribution(id)), '/activities'])
    return { ok: true, message: 'Activity status saved. People who said they are going are told about a change.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function recordFactCheckAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const id = str(form, 'id')
    await recordFactCheck(staff, id, { organiserVerified: bool(form, 'organiserVerified') })
    refresh(form, await publicPathsForContribution(id))
    return { ok: true, message: 'Fact check recorded with today’s date.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function decideMediaAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const mediaId = str(form, 'mediaId')
    const decision = str(form, 'decision') === 'remove' ? 'remove' : 'reject'
    const paths = await publicPathsForMedia(mediaId)
    await decideMedia(staff, mediaId, { decision, reason: str(form, 'reason') })
    refresh(form, paths)
    return { ok: true, message: decision === 'remove' ? 'Photo removed.' : 'Photo rejected.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** Suspend until a chosen day (or with no end date), or lift a suspension. */
export async function restrictAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const memberId = str(form, 'memberId')
    const action = str(form, 'action') === 'unsuspend' ? 'unsuspend' : 'suspend'
    const until = str(form, 'until')
    let days: number | undefined
    if (action === 'suspend' && until) {
      const end = Date.parse(`${until}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(end) || end <= Date.now()) fail('validation', 'Choose an end date in the future, or leave it empty.', { until: 'Choose a day after today, or leave it empty for no end date.' })
      days = Math.ceil((end - Date.now()) / 86_400_000)
      if (days > 3650) fail('validation', 'The end date can be at most ten years away.', { until: 'Choose a day within ten years.' })
    }
    await restrictAccount(staff, memberId, { action, reason: str(form, 'reason'), days })
    refresh(form, await publicPathsForMember(memberId))
    return { ok: true, message: action === 'suspend' ? 'Account suspended. The member has been told.' : 'Suspension lifted.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function setTrustedAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const memberId = str(form, 'memberId')
    const trusted = bool(form, 'trusted')
    await setTrusted(staff, memberId, trusted)
    refresh(form, [])
    return { ok: true, message: trusted ? 'Marked as trusted.' : 'No longer marked as trusted.' }
  } catch (error) {
    return toState(error)
  }
}

export async function resolveReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const status = str(form, 'status') === 'dismissed' ? 'dismissed' : 'resolved'
    await resolveReport(staff, str(form, 'reportId'), { status, resolution: str(form, 'resolution') })
    refresh(form, [])
    return { ok: true, message: status === 'dismissed' ? 'Report dismissed.' : 'Report marked as resolved.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

export async function decideSuggestionAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    const decision = str(form, 'decision') === 'accept' ? 'accept' : 'reject'
    await decideSuggestion(staff, str(form, 'id'), { decision, destinationId: str(form, 'destinationId'), resolution: str(form, 'resolution') })
    refresh(form, [])
    return { ok: true, message: decision === 'accept' ? 'Suggestion accepted and linked to the destination.' : 'Suggestion turned down.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}

/** Email the member a link to choose a new password. The moderator never sees it. */
export async function sendMemberPasswordResetAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    await sendMemberPasswordReset(staff, str(form, 'memberId'))
    refresh(form, [])
    return { ok: true, message: 'A link to choose a new password has been sent to the member. It works for one hour.' }
  } catch (error) {
    return toState(error)
  }
}

export async function resendMemberVerificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    await resendMemberVerification(staff, str(form, 'memberId'))
    refresh(form, [])
    return { ok: true, message: 'The confirmation email has been sent again.' }
  } catch (error) {
    return toState(error)
  }
}

export async function markMemberVerifiedAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const staff = await moderator()
    await markMemberVerified(staff, str(form, 'memberId'), str(form, 'reason'))
    refresh(form, [])
    return { ok: true, message: 'Email address marked as confirmed. The member can sign in now.' }
  } catch (error) {
    return toState(error, formValues(form))
  }
}
