import type { Where } from 'payload'

import { MODERATION_ACTIONS, TYPE_PATH, type ContributionType, type EmailTemplate } from './constants'
import { contributionPath } from './contributions'
import { cms, relId } from './db'
import { isUuid } from './destinations'
import { renderEmail } from './email/templates'
import { emailMode } from './email/transport'
import { fail } from './errors'
import type { StaffActor } from './types'

/**
 * Small read helpers for the moderation console that the main moderation service does not cover:
 * a filterable audit log, the capture-mode test inbox and the public addresses to refresh after a
 * decision. Every reader checks the moderator first, like the functions in moderation.ts.
 */

function requireModerator(staff: StaffActor | null | undefined): StaffActor {
  if (!staff || staff.kind !== 'staff' || !staff.canModerate) return fail('forbidden', 'Only moderators can do this.')
  return staff
}

const TARGET_TYPES = ['contribution', 'reply', 'revision', 'member', 'media', 'report', 'suggestion'] as const

export type AuditFilter = { page?: number; action?: string | null; targetType?: string | null; actorType?: string | null; contribution?: string | null }
export type AuditItem = { id: string; action: string; actor: string; targetType: string; targetId: string; contributionId: string | null; reason: string; at: string }

/** The audit log, newest first, optionally narrowed by action, target, actor kind or post. */
export async function auditLogFiltered(staffIn: StaffActor, filter: AuditFilter = {}): Promise<{ items: AuditItem[]; page: number; totalPages: number; totalDocs: number }> {
  requireModerator(staffIn)
  const payload = await cms()
  const and: Where[] = []
  if (filter.action && (MODERATION_ACTIONS as readonly string[]).includes(filter.action)) and.push({ action: { equals: filter.action } })
  if (filter.targetType && (TARGET_TYPES as readonly string[]).includes(filter.targetType)) and.push({ targetType: { equals: filter.targetType } })
  if (filter.actorType && ['staff', 'member', 'system'].includes(filter.actorType)) and.push({ actorType: { equals: filter.actorType } })
  if (filter.contribution && isUuid(filter.contribution)) and.push({ contribution: { equals: filter.contribution } })
  const found = await payload.find({ collection: 'moderation-actions', where: and.length ? { and } : {}, sort: ['-createdAt', 'id'], limit: 50, page: Math.max(1, Math.floor(filter.page ?? 1)), depth: 1 })
  return {
    page: found.page ?? 1,
    totalPages: found.totalPages,
    totalDocs: found.totalDocs,
    items: found.docs.map((h) => ({
      id: h.id,
      action: h.action,
      actor: h.actorType === 'staff' ? `Staff: ${typeof h.staff === 'object' && h.staff ? h.staff.name : 'unknown'}` : h.actorType === 'member' ? `Member: ${typeof h.member === 'object' && h.member ? h.member.handle : 'unknown'}` : 'System',
      targetType: h.targetType,
      targetId: h.targetId,
      contributionId: relId(h.contribution),
      reason: h.reason ?? '',
      at: h.createdAt,
    })),
  }
}

export type CapturedEmail = { id: string; template: string; status: string; to: string; subject: string; text: string; createdAt: string; sentAt: string | null; lastError: string }

/**
 * The test inbox: email the site would have sent, kept in the queue instead. Only available when
 * email is in capture mode, which the transport never allows on the production deployment.
 */
export async function capturedEmails(staffIn: StaffActor, page = 1): Promise<{ available: false } | { available: true; items: CapturedEmail[]; page: number; totalPages: number }> {
  requireModerator(staffIn)
  // Captured emails contain working sign-in and password links, so only administrators see them.
  if (!staffIn.isAdministrator) return fail('forbidden', 'Only administrators can open the test inbox.')
  if ((process.env.EMAIL_TRANSPORT || '').toLowerCase() !== 'capture' || process.env.VERCEL_ENV === 'production' || emailMode() !== 'capture') return { available: false }
  const payload = await cms()
  const found = await payload.find({ collection: 'email-outbox', sort: ['-createdAt', 'id'], limit: 20, page: Math.max(1, Math.floor(page)), depth: 1 })
  return {
    available: true,
    page: found.page ?? 1,
    totalPages: found.totalPages,
    items: found.docs.map((row) => {
      const member = typeof row.recipient === 'object' && row.recipient ? row.recipient : null
      const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {}
      let subject = ''
      let text = ''
      try {
        const rendered = renderEmail(row.template as EmailTemplate, data, { id: member?.id ?? '', displayName: member?.displayName ?? 'member' })
        subject = rendered.subject
        text = rendered.text
      } catch {
        subject = `(${row.template})`
      }
      return { id: row.id, template: row.template, status: row.status, to: member?.email ?? '(member no longer exists)', subject, text, createdAt: row.createdAt, sentAt: row.sentAt ?? null, lastError: row.lastError ?? '' }
    }),
  }
}

/** Public addresses that show a post: its own page, its list, and its destination pages. */
export async function publicPathsForContribution(id: unknown): Promise<string[]> {
  if (!isUuid(id)) return []
  const payload = await cms()
  const doc = await payload.findByID({ collection: 'contributions', id: id as string, depth: 1, disableErrors: true })
  if (!doc) return []
  const paths = [contributionPath(doc), TYPE_PATH[doc.type as ContributionType], '/community']
  for (const d of doc.destinations ?? []) if (typeof d === 'object' && d?.path) paths.push(`/destinations/${d.path}`)
  return paths
}

export async function publicPathsForReply(id: unknown): Promise<string[]> {
  if (!isUuid(id)) return []
  const payload = await cms()
  const reply = await payload.findByID({ collection: 'replies', id: id as string, depth: 0, disableErrors: true })
  return reply ? publicPathsForContribution(relId(reply.contribution)) : []
}

export async function publicPathsForMedia(id: unknown): Promise<string[]> {
  if (!isUuid(id)) return []
  const payload = await cms()
  const media = await payload.findByID({ collection: 'media', id: id as string, depth: 0, disableErrors: true })
  return media ? publicPathsForContribution(relId(media.contribution)) : []
}

export async function publicPathsForMember(id: unknown): Promise<string[]> {
  if (!isUuid(id)) return []
  const payload = await cms()
  const member = await payload.findByID({ collection: 'members', id: id as string, depth: 0, disableErrors: true })
  return member?.handle ? [`/travellers/${member.handle}`] : []
}
