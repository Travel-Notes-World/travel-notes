import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/community/ui";
import { RichBody } from "@/components/RichBody";
import { AustraliaBadge, formatDay, formatPublished } from "@/components/UpdateItem";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { getUpdate, type UpdateView } from "@/lib/content/updates";
import { siteUrl } from "@/lib/site";

/** One travel update: /updates/<slug>. Built on first visit and cached; publishing expires it. */
type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await getUpdate((await params).slug);
  if (!u) return {};
  return {
    title: u.seo.title,
    description: u.seo.description,
    alternates: { canonical: u.path },
    ...(u.seo.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "article", title: u.seo.title, description: u.seo.description, url: u.path, publishedTime: u.firstPublished, ...(u.updated ? { modifiedTime: u.updated } : {}) },
  };
}

/** Structured data built only from what the page shows. */
function newsJsonLd(u: UpdateView) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: u.title,
    description: u.summary,
    datePublished: u.firstPublished,
    dateModified: u.updated ?? u.firstPublished,
    articleSection: u.categoryLabel,
    mainEntityOfPage: `${siteUrl}${u.path}`,
    ...(u.author ? { author: { "@type": "Person", name: u.author.name, url: `${siteUrl}/authors/${u.author.slug}` } } : {}),
    publisher: { "@type": "Organization", name: "Travel Notes", url: siteUrl },
    isBasedOn: u.sources.map((s) => s.url),
    ...(u.destinations.length ? { about: u.destinations.map((d) => ({ "@type": "Place", name: d.name, url: `${siteUrl}/destinations/${d.path}` })) } : {}),
  };
}

export default async function UpdatePage({ params }: Props) {
  const u = await getUpdate((await params).slug);
  if (!u) notFound();
  const crumbs = [{ label: "Home", href: "/" }, { label: "Travel updates", href: "/updates" }, { label: u.title }];
  const main = u.sources[0];

  return (
    <article className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      <JsonLd data={[newsJsonLd(u), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 max-w-measure">
        <p className="t-meta text-ink-400 m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/updates?category=${u.category}`} className="text-ochre-700 no-underline hover:underline">{u.categoryLabel}</Link>
          {u.affectsAustralians && <AustraliaBadge />}
        </p>
        <h1 className="t-heading-1 mt-2 mb-3">{u.title}</h1>
        <p className="t-deck m-0">{u.summary}</p>
        <p className="t-body-sm text-ink-400 mt-5 mb-0">
          {u.author && <>By <Link href={`/authors/${u.author.slug}`} className="text-ink-900 font-medium no-underline hover:underline">{u.author.name}</Link>. </>}
          Published <time dateTime={u.firstPublished}>{formatPublished(u.firstPublished)}</time>
          {u.updated && <>, updated <time dateTime={u.updated}>{formatPublished(u.updated)}</time></>}.
        </p>
      </header>

      <dl className="mt-8 max-w-measure grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr] border border-paper-200 rounded-md p-4 md:p-5 bg-paper-000 t-body-sm m-0">
        {u.effectiveDate && <><dt className="font-semibold text-ink-900">Starts</dt><dd className="m-0 text-ink-600">{formatDay(u.effectiveDate)}</dd></>}
        {u.endDate && <><dt className="font-semibold text-ink-900">Ends</dt><dd className="m-0 text-ink-600">{formatDay(u.endDate)}</dd></>}
        <dt className="font-semibold text-ink-900">Applies to</dt>
        <dd className="m-0 text-ink-600">
          {u.destinations.length
            ? u.destinations.map((d, i) => (
                <span key={d.path}>
                  {i > 0 && ", "}
                  <Link href={`/destinations/${d.path}`} className="text-marine-600 underline">{d.name}</Link>
                </span>
              ))
            : "All destinations"}
        </dd>
        {main && (
          <>
            <dt className="font-semibold text-ink-900">Official source</dt>
            <dd className="m-0">
              <a href={main.url} rel="noopener noreferrer" target="_blank" className="text-marine-600 underline break-words">{main.name}<span className="sr-only"> (opens in a new tab)</span></a>
            </dd>
          </>
        )}
      </dl>

      {u.updateNote && (
        <p role="note" className="mt-6 max-w-measure t-body-sm border-l-4 border-ochre-500 pl-4 m-0">
          <strong>What changed{u.updated ? ` on ${formatPublished(u.updated)}` : ""}:</strong> {u.updateNote}
        </p>
      )}

      {u.body && (
        <div className="prose-tn mt-8">
          <RichBody data={u.body as Parameters<typeof RichBody>[0]["data"]} />
        </div>
      )}

      <section className="mt-12 max-w-measure border-t border-paper-200 pt-6" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="t-meta text-ink-400 m-0">Sources and corrections</h2>
        <ul className="t-body-sm mt-3 mb-0 pl-5">
          {u.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} rel="noopener noreferrer" target="_blank" className="text-marine-600 underline break-words">{s.name}<span className="sr-only"> (opens in a new tab)</span></a>
            </li>
          ))}
        </ul>
        <p className="t-body-sm text-ink-600 mt-4 mb-0">
          Rules and timetables can change quickly. Check the official source before you travel. Spotted something out of date?{" "}
          <Link href={`/contact?topic=correction&page=${encodeURIComponent(u.path)}`} className="text-marine-600 underline">Tell us</Link>{" "}
          or read <Link href="/corrections" className="text-marine-600 underline">how we handle corrections</Link>.
        </p>
      </section>

      <p className="mt-10 t-body-sm m-0"><Link href="/updates" className="text-marine-600 underline">All travel updates</Link></p>
    </article>
  );
}
