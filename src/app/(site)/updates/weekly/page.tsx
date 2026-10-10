import type { Metadata } from "next";
import Link from "next/link";

import { formatPublished } from "@/components/UpdateItem";
import { getRecentUpdates } from "@/lib/content/updates";
import { siteUrl } from "@/lib/site";

/**
 * /updates/weekly: the updates published in the last 7 days, laid out to copy straight into the
 * weekly newsletter (Resend → Broadcasts). Public information, but not a page for search engines.
 */
export const metadata: Metadata = {
  title: "This week's travel updates",
  robots: { index: false, follow: true },
  alternates: { canonical: "/updates/weekly" },
};

export const revalidate = 3600;

export default async function WeeklyUpdatesPage() {
  const items = await getRecentUpdates(7);
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-16">
      <h1 className="t-heading-1 m-0">This week&apos;s travel updates</h1>
      <p className="t-body-sm text-ink-600 mt-3 max-w-measure">
        Published in the last 7 days, newest first. Copy this list into the weekly email. <Link href="/updates" className="text-marine-600 underline">All updates</Link>
      </p>
      {items.length ? (
        <ol className="mt-8 max-w-measure grid gap-6 pl-5">
          {items.map((u) => (
            <li key={u.id}>
              <p className="t-ui font-semibold m-0">
                <a href={`${siteUrl}${u.path}`} className="text-marine-600 underline">{u.title}</a>
              </p>
              <p className="t-body-sm m-0 mt-1">{u.summary}</p>
              <p className="t-meta text-ink-400 m-0 mt-1">
                {u.categoryLabel} · {formatPublished(u.firstPublished)}
                {u.sources[0] && <> · Source: {u.sources[0].name}</>}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="t-body-sm text-ink-600 mt-8">No updates were published in the last 7 days.</p>
      )}
    </div>
  );
}
