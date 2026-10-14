import config from '@payload-config'
import { getPayload } from 'payload'

import type { MemberActor } from '../community/types'
import { getPlan } from '../community/plans'
import { fail } from '../community/errors'
import { siteUrl } from '../site'
import { documentModel, type DocModel } from './document'
import { tripAdvice } from './advice'
import { placeLegs } from './extras'
import { planBudget } from './trip-budget'

/** The printable document of a member's own paid plan. Unpaid plans have no document. */
export async function planDocument(actor: MemberActor, planId: unknown): Promise<DocModel> {
  const view = await getPlan(actor, planId)
  if (!view.ai.unlocked) fail('forbidden', 'The PDF and print version are included when you upgrade this plan.')
  const payload = await getPayload({ config })
  const placeIds = view.planner?.placeIds ?? []
  const [legs, budget, advice] = await Promise.all([placeLegs(payload, placeIds), planBudget(payload, view), tripAdvice(payload, placeIds)])
  return documentModel(view, { budget: budget?.budget ?? null, placeName: (id) => budget?.places.find((p) => p.id === id)?.name ?? '', advice, legs, site: siteUrl })
}
