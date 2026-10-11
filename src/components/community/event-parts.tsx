import Link from "next/link";
import { redirect } from "next/navigation";

import { priceText } from "@/components/community/cards";
import { rsvpAction } from "@/lib/community/actions/engagement";
import { setEventStatusAction } from "@/lib/community/actions/contributions";
import { COMMERCIAL_DISCLOSURES, labelOf } from "@/lib/community/constants";
import { str } from "@/lib/community/next/forms";
import { safeReturnPath } from "@/lib/community/next/session";
import { initialState } from "@/lib/community/next/state";
import type { ActivityInfo, Card } from "@/lib/community/queries";
import { activityCategoryLabel } from "@/lib/community/seo";
import { SubmitButton } from "./client";
import { SignInTo } from "./post-actions";
import { AuthorName, Notice, StatusBadge, UserText, describedBy, inputClass } from "./ui";

/*
 * Activity and event building blocks. This is a server module: every date is formatted on the
 * server, so the page reads the same with or without JavaScript and never changes on hydration.
 * The RSVP and organiser forms post to small server actions and come back to the page with a
 * short result code in the address (never free text), which the page turns into a message.
 */

// ---------------------------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------------------------

/** "Bangkok" for Asia/Bangkok, "Buenos Aires" for America/Argentina/Buenos_Aires. */
export const zoneCity = (zone: string): string => (zone === "UTC" || zone === "Etc/UTC" ? "UTC" : (zone.split("/").pop() ?? zone).replace(/_/g, " "));

