import Link from "next/link";
import type { ReactNode } from "react";

import { Breadcrumbs } from "./Breadcrumbs";

export type PolicySection = { id: string; title: string; body: ReactNode };

/**
 * The layout for the site's policy and trust pages (terms, privacy, cookies, editorial policy and
 * so on): a clear title, the date of the last change, a short summary, "On this page" links and
 * numbered sections. Text sits in readable paragraphs at the prose width.
 */
export function PolicyPage({
  title,
  updated,
  summary,
  sections,
  related = [],
}: {
  title: string;
  /** ISO date of the last real change to the text. */
  updated: string;
  summary: ReactNode;
  sections: PolicySection[];
  related?: { href: string; label: string }[];
}) {
  const updatedLabel = new Date(`${updated}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
      <header className="mt-6 max-w-measure">
        <p className="t-eyebrow m-0">About Travel Notes</p>
        <h1 className="t-display-1 mt-3 m-0">{title}</h1>
        <p className="t-meta text-ink-600 mt-4 mb-0">
          Last updated <time dateTime={updated}>{updatedLabel}</time>
        </p>
        <div className="t-deck mt-4 [&>p]:m-0 [&>p+p]:mt-3">{summary}</div>
      </header>

      {sections.length > 3 && (
        <nav aria-label="On this page" className="mt-8 max-w-measure rounded-lg border border-paper-200 bg-paper-100 p-5">
          <p className="t-meta text-ink-600 m-0">On this page</p>
          <ol className="m-0 mt-2 pl-5 t-body-sm grid gap-1 sm:grid-cols-2 sm:gap-x-8">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex items-center min-h-11 sm:min-h-0 sm:py-1 text-marine-600 underline">{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="max-w-measure">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="mt-12 scroll-mt-24">
            <h2 id={`${s.id}-heading`} className="t-heading-2 m-0">
              <span className="text-ink-400 font-normal mr-2" aria-hidden="true">{i + 1}.</span>
              {s.title}
            </h2>
            <div className="prose-tn mt-4 [&>:first-child]:mt-0 [&_ul]:list-disc [&_ol]:list-decimal [&_li+li]:mt-2">{s.body}</div>
          </section>
        ))}

        {related.length > 0 && (
          <aside aria-label="Related pages" className="mt-14 border-t border-paper-200 pt-6">
            <p className="t-meta text-ink-600 m-0">Related pages</p>
            <ul className="list-none m-0 mt-2 p-0 flex flex-wrap gap-x-6 gap-y-1">
              {related.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="inline-flex items-center min-h-11 t-ui text-marine-600 underline">{r.label}</Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

/** The one contact route for policy questions, used on every policy page. */
export const CONTACT_EMAIL = "hello@travelnotesworld.com";
export const ContactLine = () => (
  <p>
    Use our <Link href="/contact">contact form</Link> (choose the topic that fits) or email{" "}
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
  </p>
);
