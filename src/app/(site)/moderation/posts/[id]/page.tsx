import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AcceptedAnswerForm,
  ContributionDecisionForm,
  DuplicateForm,
  EventStatusForm,
  FactCheckForm,
  IndexingForm,
  MediaDecisionForm,
  Panel,
  ReplyDecisionForm,
  RiskFlags,
  VisibilityForm,
} from "@/components/community/moderation-ui";
import { Notice, PageHeader, StatusBadge, UserText } from "@/components/community/ui";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_FORMATS,
  COMMERCIAL_DISCLOSURES,
  COST_BASES,
  COST_CATEGORIES,
  COST_KINDS,
  COST_SCOPES,
  EVENT_STATUSES,
  INDEXING_CHOICES,
  labelOf,
  PARTY_TYPES,
  PRICE_STATES,
  TRAVEL_STYLES,
} from "@/lib/community/constants";
import type { Content } from "@/lib/community/content";
import { getForReview, getMemberOverview, type MemberOverview, type ReviewView } from "@/lib/community/moderation";
import { formatMoney } from "@/lib/community/money";
import { requireModeratorPage } from "@/lib/community/next/session";
import { countLinks, excerpt, paragraphs } from "@/lib/community/text";
import { actionLabel, formatAge, formatDateTime, isNotFound, replyStateLabel, reportCategoryLabel, typeLabel } from "../../format";

export const metadata: Metadata = { title: "Review a post" };

type Row = { key: string; label: string; value: string; private?: boolean; long?: boolean };

const money = (minor: number | null | undefined, currency: string | null | undefined) => (minor !== null && minor !== undefined && currency ? formatMoney(minor, currency) : "");
const yesNo = (v: boolean | undefined) => (v ? "Yes" : "No");

