import { CONTRIBUTION_TYPES, labelOf, MEMBER_STATUSES, REPLY_STATES, REPORT_CATEGORIES } from "@/lib/community/constants";
import { isCommunityError } from "@/lib/community/errors";

/** Small formatting helpers shared by the moderation console pages (server-side only). */

export const typeLabel = (value: string) => labelOf(CONTRIBUTION_TYPES, value) || value;
export const replyStateLabel = (value: string) => labelOf(REPLY_STATES, value) || value;
export const memberStatusLabel = (value: string) => labelOf(MEMBER_STATUSES, value) || value;
export const reportCategoryLabel = (value: string) => labelOf(REPORT_CATEGORIES, value) || value;

/** "14 Mar 2026, 09:30 UTC". Staff work across time zones, so the zone is always written out. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return `${new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/** How long ago, in words: "35 minutes", "5 hours", "3 days". */
export function formatAge(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "";
  return formatHours((now - new Date(value).getTime()) / 3_600_000);
}

export function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "";
  if (hours < 1) {
    const m = Math.max(0, Math.round(hours * 60));
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  if (hours < 48) {
    const h = Math.round(hours);
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const d = Math.round(hours / 24);
  return `${d} days`;
}

/** Audit action codes in plain words. */
export const actionLabel = (action: string): string => action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Turn a service "not found" into the page's not-found; anything else is a real error. */
export function isNotFound(error: unknown): boolean {
  return isCommunityError(error) && error.code === "not_found";
}

export const PER_PAGE = 25;

export function pageOf<T>(items: T[], page: number, perPage = PER_PAGE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const p = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((p - 1) * perPage, p * perPage), page: p, totalPages };
}
