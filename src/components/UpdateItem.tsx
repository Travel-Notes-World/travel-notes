import Link from "next/link";

import type { UpdateView } from "@/lib/content/updates";

/** Publication times are shown in Sydney time; day-only dates (start, end) are stored at noon UTC. */
export const formatPublished = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function AustraliaBadge() {
  return <span className="inline-flex items-center rounded-sm bg-ochre-500/15 text-ochre-700 px-2 py-0.5 t-meta">Affects Australian travellers</span>;
}

/** One update in a list: category, date, headline, summary, places and source. */
export function UpdateItem({ update, headingLevel = "h2" }: { update: UpdateView; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const source = update.sources[0];
  return (
    <article className="border-t border-paper-200 pt-5">
      <p className="t-meta text-ink-400 m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ochre-700">{update.categoryLabel}</span>
        <time dateTime={update.firstPublished}>{formatPublished(update.firstPublished)}</time>
        {update.affectsAustralians && <AustraliaBadge />}
      </p>
      <Heading className="t-card-title mt-2 mb-0">
        <Link href={update.path} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">{update.title}</Link>
      </Heading>
      <p className="t-body-sm text-ink-600 mt-2 mb-0">{update.summary}</p>
      {(update.destinations.length > 0 || source) && (
        <p className="t-meta text-ink-400 mt-2 mb-0">
          {update.destinations.map((d, i) => (
            <span key={d.path}>
              {i > 0 && ", "}
              <Link href={`/destinations/${d.path}`} className="text-ink-600 underline">{d.name}</Link>
            </span>
          ))}
          {update.destinations.length > 0 && source && <span aria-hidden="true"> · </span>}
          {source && <>Source: {source.name}</>}
        </p>
      )}
    </article>
  );
}