/** Every field of a post as labelled text, so two versions can be compared line by line. */
function contentRows(c: Content, places: Map<string, string>): Row[] {
  const place = (id: string | null) => (id ? places.get(id) ?? "(destination not published)" : "");
  const rows: Row[] = [
    { key: "title", label: "Title", value: c.title },
    { key: "body", label: "Text", value: c.body, long: true },
    { key: "language", label: "Language", value: c.language },
    { key: "destinations", label: "Destinations", value: c.destinations.map(place).join(", ") },
    { key: "topics", label: "Topics", value: c.topics.length ? `${c.topics.length} chosen` : "" },
    { key: "style", label: "Travel style", value: labelOf(TRAVEL_STYLES, c.style) },
    { key: "photos", label: "Photos", value: c.photos.length ? `${c.photos.length} attached` : "" },
  ];
  if (c.question) {
    const q = c.question;
    rows.push(
      { key: "q.month", label: "Travel month", value: q.travelMonth ?? "" },
      { key: "q.days", label: "Trip length (days)", value: q.durationDays?.toString() ?? "" },
      { key: "q.party", label: "Travelling as", value: labelOf(PARTY_TYPES, q.partyType) },
      { key: "q.budget", label: "Budget", value: money(q.budgetMinor, q.budgetCurrency) },
    );
  }
  if (c.trip) {
    const t = c.trip;
    rows.push(
      { key: "t.dates", label: "Dates", value: [t.startDate, t.endDate].filter(Boolean).join(" to ") },
      { key: "t.month", label: "Travel month", value: t.travelMonth ?? "" },
      { key: "t.days", label: "Days / nights", value: [t.durationDays, t.nights].some((v) => v !== null) ? `${t.durationDays ?? "–"} days, ${t.nights ?? "–"} nights` : "" },
      { key: "t.party", label: "Party", value: [t.partySize ? `${t.partySize} people` : "", labelOf(PARTY_TYPES, t.partyType)].filter(Boolean).join(", ") },
      { key: "t.scope", label: "Costs are", value: [labelOf(COST_SCOPES, t.costScope), t.flightsIncluded ? "flights included" : "flights not included"].filter(Boolean).join(", ") },
      { key: "t.costNotes", label: "Cost notes", value: t.costNotes, long: true },
      { key: "t.transport", label: "Getting around", value: t.transport, long: true },
      { key: "t.recs", label: "Recommendations", value: t.recommendations, long: true },
      { key: "t.mistakes", label: "Mistakes to avoid", value: t.mistakes, long: true },
      { key: "t.permission", label: "Confirmed first-hand and may be published", value: yesNo(t.permission) },
    );
  }
  if (c.tripCosts?.length) {
    rows.push({
      key: "costs", label: "Costs", long: true,
      value: c.tripCosts.map((l) => `${labelOf(COST_CATEGORIES, l.category)}: ${formatMoney(l.amountMinor, l.currency)} ${labelOf(COST_BASES, l.basis).toLowerCase()}${l.quantity > 1 ? ` × ${l.quantity}` : ""} (${labelOf(COST_KINDS, l.kind).toLowerCase()})${l.date ? `, ${l.date}` : ""}${l.note ? ` – ${l.note}` : ""}`).join("\n"),
    });
  }
  if (c.itineraryDays?.length) {
    rows.push({
      key: "days", label: "Itinerary", long: true,
      value: c.itineraryDays.map((d, i) => `Day ${i + 1}${d.title ? `: ${d.title}` : ""}${d.date ? ` (${d.date})` : ""}\n${d.stops.map((s) => `– ${[s.title, s.place, place(s.destination)].filter(Boolean).join(", ")}${s.timeNote ? ` [${s.timeNote}]` : ""}${s.costMinor !== null ? ` ${money(s.costMinor, s.costCurrency)}` : ""}${s.description ? `: ${s.description}` : ""}`).join("\n")}`).join("\n\n"),
    });
  }
  if (c.activity) {
    const a = c.activity;
    rows.push(
      { key: "a.category", label: "Kind of activity", value: labelOf(ACTIVITY_CATEGORIES, a.category) },
      { key: "a.format", label: "Format", value: labelOf(ACTIVITY_FORMATS, a.format) },
      { key: "a.when", label: "When (venue time)", value: [a.startLocal, a.endLocal].filter(Boolean).join(" to ") + (a.allDay ? " (all day)" : "") },
      { key: "a.zone", label: "Time zone", value: a.timeZone ?? "" },
      { key: "a.venue", label: "Venue", value: [a.venueName, a.venueAddress].filter(Boolean).join(", ") },
      { key: "a.price", label: "Price", value: a.priceState === "paid" ? money(a.priceMinor, a.priceCurrency) || "Paid" : labelOf(PRICE_STATES, a.priceState) },
      { key: "a.booking", label: "Booking link", value: a.bookingUrl ?? "" },
      { key: "a.source", label: "Source link", value: a.sourceUrl ?? "" },
      { key: "a.organiser", label: "Organiser", value: a.organiserName },
      { key: "a.contact", label: "Organiser contact (private, never shown publicly)", value: a.organiserContact, private: true },
      { key: "a.disclosure", label: "Commercial interest", value: labelOf(COMMERCIAL_DISCLOSURES, a.disclosure) },
      { key: "a.audience", label: "Who it is for", value: a.audience, long: true },
      { key: "a.access", label: "Accessibility", value: a.accessibility, long: true },
      { key: "a.capacity", label: "Capacity", value: a.capacity?.toString() ?? "" },
    );
  }
  return rows;
}

function ContentList({ rows }: { rows: Row[] }) {
  const shown = rows.filter((r) => r.value);
  return (
    <dl className="m-0 grid gap-4">
      {shown.map((r) => (
        <div key={r.key} className={`min-w-0 ${r.private ? "border-l-4 border-ochre-500 bg-ochre-100 rounded-sm p-3" : ""}`}>
          <dt className="t-ui">{r.private && <span aria-hidden="true">🔒 </span>}{r.label}</dt>
          <dd className="m-0 mt-1 t-body-sm break-words"><UserText text={r.value} /></dd>
        </div>
      ))}
    </dl>
  );
}

