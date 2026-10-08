import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/community/cards";
import { CommunityClosed, EmptyState, PageHeader, PageShell, Pagination, buttonClass, inputClass, secondaryButtonClass } from "@/components/community/ui";
import { TRAVEL_STYLES } from "@/lib/community/constants";
import { destinationsWithContent, getDestinationByPath } from "@/lib/community/destinations";
import { getViewer } from "@/lib/community/next/session";
import { listPublished } from "@/lib/community/queries";
import { canViewCommunity } from "@/lib/community/settings";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const styleValue = (value: string | undefined) => (TRAVEL_STYLES.some((s) => s.value === value) ? value! : null);

/** Filtered views are for people, not search engines: only the plain list (and its pages) can be indexed. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { destination, style, page } = await searchParams;
  const p = Number(page) || 1;
  return {
    title: p > 1 ? `Trip reports – page ${p}` : "Trip reports from travellers",
    description: "First-hand trip reports from travellers: what they did, day by day, and what it really cost.",
    alternates: { canonical: p > 1 ? `/community/trips?page=${p}` : "/community/trips" },
    robots: destination || style ? { index: false, follow: true } : undefined,
  };
}

export default async function TripsPage({ searchParams }: Props) {
  const params = await searchParams;
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  const style = styleValue(params.style);
  const place = params.destination ? await getDestinationByPath(params.destination) : null;
  const page = Math.max(1, Number(params.page) || 1);
  const [result, countries] = await Promise.all([
    listPublished({ type: "trip", destinationId: place?.id ?? null, style, page }),
    destinationsWithContent({ kind: "country", max: 60 }),
  ]);
  const filtered = Boolean(place || style);
  const query = (p: number) => new URLSearchParams({ ...(place ? { destination: place.path } : {}), ...(style ? { style } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
  const href = (p: number) => `/community/trips${query(p) ? `?${query(p)}` : ""}`;
  // The chosen place stays in the list even if it is not a country (for example from a city page link).
  const options = place && !countries.some((c) => c.id === place.id) ? [{ path: place.path, label: place.label }, ...countries] : countries;
  return (
    <PageShell>
      <PageHeader
        eyebrow="Community"
        title="Trip reports"
        intro="First-hand accounts from members: where they went, day by day, and what it cost. Every report is checked by a moderator before it appears."
        actions={<Link href="/community/trips/new" className={buttonClass}>Share a trip</Link>}
      />
      <form method="get" action="/community/trips" className="mb-8 flex flex-wrap items-end gap-4" aria-label="Filter trip reports">
        <div className="min-w-[12rem] flex-1 max-w-xs">
          <label htmlFor="filter-destination" className="block t-ui">Destination</label>
          <select id="filter-destination" name="destination" defaultValue={place?.path ?? ""} className={`${inputClass} mt-2`}>
            <option value="">All destinations</option>
            {options.map((c) => <option key={c.path} value={c.path}>{c.label}</option>)}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1 max-w-xs">
          <label htmlFor="filter-style" className="block t-ui">Travel style</label>
          <select id="filter-style" name="style" defaultValue={style ?? ""} className={`${inputClass} mt-2`}>
            <option value="">All styles</option>
            {TRAVEL_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button type="submit" className={secondaryButtonClass}>Show reports</button>
        {filtered && <Link href="/community/trips" className="t-ui text-marine-600 min-h-11 inline-flex items-center">Clear filters</Link>}
      </form>
      {params.destination && !place && <p className="t-body-sm text-ink-600 -mt-4 mb-6">That destination was not found, so all destinations are shown.</p>}
      {result.items.length ? (
        <CardList cards={result.items} label="Trip reports" />
      ) : (
        <EmptyState title={filtered ? "No trip reports match these filters yet." : "No trip reports yet."} action={<Link href="/community/trips/new" className={buttonClass}>Share your trip</Link>}>
          {filtered ? <p className="m-0">Try another destination or style, or <Link href="/community/trips" className="text-marine-600">see all trip reports</Link>.</p> : "Trip reports appear here after a moderator approves them."}
        </EmptyState>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} href={href} />
    </PageShell>
  );
}
