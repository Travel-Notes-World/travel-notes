import { cms } from './db'
import { fail } from './errors'
import type { StaffActor } from './types'

export type Settings = {
  publicAccess: boolean
  signupsOpen: boolean
  submissionsOpen: boolean
  maxPendingPerMember: number
  questionsAuto: boolean
  activitiesAuto: boolean
  questionMinAnswers: number
  profileMinPublished: number
  autoApproveTrustedReplies: boolean
  smartPublish: boolean
  smartPublishMinApproved: number
  autoHideReports: number
  listings: { enabled: boolean; feeMinor: number; priceLabel: string; gstRegistered: boolean; sellerName: string; sellerAbn: string }
  planner: { aiEnabled: boolean; model: 'claude-sonnet-5-5' | 'claude-haiku-5-5'; dailyBudgetUsd: number; freePlans: number; priceMinor: number }
}

/** Current community switches. Read fresh on every call: a switch must take effect straight away. */
export async function getSettings(): Promise<Settings> {
  const payload = await cms()
  const s = await payload.findGlobal({ slug: 'community-settings', depth: 0 })
  return {
    publicAccess: Boolean(s.publicAccess),
    signupsOpen: Boolean(s.signupsOpen),
    submissionsOpen: s.submissionsOpen !== false,
    maxPendingPerMember: s.maxPendingPerMember ?? 5,
    questionsAuto: s.indexing?.questionsAuto !== false,
    activitiesAuto: s.indexing?.activitiesAuto !== false,
    questionMinAnswers: s.indexing?.questionMinAnswers ?? 1,
    profileMinPublished: s.indexing?.profileMinPublished ?? 2,
    autoApproveTrustedReplies: Boolean(s.review?.autoApproveTrustedReplies),
    smartPublish: s.review?.smartPublish !== false,
    smartPublishMinApproved: Math.max(1, s.review?.smartPublishMinApproved ?? 1),
    autoHideReports: Math.max(2, s.review?.autoHideReports ?? 3),
    listings: {
      enabled: Boolean(s.listings?.enabled),
      feeMinor: Math.max(0, Math.round((s.listings?.feeAud ?? 5) * 100)),
      priceLabel: (s.listings?.priceLabel ?? 'Launch price').trim(),
      gstRegistered: s.listings?.gstRegistered !== false,
      sellerName: (s.listings?.sellerName ?? '').trim(),
      sellerAbn: (s.listings?.sellerAbn ?? '').replace(/\s/g, ''),
    },
    planner: {
      aiEnabled: Boolean(s.planner?.aiEnabled),
      model: s.planner?.model === 'claude-haiku-5-5' ? 'claude-haiku-5-5' : 'claude-sonnet-5-5',
      dailyBudgetUsd: Math.max(0, s.planner?.dailyBudgetUsd ?? 5),
      freePlans: Math.max(0, Math.floor(s.planner?.freePlans ?? 1)),
      priceMinor: Math.max(0, Math.round((s.planner?.priceAud ?? 4.99) * 100)),
    },
  }
}

/** Public pages are visible to everyone when the community is open, and to signed-in staff before that. */
export async function canViewCommunity(staff: StaffActor | null): Promise<boolean> {
  if (staff) return true
  return (await getSettings()).publicAccess
}

export async function assertSubmissionsOpen(): Promise<Settings> {
  const settings = await getSettings()
  if (!settings.submissionsOpen) fail('closed', 'Posting is paused at the moment. Please try again later.')
  return settings
}