/** The short name of a zone at a moment, such as AEDT, CET or GMT+7, in the form people there are used to. */
export function zoneAbbreviation(zone: string, instant: string | null): string {
  const locale = zone.startsWith("Australia/") ? "en-AU" : zone.startsWith("America/") || zone.startsWith("US/") || zone === "Pacific/Honolulu" ? "en-US" : zone === "Pacific/Auckland" ? "en-NZ" : zone.startsWith("Asia/Kolkata") ? "en-IN" : "en-GB";
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "short" }).formatToParts(instant ? new Date(instant) : new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

const dayText = (local: string) => new Date(`${local.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const clockText = (local: string) => local.slice(11, 16);

type When = Pick<ActivityInfo, "allDay" | "startLocal" | "endLocal" | "timeZone" | "startsAt" | "endsAt">;

/**
 * The event's time in its own zone, for example "Sat 14 November 2026, 18:30 to 21:00 AEDT".
 * `zone` is the plain-language place, for example "Sydney time".
 */
export function eventWhen(a: When): { text: string; zone: string } {
  if (!a.startLocal) return { text: "Date to be confirmed", zone: "" };
  const zone = a.timeZone ? `${zoneCity(a.timeZone)} time` : "";
  if (a.allDay) {
    const end = a.endLocal && a.endLocal.slice(0, 10) !== a.startLocal.slice(0, 10) ? ` to ${dayText(a.endLocal)}` : "";
    return { text: `${dayText(a.startLocal)}${end}, all day`, zone };
  }
  const startAbbr = a.timeZone ? zoneAbbreviation(a.timeZone, a.startsAt) : "";
  const endAbbr = a.timeZone && a.endsAt ? zoneAbbreviation(a.timeZone, a.endsAt) : startAbbr;
  // A clock change during the event gives the end a different abbreviation; then both are shown.
  const startTail = startAbbr && endAbbr !== startAbbr ? ` ${startAbbr}` : "";
  const tail = endAbbr ? ` ${endAbbr}` : "";
  if (!a.endLocal) return { text: `${dayText(a.startLocal)}, ${clockText(a.startLocal)}${startAbbr ? ` ${startAbbr}` : ""}`, zone };
  const sameDay = a.endLocal.slice(0, 10) === a.startLocal.slice(0, 10);
  return {
    text: sameDay
      ? `${dayText(a.startLocal)}, ${clockText(a.startLocal)}${startTail} to ${clockText(a.endLocal)}${tail}`
      : `${dayText(a.startLocal)}, ${clockText(a.startLocal)}${startTail} to ${dayText(a.endLocal)}, ${clockText(a.endLocal)}${tail}`,
    zone,
  };
}

const isOpenForResponses = (status: string) => status === "scheduled" || status === "rescheduled" || status === "postponed";

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

/** The current status, in words. Shown prominently whenever it is not simply "scheduled". */
export function EventStatusBanner({ activity }: { activity: ActivityInfo }) {
  const note = activity.statusNote ? <p>Organiser’s or moderator’s note: {activity.statusNote}</p> : null;
  switch (activity.status) {
    case "cancelled":
      return <Notice tone="error" title="Cancelled: this activity will not take place">{note}<p>The details below are kept for reference only.</p></Notice>;
    case "postponed":
      return <Notice tone="warning" title="Postponed: a new date is not known yet">{note}<p>The date shown below is the original date. Check with the organiser before you travel.</p></Notice>;
    case "rescheduled":
      return (
        <Notice tone="warning" title="Rescheduled: the date has changed">
          {note}
          {activity.originalStartLocal && <p>It was first planned for {dayText(activity.originalStartLocal)}{activity.allDay ? "" : `, ${clockText(activity.originalStartLocal)}`}. The new date is below.</p>}
        </Notice>
      );
    case "ended":
      return <Notice tone="info" title="This activity has ended">{note}<p>The page is kept for reference. Responses are closed.</p></Notice>;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Cards and details
// ---------------------------------------------------------------------------------------------

const where = (a: ActivityInfo) => (a.format === "online" ? "Online" : a.venueName || a.venueAddress || "Venue to be confirmed");

/** One activity in a list, with its local date, time and zone, place, price and status. */
export function ActivityCard({ card, headingLevel = 3 }: { card: Card; headingLevel?: 2 | 3 }) {
  const a = card.activity;
  if (!a) return null;
  const when = eventWhen(a);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="flex flex-col gap-2 border-t border-paper-200 pt-4">
      <p className="t-meta text-ink-400 m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ochre-700">{activityCategoryLabel(a.category)}</span>
        <StatusBadge state={a.status} kind="event" />
        {a.format === "online" && <span>Online</span>}
      </p>
      <Heading className="t-card-title m-0">
        <Link href={card.path} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">{card.title}</Link>
      </Heading>
      <p className="t-body-sm text-ink-900 m-0">
        {a.startsAt ? <time dateTime={a.startsAt}>{when.text}</time> : when.text}
        {when.zone && <span className="text-ink-600"> ({when.zone})</span>}
      </p>
      <p className="t-body-sm text-ink-600 m-0">{where(a)} · {priceText(a)}{a.goingCount > 0 ? ` · ${a.goingCount} going` : ""}</p>
      {card.excerpt && <p className="t-body-sm text-ink-600 m-0">{card.excerpt}</p>}
      <p className="t-meta text-ink-400 m-0 normal-case tracking-normal flex flex-wrap gap-x-3">
        <span>Listed by <AuthorName author={card.author} /></span>
        {card.destinations.length > 0 && <span>{card.destinations.map((d) => d.label).join(" · ")}</span>}
      </p>
    </article>
  );
}

export function ActivityList({ cards, label }: { cards: Card[]; label: string }) {
  return (
    <ul className="list-none m-0 p-0 grid gap-6" aria-label={label}>
      {cards.map((c) => <li key={c.id}><ActivityCard card={c} /></li>)}
    </ul>
  );
}

const relFor = (a: ActivityInfo) => `ugc nofollow noopener noreferrer${a.disclosure === "affiliate" || a.disclosure === "sponsored" || a.category === "commercial_activity" ? " sponsored" : ""}`;

/** When, where, price and organiser. The organiser's private contact is never part of this data. */
export function EventFacts({ activity: a, path }: { activity: ActivityInfo; path: string }) {
  const when = eventWhen(a);
  const rel = relFor(a);
  const canAddToCalendar = Boolean(a.startLocal && a.timeZone && a.startsAt);
  return (
    <section aria-labelledby="event-facts" className="mt-6 bg-paper-100 rounded-md p-5">
      <h2 id="event-facts" className="sr-only">Event details</h2>
      <dl className="m-0 grid gap-4 sm:grid-cols-[10rem_1fr] t-body-sm">
        <dt className="t-ui">When</dt>
        <dd className="m-0">
          {a.startsAt ? <time dateTime={a.startsAt}>{when.text}</time> : when.text}
          {when.zone && <span className="block text-ink-600">In the event’s local time ({when.zone}{a.timeZone ? `, ${a.timeZone}` : ""}). Check the difference if you are in another time zone.</span>}
          {canAddToCalendar && a.status !== "cancelled" && (
            <a href={`${path}/calendar.ics`} download rel="nofollow" className="inline-flex items-center min-h-11 t-ui text-marine-600">Add to calendar (.ics file)</a>
          )}
        </dd>

        <dt className="t-ui">Where</dt>
        <dd className="m-0">
          {a.format === "online" ? (
            <>
              <span className="block">Online</span>
              {a.bookingUrl && <a href={a.bookingUrl} rel={rel} target="_blank" className="text-marine-600 underline break-words">Joining or booking link<span className="sr-only"> (opens in a new tab)</span></a>}
            </>
          ) : (
            <>
              {a.venueName && <span className="block">{a.venueName}</span>}
              {a.venueAddress && <span className="block whitespace-pre-line text-ink-600">{a.venueAddress}</span>}
              {!a.venueName && !a.venueAddress && <span>Venue to be confirmed</span>}
            </>
          )}
        </dd>

        <dt className="t-ui">Price</dt>
        <dd className="m-0">
          {priceText(a)}
          {a.priceState === "paid" && <span className="block text-ink-600">Paid to the organiser. Travel Notes does not sell tickets or take payments.</span>}
          {a.format !== "online" && a.bookingUrl && <a href={a.bookingUrl} rel={rel} target="_blank" className="block text-marine-600 break-words">Booking or information link<span className="sr-only"> (opens in a new tab)</span></a>}
        </dd>

        <dt className="t-ui">Organiser</dt>
        <dd className="m-0">
          {a.organiserName || "Not stated"}
          {a.organiserVerified && <span className="block text-ink-600"><span aria-hidden="true">✓ </span>A moderator confirmed a contact for this organiser. This is not an endorsement.</span>}
          {a.sourceUrl && <a href={a.sourceUrl} rel={rel} target="_blank" className="block text-marine-600 break-words">Official details<span className="sr-only"> (opens in a new tab)</span></a>}
        </dd>

        {a.capacity !== null && (
          <>
            <dt className="t-ui">Capacity</dt>
            <dd className="m-0">Up to {a.capacity} people</dd>
          </>
        )}
        {a.audience && (
          <>
            <dt className="t-ui">Suitable for</dt>
            <dd className="m-0">{a.audience}</dd>
          </>
        )}
        {a.accessibility && (
          <>
            <dt className="t-ui">Accessibility</dt>
            <dd className="m-0"><UserText text={a.accessibility} className="[&_p]:text-[inherit] [&_p]:m-0" /></dd>
          </>
        )}
      </dl>
      {(a.disclosure !== "none" || a.category === "commercial_activity") && (
        <p className="t-body-sm mt-4 mb-0 border-t border-paper-200 pt-3"><span className="t-ui">Commercial disclosure: </span>{labelOf(COMMERCIAL_DISCLOSURES, a.disclosure === "none" ? "business" : a.disclosure)}.</p>
      )}
      {a.lastCheckedAt && <p className="t-body-sm text-ink-600 mt-2 mb-0">Details last checked by a moderator on {new Date(a.lastCheckedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.</p>}
    </section>
  );
}

/** How many people responded, and the names of those who chose to be listed. */
export function Attendees({ activity, people }: { activity: ActivityInfo; people: { handle: string; displayName: string; status: string }[] }) {
  const going = people.filter((p) => p.status === "going");
  const interested = people.filter((p) => p.status === "interested");
  const names = (list: typeof people) => list.map((p, i) => <span key={p.handle}>{i > 0 && ", "}<Link href={`/travellers/${p.handle}`} className="text-marine-600 underline">{p.displayName}</Link></span>);
  return (
    <section aria-labelledby="attendees-heading" className="mt-8">
      <h2 id="attendees-heading" className="t-heading-3 m-0">Who is going</h2>
      <p className="t-body-sm mt-2 mb-0">{activity.goingCount === 1 ? "1 member is going" : `${activity.goingCount} members are going`} · {activity.interestedCount} interested</p>
      {going.length > 0 && <p className="t-body-sm mt-2 mb-0"><span className="t-ui">Going: </span>{names(going)}</p>}
      {interested.length > 0 && <p className="t-body-sm mt-1 mb-0"><span className="t-ui">Interested: </span>{names(interested)}</p>}
      <p className="t-body-sm text-ink-600 mt-2 mb-0">Only members who chose to show their name are listed. Everyone else is counted but stays private.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------------------------

async function submitRsvp(form: FormData): Promise<void> {
  "use server";
  const result = await rsvpAction(initialState, form);
  const back = safeReturnPath(str(form, "returnTo"), "/activities");
  const code = result.ok ? String(result.data?.status ?? "none") : `error-${result.code ?? "error"}`;
  redirect(`${back}?rsvp=${encodeURIComponent(code)}#rsvp`);
}

const RSVP_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  going: { ok: true, text: "You said you are going. This is not a ticket and does not guarantee entry." },
  interested: { ok: true, text: "You said you are interested." },
  none: { ok: true, text: "Your response is removed." },
  "error-auth": { ok: false, text: "Your session has ended. Sign in again, then press the button once more." },
  "error-forbidden": { ok: false, text: "Your account cannot respond at the moment. Check that you have confirmed your email address, or see your account page." },
  "error-conflict": { ok: false, text: "This activity is over or cancelled, so responses are closed." },
  "error-rate_limited": { ok: false, text: "Too many changes in a short time. Please wait a minute and try again." },
  "error-not_found": { ok: false, text: "That activity could not be found." },
};

