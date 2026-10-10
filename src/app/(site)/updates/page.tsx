import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd, Pagination } from "@/components/community/ui";
import { UpdateItem } from "@/components/UpdateItem";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { UPDATE_CATEGORIES, categoryLabel, isCategory } from "@/lib/content/updateRules";
import { getUpdates } from "@/lib/content/updates";

/**
 * /updates: every published travel update, newest first, 20 a page, with a category filter.
 * Page 1 and the numbered pages are indexable; a category view is a filter, so it is kept out of
 * search engines (noindex, follow) and points its canonical at itself.
 */
type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

export const revalidate = 3600;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function read(params: Params) {
  const raw = one(params.category);
  const category = isCategory(raw) ? raw : null;
  const n = Number.parseInt(one(params.page), 10);
  const page = Number.isFinite(n) && n > 1 && n < 10_000 ? n : 1;
  return { category, page };
}

const hrefFor = (category: string | null, page: number) => {
  const q = new URLSearchParams();
  if (category) q.set("category", category);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/updates?${s}` : "/updates";
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { category, page } = read(await searchParams);
  const title = category ? `${categoryLabel(category)}: travel updates` : page > 1 ? `Travel updates, page ${page}` : "Travel updates";
  return {
    title,
    description: "Checked changes that affect travellers: entry rules, new routes, closures, safety advice and fees. Each update links to its official source.",
    alternates: { canonical: hrefFor(category, page), types: { "application/rss+xml": "/updates/feed.xml" } },
    ...(category ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function UpdatesPage({ searchParams }: Props) {
  const { category, page } = read(await searchParams);
  const list = await getUpdates({ category, page });
  const crumbs = [{ label: "Home", href: "/" }, { label: "Travel updates" }];

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-6 max-w-measure">
        <h1 className="t-heading-1 m-0">Travel updates</h1>
        <p className="t-deck mt-3 mb-0">
          Changes that affect your trip: entry rules, new routes, closures, safety advice and fees. Every update links to its official source, so you can check the details yourself.
        </p>
        <p className="t-body-sm mt-4 mb-0">
          <Link href="/newsletter" className="text-marine-600 underline">Get them in the weekly email</Link>
          <span aria-hidden="true"> · </span>
          <a href="/updates/feed.xml" className="text-marine-600 underline">RSS feed</a>
        </p>
      </header>

      <nav aria-label="Filter by category" className="mt-8">
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {[{ value: null, label: "All updates" }, ...UPDATE_CATEGORIES].map((c) => {
            const active = c.value === category;
            return (
              <li key={c.value ?? "all"}>
                <Link
                  href={hrefFor(c.value, 1)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center min-h-11 px-4 rounded-md t-ui no-underline border ${active ? "bg-ink-900 text-paper-000 border-ink-900" : "border-line-500 text-ink-900 hover:border-ink-900"}`}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-8 max-w-measure">
        {list.items.length ? (
          <>
            <p className="t-body-sm text-ink-600 m-0 mb-2">
              {list.total === 1 ? "1 update" : `${list.total} updates`}
              {list.totalPages > 1 ? `, page ${list.page} of ${list.totalPages}` : ""}
            </p>
            <div className="grid gap-6">{list.items.map((u) => <UpdateItem key={u.id} update={u} />)}</div>
            <Pagination page={list.page} totalPages={list.totalPages} href={(p) => hrefFor(category, p)} />
          </>
        ) : (
          <p className="t-body-sm text-ink-600 m-0">
            {page > 1 || category ? <>No updates here. <Link href="/updates" className="text-marine-600 underline">See all updates</Link></> : "No travel updates are published yet."}
          </p>
        )}
      </div>
    </div>
  );
}
