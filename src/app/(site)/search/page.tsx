import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/community/cards";
import { DestinationPicker } from "@/components/community/client";
import { EmptyState, Field, PageHeader, PageShell, Pagination, buttonClass, describedBy, inputClass, secondaryButtonClass } from "@/components/community/ui";
import { CONTRIBUTION_TYPES, TRAVEL_STYLES, type ContributionType } from "@/lib/community/constants";
import { destinationsByIds, isUuid } from "@/lib/community/destinations";
import { clientIp, getViewer } from "@/lib/community/next/session";
import { hashSubject, hit } from "@/lib/community/ratelimit";
import { SEARCH_QUERY_MAX, search, type SearchInput } from "@/lib/community/search";
import { canViewCommunity } from "@/lib/community/settings";
import { cleanLine } from "@/lib/community/text";

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

/** Search results are for people. They are never indexed, but links on them may be followed. */
export const metadata: Metadata = {
  title: "Search",
  description: "Search Travel Notes guides and community questions, trip reports and activities.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

const TYPES = [{ value: "", label: "Everything" }, ...CONTRIBUTION_TYPES.map((t) => ({ value: t.value, label: `${t.label}s` })), { value: "guide", label: "Editorial guides" }] as const;
const RECENT = [
  { value: "", label: "Any time" },
  { value: "30", label: "Last 30 days" },
  { value: "365", label: "Last 12 months" },
] as const;

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const utcDay = (value: string, endOfDay = false): Date | null => {
  if (!DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return endOfDay ? new Date(d.getTime() + 86_400_000) : d;
};

/** Read and validate the filters. Anything unknown is ignored, so a hand-edited address cannot cause an error. */
function readFilters(params: Params) {
  const q = cleanLine(one(params.q), SEARCH_QUERY_MAX);
  const typeRaw = one(params.type);
  const type = TYPES.some((t) => t.value === typeRaw && t.value) ? (typeRaw as ContributionType | "guide") : null;
  const destination = isUuid(one(params.destination)) ? one(params.destination) : "";
  const styleRaw = one(params.style);
  const style = TRAVEL_STYLES.some((s) => s.value === styleRaw) ? styleRaw : "";
  const recentRaw = one(params.recent);
  const recent = RECENT.some((r) => r.value === recentRaw) ? recentRaw : "";
  const from = type === "activity" && DATE.test(one(params.from)) ? one(params.from) : "";
  const to = type === "activity" && DATE.test(one(params.to)) ? one(params.to) : "";
  const page = Math.max(1, Math.floor(Number(one(params.page)) || 1));
  return { q, type, destination, style, recent, from, to, page };
}
type Filters = ReturnType<typeof readFilters>;

const hrefFor = (f: Filters, page: number) => {
  const entries = Object.entries({ q: f.q, type: f.type ?? "", destination: f.destination, style: f.style, recent: f.recent, from: f.from, to: f.to }).filter(([, v]) => v);
  if (page > 1) entries.push(["page", String(page)]);
  const qs = new URLSearchParams(entries).toString();
  return qs ? `/search?${qs}` : "/search";
};

export default async function SearchPage({ searchParams }: Props) {
  const viewer = await getViewer();
  const communityOpen = await canViewCommunity(viewer.staff);
  const f = readFilters(await searchParams);
  const [picked] = f.destination ? await destinationsByIds([f.destination]) : [];

  const input: SearchInput = {
    q: f.q,
    // While the community is closed only editorial guides are searched.
    type: communityOpen ? f.type : "guide",
    destinationId: picked?.id ?? null,
    style: f.style || null,
    recentDays: f.recent ? Number(f.recent) : null,
    from: f.from ? utcDay(f.from) : null,
    to: f.to ? utcDay(f.to, true) : null,
    page: f.page,
  };
  const hasInput = f.q.length >= 2 || Boolean(f.type && f.type !== "guide") || Boolean(picked) || Boolean(f.style);
  const ip = await clientIp();
  const allowed = !hasInput || !ip || (await hit("search_ip", hashSubject(ip))).allowed;
  const result = hasInput && allowed ? await search(input) : null;
  const nothing = result && result.items.length === 0 && result.guides.items.length === 0 && !result.guideError;
  const guidesOnly = input.type === "guide";

  return (
    <PageShell>
      <PageHeader eyebrow="Search" title="Search Travel Notes" intro={<p className="m-0">Search our editorial guides{communityOpen ? " and approved community questions, trip reports and activities" : ""}.</p>} />

      {!allowed && <p role="alert" className="t-body-sm max-w-measure">Too many searches from your connection in the last minute. Please wait a moment and try again.</p>}
      <form method="get" action="/search" role="search" className="max-w-[760px] border border-paper-200 rounded-md p-4 md:p-6 bg-paper-000">
        <Field id="q" label="Search words" hint="For example: Kyoto in autumn, ferry to Koh Tao, budget for Peru.">
          <input {...describedBy("q", true)} name="q" type="search" defaultValue={f.q} maxLength={SEARCH_QUERY_MAX} className={inputClass} />
        </Field>
        {communityOpen && (
          <>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field id="type" label="Show">
                <select {...describedBy("type")} name="type" defaultValue={f.type ?? ""} className={inputClass}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field id="style" label="Travel style">
                <select {...describedBy("style")} name="style" defaultValue={f.style} className={inputClass}>
                  <option value="">Any style</option>
                  {TRAVEL_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field id="recent" label="Published" hint="Applies when you search with words.">
                <select {...describedBy("recent", true)} name="recent" defaultValue={f.recent} className={inputClass}>
                  {RECENT.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
            </div>
            <DestinationPicker name="destination" label="Destination" max={1} hint="Optional. Type at least two letters of a country, region or city, then choose one. Posts about places inside it are included." initial={picked ? [{ id: picked.id, label: picked.label }] : []} />
            <fieldset className="mt-5 border-0 p-0 m-0 min-w-0">
              <legend className="t-ui text-ink-900 p-0">Activity dates <span className="text-ink-600 font-normal">(optional, activities only)</span></legend>
              <p id="dates-hint" className="t-body-sm text-ink-600 mt-1 mb-0">Choose “Activities” above. Shows activities that run at any time between these dates, including ones already under way.</p>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Field id="from" label="From">
                  <input {...describedBy("from")} aria-describedby="dates-hint" name="from" type="date" defaultValue={f.from} className={inputClass} />
                </Field>
                <Field id="to" label="To">
                  <input {...describedBy("to")} aria-describedby="dates-hint" name="to" type="date" defaultValue={f.to} className={inputClass} />
                </Field>
              </div>
            </fieldset>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" className={buttonClass}>Search</button>
          {(f.q || f.type || f.destination || f.style || f.recent || f.from || f.to) && <Link href="/search" className={secondaryButtonClass}>Clear</Link>}
        </div>
      </form>

      <div className="mt-10" aria-live="polite">
        {!result && <p className="t-body-sm text-ink-600 m-0 max-w-measure">Type at least two letters, or choose a filter, to see results.</p>}

        {result?.guideError && <p role="status" className="t-body-sm text-ink-600 mb-8 max-w-measure">Guide search is not available right now. Please try again in a moment.</p>}

        {result && result.guides.items.length > 0 && (
          <section aria-labelledby="guides-heading" className="mb-10">
            <h2 id="guides-heading" className="t-heading-2 m-0 mb-1">Editorial guides</h2>
            <p className="t-body-sm text-ink-600 mt-0 mb-4">
              {result.guides.total === 1 ? "1 guide" : `${result.guides.total} guides`}, written by the Travel Notes team.
              {guidesOnly && result.guides.totalPages > 1 ? ` Page ${result.guides.page} of ${result.guides.totalPages}.` : ""}
            </p>
            <ul className="list-none m-0 p-0 grid gap-5 max-w-measure">
              {result.guides.items.map((g) => (
                <li key={g.path} className="border-t border-paper-200 pt-4">
                  <Link href={g.path} className="t-card-title text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">{g.title}</Link>
                  {g.excerpt && <p className="t-body-sm text-ink-600 mt-1 mb-0">{g.excerpt}</p>}
                  <p className="t-meta text-ink-400 mt-2 mb-0">
                    {g.destination && <><Link href={`/destinations/${g.destination.path}`} className="text-ink-600 underline">{g.destination.name}</Link><span aria-hidden="true"> · </span></>}
                    {g.updated ? "Updated" : "Published"} <time dateTime={g.date}>{dateFmt.format(new Date(g.date))}</time>
                  </p>
                </li>
              ))}
            </ul>
            {guidesOnly ? (
              <Pagination page={result.guides.page} totalPages={result.guides.totalPages} href={(p) => hrefFor(f, p)} />
            ) : (
              result.guides.total > result.guides.items.length && (
                <p className="t-body-sm mt-5 mb-0"><Link href={hrefFor({ ...f, type: "guide" }, 1)} className="text-marine-600 underline">All {result.guides.total} guides</Link></p>
              )
            )}
          </section>
        )}

        {result && result.items.length > 0 && (
          <section aria-labelledby="community-heading">
            <h2 id="community-heading" className="t-heading-2 m-0 mb-1">Community posts</h2>
            <p className="t-body-sm text-ink-600 mt-0 mb-6">{result.total === 1 ? "1 post" : `${result.total} posts`}, written by members and checked by moderators.{result.totalPages > 1 ? ` Page ${result.page} of ${result.totalPages}.` : ""}</p>
            <CardList cards={result.items} label="Community search results" />
            <Pagination page={result.page} totalPages={result.totalPages} href={(p) => hrefFor(f, p)} />
          </section>
        )}

        {nothing && (
          <EmptyState title={f.q ? `Nothing found for “${f.q}”.` : "Nothing matches these filters."} action={communityOpen ? <Link href={picked ? `/community/questions/new?destination=${picked.id}` : "/community/questions/new"} className={buttonClass}>Ask the community</Link> : undefined}>
            <p className="m-0">Try fewer or different words, check the spelling, or remove a filter.{communityOpen ? " If nobody has asked yet, you can ask a question." : ""}</p>
          </EmptyState>
        )}
      </div>
    </PageShell>
  );
}
