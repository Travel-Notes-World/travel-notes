import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PlaceCard } from "@/components/destination/PageParts";
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
    description: "Destination guides by country, region and city: when to go, key facts checked against official sources, and practical guides.",
    alternates: { canonical: "/destinations" },
    // A filtered list repeats destination pages; only the plain index is a page of its own.
    ...(within ? { robots: { index: false, follow: true } } : {}),
  };
}

function PlaceGrid({ places }: { places: (PlaceWithGuides & Partial<Pick<ListedPlace, "parentName">>)[] }) {
  return (
    <ul className="mt-10 list-none m-0 p-0 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {places.map((p) => (
        <li key={p.id}><PlaceCard place={p} parentName={p.parentName} /></li>
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
      <p className="t-eyebrow m-0">Where to next</p>
      <h1 className="t-display-1 mt-3 m-0">Destinations</h1>
      <p className="t-deck mt-4 max-w-measure">
        Countries, regions and cities we have researched, each with when to go, key facts checked against official sources, and our guides.
      </p>
      {places.length ? (
        <PlaceGrid places={places} />
      ) : (
        <div className="mt-10 max-w-measure rounded-lg border border-paper-200 bg-paper-100 p-6 md:p-8">
          <h2 className="t-heading-3 m-0">The first destination guides are on their way</h2>
          <p className="t-body mt-3 mb-0">
            A destination appears here once its introduction or a guide is published. Meanwhile, read the latest{" "}
            <Link href="/updates" className="text-marine-600 underline">travel updates</Link> or{" "}
            <Link href="/guides" className="text-marine-600 underline">browse all guides</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
