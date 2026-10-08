import type { Metadata } from "next";
import Link from "next/link";

import { ActivityList } from "@/components/community/event-parts";
import { CommunityClosed, EmptyState, PageHeader, PageShell, Pagination, buttonClass, inputClass, secondaryButtonClass } from "@/components/community/ui";
import { listActivities } from "@/lib/community/activities-extra";
import { ACTIVITY_CATEGORIES, ACTIVITY_FORMATS } from "@/lib/community/constants";
import { destinationsWithContent, getDestinationByPath } from "@/lib/community/destinations";
import { getViewer } from "@/lib/community/next/session";
import { canViewCommunity } from "@/lib/community/settings";
import { addDays, isLocalDate } from "@/lib/community/time";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Show = "upcoming" | "all" | "past";

const SHOW_OPTIONS: { value: Show; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "Upcoming and past" },
  { value: "past", label: "Past only" },
];

/** Read and check the filters in the address. Anything not recognised is ignored. */
function readFilters(raw: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const v = raw[key];
    return typeof v === "string" ? v.trim() : "";
  };
  const category = ACTIVITY_CATEGORIES.some((c) => c.value === one("category")) ? one("category") : "";
  const format = ACTIVITY_FORMATS.some((f) => f.value === one("format")) ? one("format") : "";
  const show = (SHOW_OPTIONS.some((s) => s.value === one("show")) ? one("show") : "upcoming") as Show;
  let from = isLocalDate(one("from")) ? one("from") : "";
  let to = isLocalDate(one("to")) ? one("to") : "";
  if (from && to && to < from) [from, to] = [to, from];
  const place = /^[a-z0-9/-]{1,120}$/.test(one("in")) ? one("in") : "";
  const page = Math.max(1, Math.floor(Number(one("page")) || 1));
  return { category, format, show, from, to, place, page };
}
type Filters = ReturnType<typeof readFilters>;

const isFiltered = (f: Filters) => Boolean(f.category || f.format || f.from || f.to || f.place || f.show !== "upcoming");

/** The address for a set of filters. Only non-default values appear, so each view has one address. */
function hrefFor(f: Filters, changes: Partial<Filters> = {}): string {
  const next = { ...f, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.place) params.set("in", next.place);
  if (next.category) params.set("category", next.category);
  if (next.format) params.set("format", next.format);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.show !== "upcoming") params.set("show", next.show);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString().replace(/%2F/g, "/");
  return qs ? `/activities?${qs}` : "/activities";
}

/**
 * Quick date ranges. Dates are matched against each event's own local date, so "this weekend"
 * means Saturday and Sunday where the event happens. Today is taken from UTC: no location is guessed.
 */
function quickRanges(now: Date) {
  const today = now.toISOString().slice(0, 10);
  const weekday = now.getUTCDay(); // 0 Sunday … 6 Saturday
  const saturday = weekday === 6 ? today : weekday === 0 ? addDays(today, -1) : addDays(today, 6 - weekday);
  return {
    weekend: { from: weekday === 0 ? today : saturday, to: addDays(saturday, 1) },
    next30: { from: today, to: addDays(today, 29) },
  };
}

