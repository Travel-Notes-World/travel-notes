import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/community/ui";
import { RichBody } from "@/components/RichBody";
import { UpdateItem } from "@/components/UpdateItem";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { canViewCommunity } from "@/lib/community/settings";
import { type DestinationPage, destinationRobots, getDestinationPage, getDestinationResolution } from "@/lib/content/destinations";

/**
 * A destination page, from the CMS: /destinations/japan, /destinations/japan/kyoto.
 *
 * Published destinations only. Pages are built on first visit and cached; publishing a destination
 * or a guide expires them. A path in the wrong letter case, or a path the destination used to have,
 * redirects (308) to the current address. Anything else is a 404.
 */
type Props = { params: Promise<{ path: string[] }> };

export const revalidate = 3600;

/** No page is built ahead of time: there are thousands of places, and most are never visited. */
export function generateStaticParams() {
  return [];
}

const requestedPath = (segments: string[]) => segments.map((s) => decodeURIComponent(s)).join("/");

async function load(segments: string[]): Promise<DestinationPage | null> {
  const resolution = await getDestinationResolution(requestedPath(segments));
  if (!resolution) return null;
  if (resolution.kind === "redirect") permanentRedirect(`/destinations/${resolution.path}`);
  return getDestinationPage(resolution.doc);
}

const crumbsFor = (page: DestinationPage) => [
  { label: "Destinations", href: "/destinations" },
  ...page.ancestors.map((a) => ({ label: a.name, href: `/destinations/${a.path}` })),
  { label: page.place.name },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).path);
  if (!page) return {};
  const { place } = page;
  const where = page.ancestors.at(-1)?.name;
  const title = `${place.name} travel guide`;
  const robots = destinationRobots(place);
  const description = place.summary || `Guides and practical advice for ${place.name}${where ? `, ${where}` : ""}.`;
  return {
    title,
    description,
    alternates: { canonical: `/destinations/${place.path}` },
    // An indexable page sets no robots rule of its own, so the site-wide pre-launch noindex still applies.
    ...(robots ? { robots } : {}),
    openGraph: { title, description, url: `/destinations/${place.path}` },
  };
}

export default async function DestinationRoute({ params }: Props) {
  const page = await load((await params).path);
  if (!page) notFound();
  const { place, ancestors, guides, guideTotal, places, placeTotal, updates } = page;
  const crumbs = crumbsFor(page);
  const communityOpen = await canViewCommunity(null).catch(() => false);
  const parent = ancestors.at(-1);

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      {/* The structured data is built from the same list as the visible breadcrumbs. */}
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 max-w-measure">
        {parent && <p className="t-meta text-ink-400 m-0">{parent.name}</p>}
        <h1 className="t-display-1 mt-2 m-0 flex items-baseline gap-3">
          {place.accent && <span aria-hidden="true" className="inline-block w-4 h-4 rounded-sm shrink-0" style={{ background: place.accent }} />}
          {place.name}
        </h1>
        {place.summary && <p className="t-deck mt-3 mb-0">{place.summary}</p>}
        {communityOpen && (
          <p className="t-body-sm mt-4 mb-0">
            <Link href={`/community/${place.path}`} className="text-marine-600 underline">Traveller questions and trip reports about {place.name}</Link>
          </p>
        )}
      </header>

      {page.body && (
        <div className="mt-10 max-w-measure">
          <RichBody data={page.body as Parameters<typeof RichBody>[0]["data"]} />
        </div>
      )}

      {/* Only shown when something has changed recently; no empty box. */}
      {updates.length > 0 && (
        <section className="mt-12 max-w-measure" aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="t-heading-2 m-0">What&apos;s changed for {place.name}</h2>
          <p className="t-body-sm text-ink-600 mt-2 mb-0">Recent changes that affect a trip here, each with its official source.</p>
          <div className="mt-4 grid gap-5">{updates.map((u) => <UpdateItem key={u.id} update={u} headingLevel="h3" />)}</div>
          <p className="t-body-sm mt-5 mb-0"><Link href="/updates" className="text-marine-600 underline">All travel updates</Link></p>
        </section>
      )}

      <section className="mt-12" aria-labelledby="guides-heading">
        <h2 id="guides-heading" className="t-heading-2 m-0 mb-6">Guides for {place.name}</h2>
        {guides.length ? (
          <>
            <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">{guides.map((g) => <ArticleCard key={g.slug} article={g} />)}</div>
            {guideTotal > guides.length && (
              <p className="t-body-sm mt-6 mb-0">
                <Link href={`/search?type=guide&destination=${place.id}`} className="text-marine-600 underline">All {guideTotal} guides for {place.name}</Link>
              </p>
            )}
          </>
        ) : (
          <p className="t-body-sm text-ink-600 m-0">
            No guides for {place.name} yet. <Link href="/guides" className="text-marine-600 underline">Browse all guides</Link>
          </p>
        )}
      </section>

      {places.length > 0 && (
        <section className="mt-12" aria-labelledby="places-heading">
          <h2 id="places-heading" className="t-heading-2 m-0 mb-6">Places in {place.name}</h2>
          <ul className="list-none m-0 p-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((p) => (
              <li key={p.id}>
                <Link href={`/destinations/${p.path}`} className="flex items-baseline justify-between gap-3 min-h-11 border border-paper-200 rounded-md px-4 py-3 no-underline text-ink-900 hover:border-marine-600">
                  <span className="t-ui font-semibold">{p.name}</span>
                  {p.guides > 0 && <span className="t-meta text-ink-400 shrink-0">{p.guides === 1 ? "1 guide" : `${p.guides} guides`}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {placeTotal > places.length && (
            <p className="t-body-sm mt-6 mb-0">
              <Link href={`/destinations?in=${place.path}`} className="text-marine-600 underline">All {placeTotal} places in {place.name}</Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
