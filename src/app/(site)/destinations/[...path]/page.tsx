import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/community/ui";
import { fmtDate, KeyFacts } from "@/components/destination/KeyFacts";
import { LocationMap } from "@/components/destination/LocationMap";
import { OnThisPage, PlaceCard, Questions, SourcesAndChecks } from "@/components/destination/PageParts";
import { Photo, PhotoCredit } from "@/components/destination/Photo";
import { WhenToGo } from "@/components/destination/WhenToGo";
import { RichBody } from "@/components/RichBody";
import { UpdateItem } from "@/components/UpdateItem";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { canViewCommunity } from "@/lib/community/settings";
import { type DestinationPage, destinationRobots, getDestinationPage, getDestinationResolution, hasOwnContent } from "@/lib/content/destinations";
import { siteUrl } from "@/lib/site";

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

const KIND_LABEL: Record<string, string> = { country: "Country", region: "Region", city: "City", area: "Travel area" };
const abs = (url: string) => (url.startsWith("http") ? url : `${siteUrl}${url}`);

/** The description used in search results and social cards: the editor's search text, then the summary. */
const describe = (page: DestinationPage) => {
  const where = page.ancestors.at(-1)?.name;
  return page.planning.seo.description || page.place.summary || `Guides and practical advice for ${page.place.name}${where ? `, ${where}` : ""}.`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).path);
  if (!page) return {};
  const { place, planning } = page;
  const title = planning.seo.title || `${place.name} travel guide`;
  const description = describe(page);
  const robots = destinationRobots(place);
  return {
    // `absolute` keeps an editor's full search title as written, without "| Travel Notes" added.
    title: planning.seo.title ? { absolute: title } : title,
    description,
    alternates: { canonical: `/destinations/${place.path}` },
    // An indexable page sets no robots rule of its own, so the site-wide pre-launch noindex still applies.
    ...(robots ? { robots } : {}),
    openGraph: {
      title,
      description,
      url: `/destinations/${place.path}`,
      ...(planning.photo ? { images: [{ url: abs(planning.photo.src), alt: planning.photo.alt }] } : {}),
    },
  };
}

/**
 * Structured data that matches what the page shows: the destination (with its photo, location and
 * the place it is in), the breadcrumbs and, when the page has them, its questions and answers.
 */
function structuredData(page: DestinationPage, crumbs: ReturnType<typeof crumbsFor>) {
  const { place, planning, ancestors } = page;
  const parent = ancestors.at(-1);
  const destination = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: place.name,
    description: describe(page),
    url: `${siteUrl}/destinations/${place.path}`,
    ...(planning.photo ? { image: abs(planning.photo.src) } : {}),
    ...(planning.location ? { geo: { "@type": "GeoCoordinates", latitude: planning.location.latitude, longitude: planning.location.longitude } } : {}),
    ...(parent ? { containedInPlace: { "@type": "Place", name: parent.name, url: `${siteUrl}/destinations/${parent.path}` } } : {}),
  };
  const faq = planning.faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: planning.faqs.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
      }
    : null;
  return [destination, breadcrumbJsonLd(crumbs), ...(faq ? [faq] : [])];
}

