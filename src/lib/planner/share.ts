import { randomBytes } from 'node:crypto'

import { cms } from '../community/db'
import { fail } from '../community/errors'
import { requireActive } from '../community/members'
import { getPlan, ownPlanDoc, type PlanView } from '../community/plans'
import type { MemberActor } from '../community/types'

/**
 * Private share links for paid plans. A link is a long random code; anyone with it can read the
 * plan, nobody can find it otherwise, and search engines are told not to index it. Turning sharing
 * off also changes the code, so an old link never works again. The shared view never shows the
 * traveller's name, accommodation, transport, funding, accessibility needs or private notes.
 */

const newToken = () => randomBytes(18).toString('base64url')

export async function setSharing(actor: MemberActor, planId: unknown, enabled: boolean): Promise<{ token: string | null }> {
  const member = await requireActive(actor)
  const plan = await ownPlanDoc(member, planId)
  if (enabled && !plan.ai?.unlocked) fail('forbidden', 'Sharing is included when you upgrade this plan.')
  const payload = await cms()
  const token = enabled ? plan.share?.token || newToken() : newToken()
  await payload.update({ collection: 'plans', id: plan.id, data: { share: { token, enabled } } })
  return { token: enabled ? token : null }
}

export type SharedPlan = Pick<PlanView, 'title' | 'startDate' | 'endDate' | 'purpose' | 'days' | 'updatedAt'> & { summary: string; options: PlanView['ai']['options']; generatedAt: string | null }

export async function getSharedPlan(token: unknown): Promise<SharedPlan | null> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null
  const payload = await cms()
  const found = await payload.find({ collection: 'plans', where: { and: [{ 'share.token': { equals: token } }, { 'share.enabled': { equals: true } }, { 'ai.unlocked': { equals: true } }] }, limit: 1, depth: 0 })
  const doc = found.docs[0]
  if (!doc) return null
  const owner = typeof doc.owner === 'string' ? doc.owner : doc.owner?.id
  const view = await getPlan({ kind: 'member', id: owner } as MemberActor, doc.id)
  return {
    title: view.title,
    startDate: view.startDate,
    endDate: view.endDate,
    purpose: view.purpose,
    updatedAt: view.updatedAt,
    // A booked night may name a hotel, and the member's own notes may be personal: neither is shared.
    days: view.days.map((d) => ({ ...d, overnight: d.overnightConfirmed ? '' : d.overnight, stops: d.stops.map((s) => (s.origin === 'own' ? { ...s, notes: '' } : s)) })),
    summary: view.ai.summary,
    options: view.ai.options,
    generatedAt: view.ai.generatedAt,
  }
}