function ResultMessage({ flash, messages }: { flash?: string; messages: Record<string, { ok: boolean; text: string }> }) {
  if (!flash) return null;
  const m = messages[flash] ?? { ok: false, text: "Something went wrong on our side. Please try again in a moment." };
  return (
    <div role={m.ok ? "status" : "alert"} className={`mt-3 border-l-4 rounded-sm p-3 bg-paper-000 ${m.ok ? "border-signal-success" : "border-signal-error"}`}>
      <p className="t-ui m-0">{m.ok ? "Done" : "There is a problem"}</p>
      <p className="t-body-sm m-0 mt-1">{m.text}</p>
    </div>
  );
}

/**
 * Going / Interested / Not going. One response per member; pressing again just updates it.
 * When the organiser's capacity is reached, "Going" is closed to new people; "Interested" stays open.
 */
export function RsvpControl({
  activityId, activity, signedIn, current, returnTo, flash,
}: {
  activityId: string; activity: ActivityInfo; signedIn: boolean; current: { status: string; showPublicly: boolean } | null; returnTo: string; flash?: string;
}) {
  const open = isOpenForResponses(activity.status);
  const full = activity.capacity !== null && activity.goingCount >= activity.capacity && current?.status !== "going";
  const chosen = current?.status ?? "none";
  const option = "flex items-center gap-2 t-body-sm min-h-11";
  return (
    <section id="rsvp" aria-labelledby="rsvp-heading" className="mt-8 border border-paper-200 rounded-md p-5 scroll-mt-24">
      <h2 id="rsvp-heading" className="t-heading-3 m-0">Are you going?</h2>
      <p className="t-body-sm text-ink-600 mt-1 mb-0">Responding helps the organiser plan. It is not a ticket, does not reserve a place and does not guarantee entry.</p>
      <ResultMessage flash={flash} messages={RSVP_MESSAGES} />
      {!open ? (
        <p className="t-body-sm mt-3 mb-0">{activity.status === "cancelled" ? "This activity is cancelled, so responses are closed." : "This activity has ended, so responses are closed."}</p>
      ) : !signedIn ? (
        <div className="mt-3"><SignInTo action="say you are going or interested" returnTo={returnTo} /></div>
      ) : (
        <form action={submitRsvp} className="mt-3">
          <input type="hidden" name="activityId" value={activityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <fieldset className="border-0 p-0 m-0">
            <legend className="t-ui">Your response{current ? ` (now: ${current.status === "going" ? "going" : "interested"})` : ""}</legend>
            <div className="mt-1 grid gap-1">
              <label className={option}>
                <input type="radio" name="status" value="going" defaultChecked={chosen === "going"} disabled={full} aria-describedby={full ? "rsvp-full" : undefined} className="w-4 h-4" /> Going
              </label>
              {full && <p id="rsvp-full" className="t-body-sm text-ink-600 m-0 ml-6"><span aria-hidden="true">● </span>Full: the organiser’s limit of {activity.capacity} people has been reached. You can still say you are interested.</p>}
              <label className={option}><input type="radio" name="status" value="interested" defaultChecked={chosen === "interested"} className="w-4 h-4" /> Interested</label>
              <label className={option}><input type="radio" name="status" value="none" defaultChecked={chosen === "none"} className="w-4 h-4" /> Not going {current ? "(remove my response)" : ""}</label>
            </div>
          </fieldset>
          <label className={`${option} mt-2`}>
            <input type="checkbox" name="showPublicly" defaultChecked={current?.showPublicly ?? false} className="w-4 h-4" /> Show my name on this page
          </label>
          <p className="t-body-sm text-ink-600 m-0">If you leave this unticked you are only counted. Your name stays private.</p>
          <div className="mt-3"><SubmitButton pendingText="Saving…">Save my response</SubmitButton></div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Organiser tools
// ---------------------------------------------------------------------------------------------

async function submitEventStatus(form: FormData): Promise<void> {
  "use server";
  const back = safeReturnPath(str(form, "returnTo"), "/activities");
  if (str(form, "confirm") !== "yes") redirect(`${back}?status=error-confirm#organiser`);
  const result = await setEventStatusAction(initialState, form);
  redirect(`${back}?status=${encodeURIComponent(result.ok ? "saved" : `error-${result.code ?? "error"}`)}#organiser`);
}

const STATUS_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  saved: { ok: true, text: "The status is updated on this page, and members who responded are being told." },
  "error-confirm": { ok: false, text: "Tick the box to confirm, then press the button again." },
  "error-validation": { ok: false, text: "Choose “Cancelled” or “Postponed”." },
  "error-conflict": { ok: false, text: "This activity can no longer be changed this way. If it is already cancelled, submit a new activity if it will run again." },
  "error-auth": { ok: false, text: "Your session has ended. Sign in again, then try once more." },
  "error-forbidden": { ok: false, text: "Only the member who listed this activity can change its status." },
  "error-rate_limited": { ok: false, text: "Too many changes in a short time. Please wait a minute and try again." },
};

/**
 * For the member who listed the activity: cancel or postpone it straight away. A new date is a
 * material change, so it goes through an edit and a moderator's review instead.
 */
export function OrganiserStatusForm({ postId, status, returnTo, flash }: { postId: string; status: string; returnTo: string; flash?: string }) {
  const changeable = status !== "cancelled" && status !== "ended";
  return (
    <section id="organiser" aria-labelledby="organiser-heading" className="mt-8 border border-dashed border-line-500 rounded-md p-5 scroll-mt-24">
      <h2 id="organiser-heading" className="t-heading-3 m-0">For you as the organiser</h2>
      <p className="t-body-sm text-ink-600 mt-1 mb-0">Only you see this. To change the date, time or place, <Link href={`/account/posts/${postId}`} className="text-marine-600 underline">edit your listing</Link>; a moderator checks the change before it appears.</p>
      <ResultMessage flash={flash} messages={STATUS_MESSAGES} />
      {changeable ? (
        <form action={submitEventStatus} className="mt-3">
          <input type="hidden" name="id" value={postId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <fieldset className="border-0 p-0 m-0">
            <legend className="t-ui">Change the status</legend>
            <label className="flex items-center gap-2 t-body-sm min-h-11"><input type="radio" name="status" value="postponed" required defaultChecked={status === "postponed"} className="w-4 h-4" /> Postponed (new date not known yet)</label>
            <label className="flex items-center gap-2 t-body-sm min-h-11"><input type="radio" name="status" value="cancelled" required className="w-4 h-4" /> Cancelled (will not take place)</label>
          </fieldset>
          <div className="mt-3">
            <label htmlFor="status-note" className="block t-ui">Short note for readers <span className="text-ink-600 font-normal">(optional)</span></label>
            <p id="status-note-hint" className="t-body-sm text-ink-600 mt-1 mb-2">For example: “Moved because of the weather forecast.” Shown on the page.</p>
            <input {...describedBy("status-note", true)} name="note" maxLength={300} className={inputClass} />
          </div>
          <label className="mt-3 flex items-start gap-2 t-body-sm min-h-11">
            <input type="checkbox" name="confirm" value="yes" required className="w-4 h-4 mt-1" /> I understand this shows on the public page straight away and members who responded will be told.
          </label>
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Update status</SubmitButton></div>
        </form>
      ) : (
        <p className="t-body-sm mt-3 mb-0">This activity is {status === "cancelled" ? "cancelled" : "over"}, so its status can no longer be changed here.</p>
      )}
    </section>
  );
}