/** Field-by-field differences between the public version and the proposed edit. */
function ChangeList({ approved, proposed }: { approved: Row[]; proposed: Row[] }) {
  const before = new Map(approved.map((r) => [r.key, r]));
  const keys = [...new Set([...approved.map((r) => r.key), ...proposed.map((r) => r.key)])];
  const changed = keys.filter((k) => (before.get(k)?.value ?? "") !== (proposed.find((r) => r.key === k)?.value ?? ""));
  if (!changed.length) return <p className="t-body-sm m-0">The proposed edit has no visible changes.</p>;
  return (
    <ul className="list-none m-0 p-0 grid gap-6">
      {changed.map((k) => {
        const old = before.get(k);
        const now = proposed.find((r) => r.key === k);
        const label = now?.label ?? old?.label ?? k;
        if (k === "body" && old?.value && now?.value) {
          const oldParas = paragraphs(old.value);
          const newParas = paragraphs(now.value);
          const removed = oldParas.filter((p) => !newParas.includes(p));
          const added = newParas.filter((p) => !oldParas.includes(p));
          return (
            <li key={k} className="min-w-0">
              <p className="t-ui m-0">{label}: {removed.length} paragraph{removed.length === 1 ? "" : "s"} taken out, {added.length} added or changed</p>
              {removed.map((p, i) => <div key={`r${i}`} className="mt-2 border-l-4 border-signal-error pl-3"><p className="t-meta m-0">Taken out</p><UserText text={p} className="t-body-sm" /></div>)}
              {added.map((p, i) => <div key={`a${i}`} className="mt-2 border-l-4 border-signal-success pl-3"><p className="t-meta m-0">Added or changed</p><UserText text={p} className="t-body-sm" /></div>)}
            </li>
          );
        }
        return (
          <li key={k} className="min-w-0">
            <p className="t-ui m-0">{label}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="border-l-4 border-line-500 pl-3 min-w-0"><p className="t-meta m-0">Public now</p>{old?.value ? <UserText text={old.value} className="t-body-sm break-words" /> : <p className="t-body-sm text-ink-600 m-0">(empty)</p>}</div>
              <div className="border-l-4 border-marine-600 pl-3 min-w-0"><p className="t-meta m-0">Proposed</p>{now?.value ? <UserText text={now.value} className="t-body-sm break-words" /> : <p className="t-body-sm text-ink-600 m-0">(empty)</p>}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Warning signs for the moderator. They point at things to check; none of them decides anything. */
function riskFlags(view: ReviewView, shown: Content, member: MemberOverview | null): { label: string; detail: string }[] {
  const flags: { label: string; detail: string }[] = [];
  const links = countLinks([shown.body, shown.trip?.recommendations, shown.trip?.transport, shown.activity?.audience].filter(Boolean).join("\n"));
  if (links) flags.push({ label: `${links} web address${links === 1 ? "" : "es"} in the text`, detail: "Check each one is relevant and not advertising. Links are marked ugc/nofollow." });
  if (shown.activity?.bookingUrl || shown.activity?.sourceUrl) flags.push({ label: "Outside booking or source link", detail: "Open it and check it matches the organiser and the details given." });
  if (shown.activity && shown.activity.disclosure && shown.activity.disclosure !== "none") flags.push({ label: "Commercial interest declared", detail: labelOf(COMMERCIAL_DISCLOSURES, shown.activity.disclosure) });
  if (shown.activity?.category === "commercial_activity") flags.push({ label: "Commercial activity", detail: "Check the price, the organiser and that it is labelled correctly." });
  if (view.proposed && view.approved) flags.push({ label: "Edit to a published post", detail: "Review what changed below. The published version stays public until you decide." });
  const openReports = view.reports.filter((r) => r.status === "open").length;
  if (openReports) flags.push({ label: `${openReports} open report${openReports === 1 ? "" : "s"} on this post`, detail: "Read them in the Reports panel below." });
  if (!view.author) flags.push({ label: "Author account no longer exists", detail: "The account may have been deleted." });
  if (member) {
    if (member.status === "suspended") flags.push({ label: "Author is suspended", detail: member.statusReason || "No reason recorded." });
    const ageDays = (Date.now() - new Date(member.createdAt).getTime()) / 86_400_000;
    if (ageDays < 7) flags.push({ label: "New account", detail: `Created ${formatAge(member.createdAt)} ago.` });
    if (member.counts.rejected) flags.push({ label: `${member.counts.rejected} earlier post${member.counts.rejected === 1 ? "" : "s"} not accepted`, detail: "See the author overview." });
    if (member.counts.reportsAgainst) flags.push({ label: `${member.counts.reportsAgainst} report${member.counts.reportsAgainst === 1 ? "" : "s"} about this member`, detail: "See the author overview." });
  }
  const unreviewedPhotos = view.photos.filter((p) => !["approved", "rejected", "removed"].includes(p.state)).length;
  if (unreviewedPhotos) flags.push({ label: `${unreviewedPhotos} photo${unreviewedPhotos === 1 ? "" : "s"} not yet public`, detail: "Photos become public when the post is approved. Turn down any that should not be." });
  return flags;
}

export default async function ReviewPostPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireModeratorPage();
  const { id } = await params;
  let view: ReviewView;
  try {
    view = await getForReview(staff, id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
  const member = view.author ? await getMemberOverview(staff, view.author.id).catch(() => null) : null;
  const { doc } = view;
  const shown = view.proposed ?? view.approved;
  const isEdit = Boolean(view.proposed && doc.state === "published");
  const flags = shown ? riskFlags(view, shown, member) : [];
  const publishedReplies = view.replies.filter((r) => r.state === "published");
  const acceptedId = typeof doc.question?.acceptedAnswer === "object" ? doc.question?.acceptedAnswer?.id ?? null : doc.question?.acceptedAnswer ?? null;
  const duplicateOf = doc.question?.duplicateOf ?? null;

  return (
    <>
      <PageHeader
        eyebrow={`${typeLabel(doc.type)} · ${isEdit ? "edit waiting for review" : view.proposed ? "new submission" : "no decision waiting"}`}
        title={doc.title || "(no title)"}
        intro={
          <span className="flex flex-wrap items-center gap-3 t-body-sm">
            <StatusBadge state={doc.state} />
            {doc.submittedAt && <span>Sent {formatDateTime(doc.submittedAt)} (waiting {formatAge(doc.submittedAt)})</span>}
            {view.path && <Link href={view.path} className="text-marine-600">Open the public page</Link>}
          </span>
        }
      />

      {!view.proposed && <Notice tone="info" title="Nothing waiting for a decision">This post has no submission or edit waiting. You can still hide, remove or correct it below.</Notice>}

      <Panel title="Warning signs">
        <RiskFlags flags={flags} />
      </Panel>

      {view.proposed && (
        <Panel title={isEdit ? "Decide this edit" : "Decide this submission"}>
          <ContributionDecisionForm id={doc.id} isEdit={isEdit} />
        </Panel>
      )}

      {isEdit && view.approved && view.proposed && (
        <Panel title="What the edit changes">
          <ChangeList approved={contentRows(view.approved, view.places)} proposed={contentRows(view.proposed, view.places)} />
        </Panel>
      )}

      <Panel title={view.proposed ? (isEdit ? "Full proposed version" : "Full submission") : "Current content"}>
        {shown ? <ContentList rows={contentRows(shown, view.places)} /> : <p className="t-body-sm m-0">No content is stored for this post.</p>}
      </Panel>

      <Panel title="Author">
        {view.author ? (
          <div className="t-body-sm">
            <p className="m-0"><strong>{view.author.name}</strong> (@{view.author.handle}) · {view.author.email} · {view.author.status}</p>
            {member && <p className="m-0 mt-1 text-ink-600">{member.counts.published} published, {member.counts.pending} waiting, {member.counts.rejected} not accepted, {member.counts.replies} published replies. {member.trusted ? "Trusted." : "Not marked as trusted."}</p>}
            <p className="m-0 mt-2"><Link href={`/moderation/members/${view.author.id}`} className="text-marine-600">Author overview and account actions</Link></p>
          </div>
        ) : <p className="t-body-sm m-0">The author account no longer exists.</p>}
      </Panel>

      <Panel title="Photos">
        {view.photos.length ? (
          <ul className="list-none m-0 p-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.photos.map((p) => (
              <li key={p.id} className="border border-line-500 rounded-md p-3 min-w-0">
                {p.url ? (
                  // Moderation preview of a not-yet-public upload; served through the CMS, which checks the moderator.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={p.alt || "Photo without a description"} className="w-full h-auto rounded-sm bg-paper-100" loading="lazy" />
                ) : <p className="t-body-sm m-0">(file missing)</p>}
                <p className="t-body-sm m-0 mt-2"><span className="t-ui">State:</span> {p.state}</p>
                <p className="t-body-sm m-0 mt-1"><span className="t-ui">Description:</span> {p.alt ? p.alt : <em>none given</em>}</p>
                {!["rejected", "removed"].includes(p.state) && <MediaDecisionForm mediaId={p.id} label={p.alt || "photo"} />}
              </li>
            ))}
          </ul>
        ) : <p className="t-body-sm m-0">No photos.</p>}
      </Panel>

      <Panel title="Hide, restore or remove">
        <VisibilityForm id={doc.id} state={doc.state} />
      </Panel>

      <Panel title="Search engines">
        <p className="t-body-sm m-0 mb-2">Current setting: <strong>{labelOf(INDEXING_CHOICES, doc.indexing)}</strong></p>
        {staff.isAdministrator ? <IndexingForm id={doc.id} current={doc.indexing} /> : <p className="t-body-sm text-ink-600 m-0">Only an administrator can change this.</p>}
      </Panel>

      {doc.type === "question" && (
        <>
          <Panel title="Duplicate of an earlier question">
            {duplicateOf && <p className="t-body-sm m-0 mb-2">Linked to: {typeof duplicateOf === "object" ? duplicateOf.title : "an earlier question"}</p>}
            <DuplicateForm id={doc.id} current={typeof duplicateOf === "object" ? duplicateOf?.id ?? null : duplicateOf} />
          </Panel>
          <Panel title="Accepted answer">
            {publishedReplies.length ? (
              <AcceptedAnswerForm id={doc.id} current={acceptedId} options={publishedReplies.map((r) => ({ id: r.id, label: `${r.authorName}: ${excerpt(r.body, 70)}` }))} />
            ) : <p className="t-body-sm m-0">There are no published answers.</p>}
          </Panel>
        </>
      )}

      {doc.type === "activity" && (
        <>
          <Panel title="Activity status">
            <p className="t-body-sm m-0 mb-2">Current status: <strong>{labelOf(EVENT_STATUSES, doc.activity?.eventStatus ?? "scheduled")}</strong></p>
            {["published", "hidden"].includes(doc.state) ? <EventStatusForm id={doc.id} current={doc.activity?.eventStatus ?? "scheduled"} /> : <p className="t-body-sm text-ink-600 m-0">The status can be set once the activity is published.</p>}
          </Panel>
          <Panel title="Fact check">
            <p className="t-body-sm m-0 mb-2">{doc.activity?.lastCheckedAt ? `Last checked ${formatDateTime(doc.activity.lastCheckedAt)}.` : "Not checked yet."} Organiser {doc.activity?.organiserVerified ? "confirmed" : "not confirmed"}.</p>
            <FactCheckForm id={doc.id} organiserVerified={Boolean(doc.activity?.organiserVerified)} />
          </Panel>
        </>
      )}

      <Panel title="Reports about this post">
        {view.reports.length ? (
          <ul className="list-none m-0 p-0 grid gap-3">
            {view.reports.map((r) => (
              <li key={r.id} className="border-l-4 border-line-500 pl-3 t-body-sm min-w-0">
                <p className="m-0"><span className="t-ui">{reportCategoryLabel(r.category)}</span> · about the {r.targetType} · {r.status} · {formatDateTime(r.createdAt)}</p>
                {r.details && <UserText text={r.details} className="mt-1" />}
              </li>
            ))}
          </ul>
        ) : <p className="t-body-sm m-0">No reports.</p>}
        {view.reports.some((r) => r.status === "open") && <p className="t-body-sm mt-3 mb-0"><Link href="/moderation/reports" className="text-marine-600">Resolve reports</Link></p>}
      </Panel>

      <Panel title="Replies">
        {view.replies.length ? (
          <ul className="list-none m-0 p-0 grid gap-4">
            {view.replies.map((r) => (
              <li key={r.id} className="border border-line-500 rounded-md p-3 min-w-0">
                <p className="t-body-sm m-0"><span className="t-ui">{r.authorName}</span> · {replyStateLabel(r.state)} · {formatDateTime(r.createdAt)}{r.id === acceptedId ? " · accepted answer" : ""}</p>
                <UserText text={r.body} className="t-body-sm mt-2" />
                {r.note && <p className="t-body-sm text-ink-600 m-0 mt-1">Moderator note: {r.note}</p>}
                <div className="mt-2"><ReplyDecisionForm replyId={r.id} state={r.state} /></div>
              </li>
            ))}
          </ul>
        ) : <p className="t-body-sm m-0">No replies.</p>}
      </Panel>

      <Panel title="Revision history">
        {view.revisions.length ? (
          <ol className="list-none m-0 p-0 grid gap-2 t-body-sm">
            {view.revisions.map((r) => (
              <li key={r.id}>Version {r.number} · {r.kind} · {r.reviewState} · {formatDateTime(r.createdAt)}{r.reason && <span className="block text-ink-600">Note: {r.reason}</span>}</li>
            ))}
          </ol>
        ) : <p className="t-body-sm m-0">No revisions.</p>}
      </Panel>

      <Panel title="Moderation history">
        {view.history.length ? (
          <ol className="list-none m-0 p-0 grid gap-2 t-body-sm">
            {view.history.map((h, i) => (
              <li key={i}>{formatDateTime(h.at)} · {actionLabel(h.action)} · {h.actor}{h.reason && <span className="block text-ink-600">Reason: {h.reason}</span>}</li>
            ))}
          </ol>
        ) : <p className="t-body-sm m-0">Nothing recorded yet.</p>}
        <p className="t-body-sm mt-3 mb-0"><Link href={`/moderation/log?post=${doc.id}`} className="text-marine-600">Open in the audit log</Link></p>
      </Panel>
    </>
  );
}
