import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/community/cards";
import { CommunityClosed, EmptyState, Field, PageHeader, PageShell, buttonClass, describedBy, inputClass, secondaryButtonClass } from "@/components/community/ui";
import { destinationsWithContent, searchDestinations, type DestinationCount } from "@/lib/community/destinations";
import { getViewer } from "@/lib/community/next/session";
import { listPublished } from "@/lib/community/queries";
import { canViewCommunity } from "@/lib/community/settings";
import { cleanLine } from "@/lib/community/text";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

const ENTRY_POINTS = [
  { href: "/community/questions", title: "Questions", text: "Ask about anywhere in the world and get answers from people who have been there." },
  { href: "/community/trips", title: "Trip reports", text: "First-hand accounts of real trips: routes, costs, what worked and what did not." },
  { href: "/activities", title: "Activities", text: "Upcoming meet-ups, public events and local experiences shared by members." },
] as const;

/** A–Z groups by the first letter of the name, ignoring accents ("Éire" goes under E). */
function groupAtoZ(places: DestinationCount[]): [string, DestinationCount[]][] {
  const groups = new Map<string, DestinationCount[]>();
  const sorted = [...places].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  for (const place of sorted) {
    const first = place.name.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    groups.set(key, [...(groups.get(key) ?? []), place]);
  }
  return [...groups.entries()];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return { title: "Community", robots: { index: false, follow: false } };
  const place = one((await searchParams).place);
  const latest = await listPublished({ pageSize: 1 });
  return {
    title: "Traveller community",
    description: "Questions, trip reports and activities from travellers around the world, checked by moderators before they appear.",
    alternates: { canonical: "/community" },
    // A place search is for people, not search engines. An empty community is not worth indexing yet.
    robots: place || latest.total === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CommunityPage({ searchParams }: Props) {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  const place = cleanLine(one((await searchParams).place), 60);

  const [matches, countries, latest] = await Promise.all([
    place.length >= 2 ? searchDestinations(place, 12) : Promise.resolve([]),
    destinationsWithContent({ kind: "country", max: 200 }),
    listPublished({ pageSize: 8 }),
  ]);
  const groups = groupAtoZ(countries);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Community"
        title="Traveller community"
        intro={<p className="m-0">Questions, trip reports and activities from travellers around the world. Posts are written by members, not by the Travel Notes editorial team, and a moderator checks each one before it appears.</p>}
        actions={
          <>
            <Link href="/community/questions/new" className={buttonClass}>Ask a question</Link>
            <Link href="/community/trips/new" className={secondaryButtonClass}>Share a trip</Link>
            <Link href="/activities/new" className={secondaryButtonClass}>Submit an activity</Link>
          </>
        }
      />

      <nav aria-labelledby="sections-heading">
        <h2 id="sections-heading" className="sr-only">Community sections</h2>
        <ul className="grid gap-4 md:grid-cols-3 list-none m-0 p-0">
          {ENTRY_POINTS.map((e) => (
            <li key={e.href} className="border border-paper-200 rounded-md p-4 bg-paper-000">
              <h3 className="t-card-title m-0">
                <Link href={e.href} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">{e.title}</Link>
              </h3>
              <p className="t-body-sm text-ink-600 mt-1 mb-0">{e.text}</p>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="find-heading" className="mt-12">
        <h2 id="find-heading" className="t-heading-2 m-0">Find a place</h2>
        <form method="get" action="/community" role="search" className="max-w-measure">
          <Field id="place" label="Country, region or city" hint="For example: Japan, Bali or Lisbon. You choose the place; we never pick one for you from your location.">
            <div className="flex flex-wrap gap-2">
              <input {...describedBy("place", true)} name="place" type="search" defaultValue={place} autoComplete="off" maxLength={60} className={`${inputClass} flex-1 min-w-[12rem]`} />
              <button type="submit" className={buttonClass}>Find</button>
            </div>
          </Field>
        </form>
        {place.length >= 2 && (
          <div className="mt-6" aria-live="polite">
            {matches.length ? (
              <>
                <p className="t-body-sm text-ink-600 m-0">Places matching “{place}”:</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
                  {matches.map((d) => (
                    <li key={d.id}>
                      <Link href={`/community/${d.path}`} className="inline-flex min-h-11 items-center t-ui text-marine-600 underline-offset-4 hover:underline">{d.label}</Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState title={`No places match “${place}”.`} action={<Link href="/community/questions/new" className={secondaryButtonClass}>Ask a question anyway</Link>}>
                Check the spelling or try the country name. If the place is missing, you can <Link href="/account/suggest-destination" className="text-marine-600">suggest it</Link>; a moderator checks every new place before it is added.
              </EmptyState>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="countries-heading" className="mt-12">
        <h2 id="countries-heading" className="t-heading-2 m-0 mb-2">Countries with community posts</h2>
        {groups.length ? (
          <>
            <p className="t-body-sm text-ink-600 mt-0 mb-6 max-w-measure">Only places with at least one approved post are listed here. Use the search above to find any other place.</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {groups.map(([letter, places]) => (
                <div key={letter}>
                  <h3 className="t-ui text-ink-400 m-0 mb-2">{letter}</h3>
                  <ul className="list-none m-0 p-0 grid gap-1">
                    {places.map((d) => (
                      <li key={d.id}>
                        <Link href={`/community/${d.path}`} className="inline-flex min-h-11 items-center gap-2 t-body-sm text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">
                          {d.name}
                          <span className="t-meta text-ink-400 normal-case tracking-normal">{d.posts === 1 ? "1 post" : `${d.posts} posts`}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="No places have community posts yet." action={<Link href="/community/questions/new" className={buttonClass}>Ask the first question</Link>}>
            Places appear here once a moderator has approved a post about them.
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="latest-heading" className="mt-12">
        <h2 id="latest-heading" className="t-heading-2 m-0 mb-6">Latest posts</h2>
        {latest.items.length ? (
          <CardList cards={latest.items} label="Latest community posts" />
        ) : (
          <EmptyState title="Nothing has been published yet.">Posts appear here after a moderator approves them.</EmptyState>
        )}
      </section>

      <footer className="mt-12 border-t border-paper-200 pt-6 grid gap-2">
        <p className="t-body-sm text-ink-600 m-0 max-w-measure">
          Every member post follows the <Link href="/community/guidelines" className="text-marine-600">community guidelines</Link> and can be reported to the moderators.
        </p>
        <p className="t-body-sm text-ink-600 m-0">
          Place data from <a href="https://www.geonames.org/" className="text-marine-600">GeoNames</a>, licensed <a href="https://creativecommons.org/licenses/by/4.0/" rel="license" className="text-marine-600">CC BY 4.0</a>.
        </p>
      </footer>
    </PageShell>
  );
}
