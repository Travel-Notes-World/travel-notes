import Link from "next/link";

import type { Planning } from "@/lib/content/destinations";

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });

/**
 * The "Key facts" box: short answers a traveller looks up again and again, each with its source.
 * Time zone comes from the destination record itself. Shown only when there is at least one fact.
 */
export function KeyFacts({ name, planning, headingId = "key-facts-heading" }: { name: string; planning: Planning; headingId?: string }) {
  const { facts, factsCheckedAt, timeZone, timeNeeded, bestRange } = planning;
  if (!facts.length && !timeNeeded && !bestRange) return null;
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-paper-200 bg-paper-000 shadow-card">
      <div className="px-5 pt-5 pb-3 border-b border-paper-200">
        <p className="t-eyebrow m-0">At a glance</p>
        <h2 id={headingId} className="t-heading-3 mt-1 m-0">Key facts: {name}</h2>
      </div>
      <dl className="m-0 px-5 divide-y divide-paper-200">
        {bestRange && <Row label="Best time to go" value={bestRange[0].toUpperCase() + bestRange.slice(1)} note={<a href="#when-to-go" className="text-marine-600 underline">Month by month</a>} />}
        {timeNeeded && <Row label="Time to allow" value={timeNeeded} />}
        {facts.map((f, i) => (
          <Row
            key={`${f.kind}-${i}`}
            label={f.label}
            value={f.value}
            note={f.source ? <>Source: <a href={f.source.url} className="text-marine-600 underline" rel="noopener">{f.source.name}</a></> : null}
          />
        ))}
        {timeZone && facts.length > 0 && <Row label="Time zone" value={`${timeZone.offset} (${timeZone.name.replace(/_/g, " ")})`} />}
      </dl>
      {factsCheckedAt && (
        <p className="t-body-sm text-ink-600 m-0 px-5 py-4 border-t border-paper-200 bg-paper-100 rounded-b-lg">
          Facts checked on <time dateTime={factsCheckedAt.slice(0, 10)}>{fmtDate(factsCheckedAt)}</time>. Rules change: check the source before you book.{" "}
          <Link href="/corrections" className="text-marine-600 underline">Report an error</Link>
        </p>
      )}
    </section>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="py-3">
      <dt className="t-meta text-ink-400 m-0">{label}</dt>
      <dd className="t-body-sm text-ink-900 m-0 mt-1 whitespace-pre-line">{value}</dd>
      {note && <dd className="t-meta text-ink-600 m-0 mt-1 font-normal tracking-normal">{note}</dd>}
    </div>
  );
}
