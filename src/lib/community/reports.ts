import { REPORT_CATEGORIES, optionValues } from './constants'
import { cms, relId } from './db'
import { isUuid } from './destinations'
import { fail, invalid } from './errors'
import { requireActive } from './members'
import { track } from './metrics'
import { limit } from './ratelimit'
import { cleanText } from './text'
import type { MemberActor } from './types'

/**
 * Report a public post, reply, photo or member to the moderators.
 * One report per member per item. The item must be something the reporter can actually see.
 */
export async function createReport(actor: MemberActor, input: { targetType: unknown; targetId: unknown; category: unknown; details?: unknown }): Promise<{ ok: true; alreadyReported: boolean }> {
  const member = await requireActive(actor)
  await limit('report', member.id)
  const targetType = ['contribution', 'reply', 'member', 'media'].includes(String(input.targetType)) ? (input.targetType as 'contribution' | 'reply' | 'member' | 'media') : fail('validation', 'Unknown item.')
  if (!isUuid(input.targetId)) fail('not_found', 'That item could not be found.')
  const targetId = input.targetId as string
  const category = optionValues(REPORT_CATEGORIES).includes(input.category as never) ? (input.category as (typeof REPORT_CATEGORIES)[number]['value']) : invalid({ category: 'Choose a reason.' })
  const details = cleanText(input.details, 1500)
  if ((category === 'other' || category === 'copyright' || category === 'privacy') && details.length < 10) invalid({ details: 'Please explain the problem in a sentence or two so a moderator can act on it.' })

  const payload = await cms()
  let contribution: string | null = null
  if (targetType === 'contribution') {
    const doc = await payload.findByID({ collection: 'contributions', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'published') fail('not_found', 'That item could not be found.')
    contribution = targetId
  } else if (targetType === 'reply') {
    const doc = await payload.findByID({ collection: 'replies', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'published') return fail('not_found', 'That item could not be found.')
    contribution = relId(doc.contribution)
  } else if (targetType === 'media') {
    const doc = await payload.findByID({ collection: 'media', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'approved') return fail('not_found', 'That item could not be found.')
    contribution = relId(doc.contribution)
  } else {
    const doc = await payload.findByID({ collection: 'members', id: targetId, depth: 0, disableErrors: true })
    if (!doc || doc.status !== 'active') fail('not_found', 'That member could not be found.')
    if (targetId === member.id) fail('validation', 'You cannot report yourself.')
  }

  const key = `${member.id}:${targetType}:${targetId}`
  const existing = await payload.count({ collection: 'reports', where: { key: { equals: key } } })
  if (existing.totalDocs) return { ok: true, alreadyReported: true }
  try {
    await payload.create({ collection: 'reports', data: { key, reporter: member.id, targetType, targetId, contribution: contribution ?? undefined, category, details, status: 'open' } })
  } catch {
    // Two identical requests raced; the unique key kept one.
    return { ok: true, alreadyReported: true }
  }
  await track('report_submitted', category)
  return { ok: true, alreadyReported: false }
}
