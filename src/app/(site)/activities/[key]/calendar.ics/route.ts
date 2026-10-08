import { siteUrl } from "@/lib/site";
import { getViewer } from "@/lib/community/next/session";
import { getPublished } from "@/lib/community/queries";
import { canViewCommunity } from "@/lib/community/settings";
import { addDays } from "@/lib/community/time";
import { excerpt, shortIdFromSegment } from "@/lib/community/text";

/**
 * "Add to calendar": an iCalendar (RFC 5545) file for one approved activity.
 * Only a published activity with a date and time zone is served; anything else is "not found".
 * Timed events are written in UTC; all-day events as plain dates, so they stay on the right day.
 */

/** Escape text for an iCalendar value: backslash, semicolon, comma and line breaks. */
const escapeText = (value: string): string => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

/** Lines longer than 75 bytes are folded, without splitting a multi-byte character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const utcStamp = (iso: string | Date): string => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const dateValue = (local: string): string => local.slice(0, 10).replace(/-/g, "");

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return notFound();
  const post = await getPublished(shortIdFromSegment(key));
  const a = post?.activity;
  if (!post || post.type !== "activity" || !a || !a.startLocal || !a.timeZone || !a.startsAt) return notFound();

  const url = `${siteUrl}${post.path}`;
  const host = new URL(siteUrl).host;
  const location = a.format === "online" ? "Online" : [a.venueName, a.venueAddress].filter(Boolean).join(", ");
  const status = a.status === "cancelled" ? "CANCELLED" : a.status === "postponed" ? "TENTATIVE" : "CONFIRMED";
  const description = [
    a.status === "postponed" ? "Postponed: the new date is not known yet." : "",
    excerpt(post.body, 600),
    a.organiserName ? `Organiser: ${a.organiserName}` : "",
    "Listed by a member of the Travel Notes community. Travel Notes does not organise or endorse this activity. Check the latest details before you go:",
    url,
  ].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Travel Notes//Community activities//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:activity-${post.id}@${host}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    ...(post.updatedAt ? [`LAST-MODIFIED:${utcStamp(post.updatedAt)}`] : []),
    ...(a.allDay
      ? [`DTSTART;VALUE=DATE:${dateValue(a.startLocal)}`, `DTEND;VALUE=DATE:${dateValue(addDays((a.endLocal || a.startLocal).slice(0, 10), 1))}`]
      : [`DTSTART:${utcStamp(a.startsAt)}`, ...(a.endsAt ? [`DTEND:${utcStamp(a.endsAt)}`] : [])]),
    `SUMMARY:${escapeText(a.status === "cancelled" ? `Cancelled: ${post.title}` : post.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    `URL:${url}`,
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Response(`${lines.map(fold).join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-${post.shortId}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
