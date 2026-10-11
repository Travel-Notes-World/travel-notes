import Link from "next/link";

import type { Planning, PlaceWithGuides } from "@/lib/content/destinations";

import { fmtDate } from "./KeyFacts";
import { Photo } from "./Photo";

/** Common questions, always visible (not hidden in accordions), each answer straight under its question. */
export function Questions({ name, faqs }: { name: string; faqs: Planning["faqs"] }) {
  if (!faqs.length) return null;
  return (
    <section id="questions" aria-labelledby="questions-heading" className="scroll-mt-28">
      <h2 id="questions-heading" className="t-heading-2 m-0">Questions about visiting {name}</h2>
      <div className="mt-5 divide-y divide-paper-200 border-t border-paper-200">
        {faqs.map((q, i) => (
          <div key={i} className="py-5">
            <h3 className="t-card-title text-navy-900 m-0">{q.question}</h3>
            <p className="t-body mt-2 mb-0 whitespace-pre-line">{q.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * "How we made this page": who wrote it, when the facts were last checked, and every source used,
 * once each. Links to the editorial policy and corrections, so readers can judge and report.
 */
export function SourcesAndChecks({ planning }: { planning: Planning }) {
  const seen = new Set<string>();
  const sources = [...planning.facts.map((f) => f.source).filter((s): s is { name: string; url: string } => Boolean(s)), ...planning.sources].filter((s) => {
    const key = s.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!sources.length && !planning.author && !planning.factsCheckedAt) return null;
  return (
    <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-28 border-t border-paper-200 pt-8">
      <h2 id="sources-heading" className="t-heading-3 m-0">Sources and how we checked this page</h2>
      <ul className="list-none m-0 mt-3 p-0 t-body-sm text-ink-600 space-y-1">
        {planning.author && (
          <li>
            Written by <Link href={`/authors/${planning.author.slug}`} className="text-marine-600 underline">{planning.author.name}</Link>.
          </li>
        )}
        {planning.factsCheckedAt && <li>Key facts checked against their sources on {fmtDate(planning.factsCheckedAt)}.</li>}
        <li>
          Read our <Link href="/editorial-policy" className="text-marine-600 underline">editorial policy</Link> or{" "}
          <Link href="/corrections" className="text-marine-600 underline">tell us about a mistake</Link>.
        </li>
      </ul>
      {sources.length > 0 && (
        <ol className="m-0 mt-4 pl-5 t-body-sm space-y-1">
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} className="text-marine-600 underline break-words" rel="noopener">{s.name}</a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** A destination card: its photo (or signature colour), name, summary and how many guides it has. */
export function PlaceCard({ place, parentName }: { place: PlaceWithGuides; parentName?: string | null }) {
  return (
    <Link href={`/destinations/${place.path}`} className="group flex flex-col h-full rounded-lg overflow-hidden border border-paper-200 bg-paper-000 no-underline text-inherit hover:border-marine-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marine-600">
      {place.image ? (
        <Photo photo={place.image} sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="block w-full aspect-[3/2]" />
      ) : (
        <span aria-hidden="true" className="block h-1.5 bg-marine-600" style={place.accent ? { background: place.accent } : undefined} />
      )}
      <span className="flex flex-col flex-1 gap-2 p-5">
        {parentName && <span className="t-meta text-ink-400">{parentName}</span>}
        <span className="t-heading-3 group-hover:text-marine-700">{place.name}</span>
        {place.summary && <span className="t-body-sm text-ink-600 line-clamp-3">{place.summary}</span>}
        <span className="t-meta text-ink-400 mt-auto pt-2">{place.guides === 1 ? "1 guide" : place.guides ? `${place.guides} guides` : "Destination guide"}</span>
      </span>
    </Link>
  );
}

/** Jump links to the sections the page actually has. Hidden when there are fewer than three. */
export function OnThisPage({ items }: { items: { id: string; label: string }[] }) {
  if (items.length < 3) return null;
  return (
    <nav aria-label="On this page" className="mt-8">
      <p className="t-meta text-ink-400 m-0">On this page</p>
      <ul className="list-none m-0 mt-2 p-0 flex flex-wrap gap-2">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className="inline-flex items-center min-h-11 px-4 rounded-pill border border-paper-200 bg-paper-000 t-ui text-navy-900 no-underline hover:border-marine-600 hover:text-marine-700">
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