/** The plain list and its numbered pages can be indexed; filtered views are for people, not search engines. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = readFilters(await searchParams);
  const filtered = isFiltered(f);
  return {
    title: f.page > 1 ? `Travel activities and events – page ${f.page}` : "Travel activities and events",
    description: "Upcoming meet-ups, public events and experiences around the world, listed by Travel Notes members and checked by a moderator.",
    alternates: filtered ? undefined : { canonical: f.page > 1 ? `/activities?page=${f.page}` : "/activities" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ActivitiesPage({ searchParams }: Props) {
  const f = readFilters(await searchParams);
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;

  const [destination, places] = await Promise.all([f.place ? getDestinationByPath(f.place) : Promise.resolve(null), destinationsWithContent({ max: 60 })]);
  const result = await listActivities({
    destinationId: destination?.id ?? null,
    category: f.category || null,
    format: f.format || null,
    show: f.show,
    fromDate: f.from || null,
    toDate: f.to || null,
    page: f.page,
  });
  const ranges = quickRanges(new Date());
  const placeOptions = destination && !places.some((p) => p.id === destination.id) ? [destination, ...places] : places;
  const filtered = isFiltered(f);
  const quick = [
    { label: "This weekend", href: hrefFor(f, ranges.weekend), active: f.from === ranges.weekend.from && f.to === ranges.weekend.to },
    { label: "Next 30 days", href: hrefFor(f, ranges.next30), active: f.from === ranges.next30.from && f.to === ranges.next30.to },
    { label: "Any date", href: hrefFor(f, { from: "", to: "" }), active: !f.from && !f.to },
  ];
  const heading = f.show === "past" ? "Past activities" : f.show === "all" ? "Upcoming and past activities" : "Upcoming activities";
  const submitHref = destination ? `/activities/new?destination=${destination.id}` : "/activities/new";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Activities"
        title={destination ? `Activities in ${destination.label}` : "Activities and events"}
        intro="Meet-ups, public events and experiences listed by members. Times are shown in each event’s local time. Travel Notes does not organise or endorse listed activities, and a moderator checks each one before it appears."
        actions={<Link href={submitHref} className={buttonClass}>Submit an activity</Link>}
      />

      <nav aria-label="Quick date ranges" className="mb-4">
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {quick.map((q) => (
            <li key={q.label}>
              <Link href={q.href} rel="nofollow" aria-current={q.active ? "page" : undefined} className={`inline-flex min-h-11 items-center px-4 rounded-md border t-ui no-underline ${q.active ? "bg-ink-900 text-paper-000 border-ink-900" : "border-line-500 text-ink-900"}`}>{q.label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <form method="get" action="/activities" role="search" aria-label="Filter activities" className="mb-8 border border-paper-200 rounded-md p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="f-in" className="block t-ui">Destination</label>
            <select id="f-in" name="in" defaultValue={destination?.path ?? ""} className={`${inputClass} mt-2`}>
              <option value="">Anywhere</option>
              {placeOptions.map((p) => <option key={p.id} value={p.path}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-category" className="block t-ui">Kind</label>
            <select id="f-category" name="category" defaultValue={f.category} className={`${inputClass} mt-2`}>
              <option value="">All kinds</option>
              {ACTIVITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-format" className="block t-ui">Format</label>
            <select id="f-format" name="format" defaultValue={f.format} className={`${inputClass} mt-2`}>
              <option value="">In person or online</option>
              {ACTIVITY_FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-from" className="block t-ui">From</label>
            <input id="f-from" name="from" type="date" defaultValue={f.from} className={`${inputClass} mt-2`} />
          </div>
          <div>
            <label htmlFor="f-to" className="block t-ui">To</label>
            <input id="f-to" name="to" type="date" defaultValue={f.to} className={`${inputClass} mt-2`} />
          </div>
          <div>
            <label htmlFor="f-show" className="block t-ui">Show</label>
            <select id="f-show" name="show" defaultValue={f.show} className={`${inputClass} mt-2`}>
              {SHOW_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <p className="t-body-sm text-ink-600 mt-3 mb-0">Dates are matched to each event’s local date. Cancelled activities are only shown under “Upcoming and past”.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className={buttonClass}>Show activities</button>
          {filtered && <Link href="/activities" className={secondaryButtonClass}>Clear filters</Link>}
        </div>
      </form>

      <h2 className="t-heading-2 mt-0 mb-4">{heading}</h2>
      <p className="t-body-sm text-ink-600 mt-0 mb-6" role="status">
        {result.total === 1 ? "1 activity" : `${result.total} activities`}
        {f.from || f.to ? ` ${f.from && f.to ? `from ${f.from} to ${f.to}` : f.from ? `from ${f.from}` : `up to ${f.to}`}` : ""}
        {destination ? ` in ${destination.label}` : ""}.
      </p>
      {result.items.length ? (
        <ActivityList cards={result.items} label={heading} />
      ) : (
        <EmptyState
          title={filtered ? "No activities match these filters." : "No upcoming activities yet."}
          action={<div className="flex flex-wrap gap-3"><Link href={submitHref} className={buttonClass}>Submit an activity</Link>{filtered && <Link href="/activities" className={secondaryButtonClass}>Clear filters</Link>}</div>}
        >
          {filtered ? "Try a wider date range or another destination." : "Activities appear here after a moderator approves them."}
        </EmptyState>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} href={(p) => hrefFor(f, { page: p })} />
    </PageShell>
  );
}
