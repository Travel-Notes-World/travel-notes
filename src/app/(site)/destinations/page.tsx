import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { type ListedPlace, type PlaceWithGuides, getDestinationPage, getDestinationResolution, getDestinationsWithContent } from "@/lib/content/destinations";

/**
 * The destinations index, from the CMS. It lists only places with at least one published guide or
 * an editor-written introduction, never every imported place.
 *
 * `?in=<path>` lists every place with content inside one destination: the "All places in X" link
 * on a destination page whose list was cut short.
 */
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const within = (await searchParams).in;
  return {
    title: "Destinations",
    description: "Destination guides by country, region and city.",
    alternates: { canonical: "/destinations" },
    // A filtered list repeats destination pages; only the plain index is a page of its own.
    ...(within ? { robots: { index: false, follow: true } } : {}),
  };
}

function PlaceGrid({ places }: { places: (PlaceWithGuides & Partial<Pick<ListedPlace, "parentName">>)[] }) {
  return (
    <ul className="mt-10 list-none m-0 p-0 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {places.map((p) => (
        <li key={p.id}>
          <Link href={`/destinations/${p.path}`} className="group flex flex-col h-full rounded-lg overflow-hidden border border-paper-200 no-underline text-inherit hover:border-marine-600">
            <span aria-hidden="true" className="block h-1.5 bg-marine-600" style={p.accent ? { background: p.accent } : undefined} />
            <span className="flex flex-col flex-1 gap-2 p-5">
              {p.parentName && <span className="t-meta text-ink-400">{p.parentName}</span>}
              <span className="t-heading-3">{p.name}</span>
              {p.summary && <span className="t-body-sm text-ink-600 line-clamp-3">{p.summary}</span>}
              <span className="t-meta text-ink-400 mt-auto">{p.guides === 1 ? "1 guide" : p.guides ? `${p.guides} guides` : "Introduction"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DestinationsPage({ searchParams }: Props) {
  const raw = (await searchParams).in;
  const within = typeof raw === "string" ? raw : "";

  if (within) {
    const resolution = await getDestinationResolution(within);
    if (!resolution) notFound();
    if (resolution.kind === "redirect") permanentRedirect(`/destinations?in=${resolution.path}`);
    const page = await getDestinationPage(resolution.doc, null);
    const crumbs = [
      { label: "Destinations", href: "/destinations" },
      ...page.ancestors.map((a) => ({ label: a.name, href: `/destinations/${a.path}` })),
      { label: page.place.name, href: `/destinations/${page.place.path}` },
      { label: "All places" },
    ];
    return (
      <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
        <Breadcrumbs items={crumbs} />
        <h1 className="t-display-1 mt-6 m-0">Places in {page.place.name}</h1>
        <p className="t-deck mt-3 max-w-measure">Every place in {page.place.name} with a guide or an introduction, most guides first.</p>
        <PlaceGrid places={page.places} />
      </div>
    );
  }

  const places = await getDestinationsWithContent();
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-16">
      <h1 className="t-display-1 m-0">Destinations</h1>
      <p className="t-deck mt-3 max-w-measure">Places we have written about. A destination appears here once it has a published guide or an introduction from our editors.</p>
      {places.length ? (
        <PlaceGrid places={places} />
      ) : (
        <p className="t-body-sm text-ink-600 mt-8">
          No destination pages are ready yet. In the meantime, <Link href="/guides" className="text-marine-600 underline">browse all guides</Link>.
        </p>
      )}
    </div>
  );
}
