import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/ArticleCard";
import { type FilterOption, getGuideOptions, getGuidesPage, guidesHref, isFiltered, readGuideFilters, type GuideFilters } from "@/lib/content/guidesList";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * All published guides. Filtering works with a plain form (no JavaScript needed) and every filter
 * combination has its own address. Filtered lists are kept out of search engines because they
 * repeat the same guides; numbered pages of the full list stay indexable.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = readGuideFilters(await searchParams);
  const filtered = isFiltered(f);
  return {
    title: f.page > 1 && !filtered ? `Travel guides, page ${f.page}` : "Travel guides",
    description: "Destination guides, itineraries and practical travel advice, each dated, sourced and checked by the Travel Notes editors.",
    alternates: { canonical: filtered ? "/guides" : guidesHref({ page: f.page }) },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

const selectClass = "w-full min-h-11 rounded-md border border-line-500 bg-paper-000 px-3 t-ui text-ink-900";

function FilterSelect({ id, label, value, options, anyLabel }: { id: keyof GuideFilters; label: string; value: string; options: FilterOption[]; anyLabel: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={`f-${id}`} className="t-meta text-ink-600">{label}</label>
      <select id={`f-${id}`} name={id} defaultValue={value} className={selectClass}>
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
        ))}
      </select>
    </div>
  );
}

function Pagination({ f, pages }: { f: GuideFilters; pages: number }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, f.page - 1, f.page, f.page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const link = "inline-flex items-center justify-center min-w-11 min-h-11 px-3 rounded-md border t-ui no-underline";
  return (
    <nav aria-label="Pages" className="mt-12">
      <ul className="list-none m-0 p-0 flex flex-wrap items-center gap-2">
        {f.page > 1 && <li><Link href={guidesHref({ ...f, page: f.page - 1 })} className={`${link} border-paper-200 text-navy-900 hover:border-marine-600`} rel="prev">Previous</Link></li>}
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-2">
            {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden="true" className="text-ink-400">…</span>}
            {n === f.page ? (
              <span aria-current="page" className={`${link} border-navy-900 bg-navy-900 text-white`}>{n}</span>
            ) : (
              <Link href={guidesHref({ ...f, page: n })} className={`${link} border-paper-200 text-navy-900 hover:border-marine-600`} aria-label={`Page ${n}`}>{n}</Link>
            )}
          </li>
        ))}
        {f.page < pages && <li><Link href={guidesHref({ ...f, page: f.page + 1 })} className={`${link} border-paper-200 text-navy-900 hover:border-marine-600`} rel="next">Next</Link></li>}
      </ul>
    </nav>
  );
}

export default async function GuidesPage({ searchParams }: Props) {
  const f = readGuideFilters(await searchParams);
  const [result, options] = await Promise.all([getGuidesPage(f), getGuideOptions()]);
  // A page number past the end is not a page.
  if (f.page > 1 && f.page > result.pages) notFound();
  const filtered = isFiltered(f);
  const hasAnyOptions = options.types.length + options.countries.length + options.styles.length > 0;
  const chips = [
    f.type && { label: options.types.find((o) => o.value === f.type)?.label ?? f.type, href: guidesHref({ ...f, type: "", page: 1 }) },
    f.country && { label: options.countries.find((o) => o.value === f.country)?.label ?? f.country, href: guidesHref({ ...f, country: "", page: 1 }) },
    f.style && { label: options.styles.find((o) => o.value === f.style)?.label ?? f.style, href: guidesHref({ ...f, style: "", page: 1 }) },
  ].filter((c): c is { label: string; href: string } => Boolean(c));

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-16">
      <p className="t-eyebrow m-0">From the editors</p>
      <h1 className="t-display-1 mt-3 m-0">Travel guides</h1>
      <p className="t-deck mt-4 max-w-measure">
        Destination guides, itineraries and practical advice. Every guide shows when it was published, when its details were last checked, and its sources.
      </p>

      {hasAnyOptions && (
        <form action="/guides" method="get" className="mt-8 rounded-lg border border-paper-200 bg-paper-100 p-4 md:p-5" aria-label="Filter guides">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <FilterSelect id="country" label="Country" value={f.country} options={options.countries} anyLabel="All countries" />
            <FilterSelect id="type" label="Type of guide" value={f.type} options={options.types} anyLabel="All types" />
            <FilterSelect id="style" label="Travel style" value={f.style} options={options.styles} anyLabel="All styles" />
            <button type="submit" className="min-h-11 px-5 rounded-md bg-navy-900 text-white t-ui hover:bg-marine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marine-600">
              Show guides
            </button>
          </div>
        </form>
      )}

      {filtered && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <p className="t-body-sm text-ink-600 m-0 mr-1" role="status">
            {result.total === 1 ? "1 guide" : `${result.total} guides`} found
          </p>
          {chips.map((c) => (
            <Link key={c.href} href={c.href} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-pill border border-paper-200 bg-paper-000 t-ui text-navy-900 no-underline hover:border-marine-600">
              {c.label} <span aria-hidden="true">×</span><span className="sr-only">(remove this filter)</span>
            </Link>
          ))}
          <Link href="/guides" className="inline-flex items-center min-h-11 t-ui text-marine-600 underline">Clear all</Link>
        </div>
      )}

      {result.featured && (
        <section aria-labelledby="featured-heading" className="mt-10">
          <h2 id="featured-heading" className="sr-only">Featured guide</h2>
          <ArticleCard article={result.featured} hero />
        </section>
      )}

      {result.guides.length ? (
        <section aria-labelledby="all-heading" className={result.featured ? "mt-16" : "mt-10"}>
          <h2 id="all-heading" className={result.featured ? "t-heading-2 m-0 mb-6" : "sr-only"}>{filtered ? "Matching guides" : "Latest guides"}</h2>
          <div className="grid gap-x-6 gap-y-10 md:gap-x-8 md:grid-cols-2 lg:grid-cols-3">{result.guides.map((s) => <ArticleCard key={s.slug} article={s} />)}</div>
        </section>
      ) : !result.featured ? (
        <div className="mt-10 max-w-measure rounded-lg border border-paper-200 bg-paper-100 p-6 md:p-8">
          {filtered ? (
            <>
              <h2 className="t-heading-3 m-0">No guides match these filters</h2>
              <p className="t-body mt-3 mb-0">Try removing a filter, or <Link href="/guides" className="text-marine-600 underline">see all guides</Link>.</p>
            </>
          ) : (
            <>
              <h2 className="t-heading-3 m-0">The first guides are on their way</h2>
              <p className="t-body mt-3 mb-0">
                Meanwhile, read the latest <Link href="/updates" className="text-marine-600 underline">travel updates</Link> or{" "}
                <Link href="/newsletter" className="text-marine-600 underline">get the weekly newsletter</Link>.
              </p>
            </>
          )}
        </div>
      ) : null}

      <Pagination f={f} pages={result.pages} />
    </div>
  );
}