export default async function DestinationRoute({ params }: Props) {
  const page = await load((await params).path);
  if (!page) notFound();
  const { place, ancestors, guides, guideTotal, places, placeTotal, updates, planning } = page;
  const crumbs = crumbsFor(page);
  const communityOpen = await canViewCommunity(null).catch(() => false);
  const parent = ancestors.at(-1);
  const written = hasOwnContent(page);
  const empty = !written && !guides.length && !places.length;
  const showFacts = planning.facts.length > 0 || Boolean(planning.timeNeeded || planning.bestRange);
  const showAside = showFacts || Boolean(planning.location);

  const sections = [
    page.body ? { id: "overview", label: "Overview" } : null,
    planning.months ? { id: "when-to-go", label: "When to go" } : null,
    planning.facts.length ? { id: "key-facts", label: "Key facts" } : null,
    updates.length ? { id: "updates", label: "What's changed" } : null,
    guides.length ? { id: "guides", label: "Guides" } : null,
    places.length ? { id: "places", label: `Places in ${place.name}` } : null,
    planning.faqs.length ? { id: "questions", label: "Questions" } : null,
  ].filter((s): s is { id: string; label: string } => Boolean(s));

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      <JsonLd data={structuredData(page, crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className={`mt-6 ${planning.photo ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 lg:items-center" : ""}`}>
        <div className="max-w-measure">
          <p className="t-eyebrow m-0">{parent ? `${KIND_LABEL[place.kind] ?? "Destination"} in ${parent.name}` : KIND_LABEL[place.kind] ?? "Destination"}</p>
          <h1 className="t-display-1 mt-3 m-0 flex items-baseline gap-3">
            {place.accent && !planning.photo && <span aria-hidden="true" className="inline-block w-4 h-4 rounded-sm shrink-0" style={{ background: place.accent }} />}
            {place.name}
          </h1>
          {place.summary && <p className="t-deck mt-4 mb-0">{place.summary}</p>}
          {(planning.goodFor || planning.timeNeeded) && (
            <dl className="mt-6 m-0 grid gap-4 sm:grid-cols-2">
              {planning.goodFor && (
                <div className="border-l-2 border-ochre-500 pl-4">
                  <dt className="t-meta text-ink-400">Good for</dt>
                  <dd className="t-body-sm text-ink-900 m-0 mt-1">{planning.goodFor}</dd>
                </div>
              )}
              {planning.timeNeeded && (
                <div className="border-l-2 border-ochre-500 pl-4">
                  <dt className="t-meta text-ink-400">Time to allow</dt>
                  <dd className="t-body-sm text-ink-900 m-0 mt-1">{planning.timeNeeded}</dd>
                </div>
              )}
            </dl>
          )}
          {(planning.author || planning.factsCheckedAt) && (
            <p className="t-body-sm text-ink-600 mt-6 mb-0">
              {planning.author && (
                <>
                  By <Link href={`/authors/${planning.author.slug}`} className="text-ink-900 font-medium underline">{planning.author.name}</Link>
                </>
              )}
              {planning.author && planning.factsCheckedAt && <span aria-hidden="true"> · </span>}
              {planning.factsCheckedAt && <>Facts checked {fmtDate(planning.factsCheckedAt)}</>}
            </p>
          )}
          {communityOpen && (
            <p className="t-body-sm mt-3 mb-0">
              <Link href={`/community/${place.path}`} className="inline-flex items-center min-h-11 text-marine-600 underline">Traveller questions and trip reports about {place.name}</Link>
            </p>
          )}
        </div>
        {planning.photo && (
          <figure className="mt-8 lg:mt-0 m-0">
            <Photo photo={planning.photo} priority sizes="(min-width: 1216px) 620px, (min-width: 1024px) 52vw, 100vw" className="block w-full aspect-[4/3] rounded-lg" />
            <figcaption className="mt-2"><PhotoCredit photo={planning.photo} /></figcaption>
          </figure>
        )}
      </header>

      <OnThisPage items={sections} />

      {empty ? (
        <section className="mt-10 max-w-measure rounded-lg border border-paper-200 bg-paper-100 p-6 md:p-8" aria-labelledby="coming-heading">
          <h2 id="coming-heading" className="t-heading-3 m-0">Our {place.name} guide is not written yet</h2>
          <p className="t-body mt-3 mb-0">
            We only publish destination pages we have researched and checked. Until this one is ready, these may help:
          </p>
          <ul className="mt-3 mb-0 pl-5 t-body space-y-1">
            {parent && <li><Link href={`/destinations/${parent.path}`} className="text-marine-600 underline">{parent.name}</Link>, the {KIND_LABEL[parent.kind]?.toLowerCase() ?? "destination"} it is in</li>}
            <li><Link href="/updates" className="text-marine-600 underline">Travel updates</Link>: recent changes to entry rules, fees and closures</li>
            <li><Link href="/guides" className="text-marine-600 underline">All guides</Link></li>
          </ul>
        </section>
      ) : null}

      <div className={`mt-10 flex flex-col gap-12 ${showAside ? "lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-6" : ""}`}>
        {/* Key facts come first in reading order, so phones show them early; on wide screens they sit in the right column. */}
        {showFacts && (
          <aside id="key-facts" aria-label={`${place.name} at a glance`} className="order-1 lg:col-start-2 lg:row-start-1 self-start scroll-mt-28">
            <KeyFacts name={place.name} planning={planning} />
          </aside>
        )}
        {/* The map is not needed early on a phone, so it follows the main content there. */}
        {planning.location && (
          <div className={`order-3 lg:col-start-2 ${showFacts ? "lg:row-start-2" : "lg:row-start-1"} self-start`}>
            <LocationMap name={place.name} latitude={planning.location.latitude} longitude={planning.location.longitude} kind={place.kind} source={planning.location.source} />
          </div>
        )}

        <div className="order-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 min-w-0 space-y-14">
          {page.body && (
            <section id="overview" aria-label={`About ${place.name}`} className="scroll-mt-28">
              <div className="prose-tn [&>:first-child]:mt-0">
                <RichBody data={page.body as Parameters<typeof RichBody>[0]["data"]} />
              </div>
            </section>
          )}

          <WhenToGo name={place.name} planning={planning} />

          {/* Only shown when something has changed recently; no empty box. */}
          {updates.length > 0 && (
            <section id="updates" className="scroll-mt-28 max-w-measure" aria-labelledby="updates-heading">
              <h2 id="updates-heading" className="t-heading-2 m-0">What&apos;s changed for {place.name}</h2>
              <p className="t-body-sm text-ink-600 mt-2 mb-0">Recent changes that affect a trip here, each with its official source.</p>
              <div className="mt-4 grid gap-5">{updates.map((u) => <UpdateItem key={u.id} update={u} headingLevel="h3" />)}</div>
              <p className="t-body-sm mt-5 mb-0"><Link href="/updates" className="text-marine-600 underline">All travel updates</Link></p>
            </section>
          )}

          {!empty && (
            <section id="guides" className="scroll-mt-28" aria-labelledby="guides-heading">
              <h2 id="guides-heading" className="t-heading-2 m-0 mb-6">Guides for {place.name}</h2>
              {guides.length ? (
                <>
                  <div className={`grid gap-6 md:gap-8 md:grid-cols-2 ${showAside ? "" : "lg:grid-cols-3"}`}>{guides.map((g) => <ArticleCard key={g.slug} article={g} />)}</div>
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
          )}

          {places.length > 0 && (
            <section id="places" className="scroll-mt-28" aria-labelledby="places-heading">
              <h2 id="places-heading" className="t-heading-2 m-0 mb-6">Places in {place.name}</h2>
              <ul className={`list-none m-0 p-0 grid gap-6 sm:grid-cols-2 ${showAside ? "" : "lg:grid-cols-3"}`}>
                {places.map((p) => (
                  <li key={p.id}><PlaceCard place={p} /></li>
                ))}
              </ul>
              {placeTotal > places.length && (
                <p className="t-body-sm mt-6 mb-0">
                  <Link href={`/destinations?in=${place.path}`} className="text-marine-600 underline">All {placeTotal} places in {place.name}</Link>
                </p>
              )}
            </section>
          )}

          <Questions name={place.name} faqs={planning.faqs} />
          <SourcesAndChecks planning={planning} />
        </div>
      </div>
    </div>
  );
}
