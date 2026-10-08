import Link from "next/link";
import type { ReactNode } from "react";

import { CONTRIBUTION_STATES, EVENT_STATUSES, labelOf, TRAVEL_STYLES } from "@/lib/community/constants";
import { linkParts, paragraphs } from "@/lib/community/text";
import type { PublicAuthor } from "@/lib/community/types";

/**
 * Shared building blocks for community pages. They follow the Travel Notes design tokens
 * (src/app/globals.css) and keep text, focus and status readable without relying on colour alone.
 */

export const inputClass =
  "w-full min-h-11 px-3 py-2 rounded-sm border border-line-500 bg-paper-000 text-ink-900 t-body-sm placeholder:text-ink-400 aria-[invalid=true]:border-signal-error aria-[invalid=true]:border-2";
export const buttonClass = "inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-md bg-marine-600 text-on-marine t-ui no-underline hover:bg-marine-700 disabled:opacity-60 disabled:cursor-wait";
export const secondaryButtonClass = "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui no-underline hover:border-ink-900 disabled:opacity-60";
export const linkButtonClass = "t-ui text-marine-600 underline underline-offset-4 bg-transparent border-0 p-0 cursor-pointer min-h-11";

export function PageShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={`mx-auto ${narrow ? "max-w-[760px]" : "max-w-container"} px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-8`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, intro, actions }: { eyebrow?: string; title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mt-4 mb-8">
      {eyebrow && <p className="t-meta text-ink-400 m-0">{eyebrow}</p>}
      <h1 className="t-heading-1 mt-2 mb-0">{title}</h1>
      {intro && <div className="t-deck mt-3 max-w-measure">{intro}</div>}
      {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

type Tone = "info" | "success" | "warning" | "error";
const toneClass: Record<Tone, string> = {
  info: "bg-marine-100 border-marine-600",
  success: "bg-paper-100 border-signal-success",
  warning: "bg-ochre-100 border-ochre-500",
  error: "bg-paper-100 border-signal-error",
};
const toneLabel: Record<Tone, string> = { info: "Note", success: "Done", warning: "Please note", error: "There is a problem" };

/** A message box. The heading word ("Done", "There is a problem") carries the meaning, not just the colour. */
export function Notice({ tone = "info", title, children, id }: { tone?: Tone; title?: string; children?: ReactNode; id?: string }) {
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={`border-l-4 rounded-sm p-4 max-w-measure ${toneClass[tone]}`}>
      <p className="t-ui m-0">{title ?? toneLabel[tone]}</p>
      {children && <div className="t-body-sm mt-1 [&>p]:m-0 [&>p+p]:mt-2">{children}</div>}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="t-body-sm text-signal-error mt-1 mb-0 font-medium">
      <span aria-hidden="true">⚠ </span>{message}
    </p>
  );
}

/** Label, hint and error for one field, wired together with ids for screen readers. */
export function Field({ id, label, hint, error, required, children, optional }: { id: string; label: string; hint?: ReactNode; error?: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block t-ui text-ink-900">
        {label}
        {required && <span className="text-ink-600 font-normal"> (required)</span>}
        {optional && <span className="text-ink-600 font-normal"> (optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="t-body-sm text-ink-600 mt-1 mb-2">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** aria attributes for an input inside <Field>. */
export const describedBy = (id: string, hint?: unknown, error?: string) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined,
});

/** A status with a text label and a shape, so it is clear without colour. */
export function StatusBadge({ state, kind = "contribution" }: { state: string; kind?: "contribution" | "event" }) {
  const label = kind === "event" ? labelOf(EVENT_STATUSES, state) : labelOf(CONTRIBUTION_STATES, state);
  const strong = ["cancelled", "rejected", "removed", "hidden", "changes_requested", "postponed"].includes(state);
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 t-meta border ${strong ? "border-signal-error text-signal-error" : state === "published" || state === "scheduled" ? "border-signal-success text-signal-success" : "border-line-500 text-ink-600"}`}>
      <span aria-hidden="true">{strong ? "●" : state === "published" || state === "scheduled" ? "✓" : "○"}</span>
      {label || state}
    </span>
  );
}

/**
 * Text written by a member, shown as paragraphs. It is never interpreted as HTML. Web addresses
 * become links marked as user content, so they pass no ranking credit and open safely.
 */
export function UserText({ text, className = "", sponsored = false }: { text: string; className?: string; sponsored?: boolean }) {
  const rel = `ugc nofollow noopener noreferrer${sponsored ? " sponsored" : ""}`;
  return (
    <div className={`prose-tn ${className}`}>
      {paragraphs(text).map((paragraph, i) => (
        <p key={i} className="whitespace-pre-line">
          {linkParts(paragraph).map((part, j) => (part.kind === "link" ? <a key={j} href={part.href} rel={rel} target="_blank">{part.label}</a> : <span key={j}>{part.value}</span>))}
        </p>
      ))}
    </div>
  );
}

/** A member's name, linked to their public profile when they still have one. */
export function AuthorName({ author }: { author: PublicAuthor }) {
  if (!author.hasProfile || !author.handle) return <span>{author.displayName}</span>;
  return <Link href={`/travellers/${author.handle}`} className="text-ink-900 font-medium underline-offset-4 hover:underline">{author.displayName}</Link>;
}

export const styleLabel = (value: string | null) => labelOf(TRAVEL_STYLES, value);

export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Crawlable numbered pages: plain links with their own address, not "load more". */
export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2);
  return (
    <nav aria-label="Pages" className="mt-10">
      <ul className="flex flex-wrap items-center gap-2 list-none m-0 p-0 t-ui">
        {page > 1 && <li><Link rel="prev" href={href(page - 1)} className={secondaryButtonClass}>Previous</Link></li>}
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && pages[i - 1] !== p - 1 && <span aria-hidden="true">…</span>}
            {p === page ? <span aria-current="page" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-ink-900 text-paper-000">{p}</span> : <Link href={href(p)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line-500 no-underline text-ink-900">{p}</Link>}
          </li>
        ))}
        {page < totalPages && <li><Link rel="next" href={href(page + 1)} className={secondaryButtonClass}>Next</Link></li>}
      </ul>
    </nav>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-500 rounded-md p-6 max-w-measure bg-paper-000">
      <p className="t-card-title m-0">{title}</p>
      {children && <div className="t-body-sm text-ink-600 mt-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The line that separates member posts from editorial content. */
export function CommunityLabel() {
  return (
    <p className="t-body-sm text-ink-600 m-0">
      Written by a member of the community, not by the Travel Notes editorial team. <Link href="/community/guidelines" className="text-marine-600">How community posts work</Link>
    </p>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  // Every "<", ">" and "&" is escaped, so text typed by a member can never end the script block.
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Shown on community pages while the community is switched off for the public. */
export function CommunityClosed() {
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community" title="The community is not open yet" intro="Travel Notes will open its traveller community soon: questions, trip reports and activities from people around the world." />
      <p className="t-body-sm"><Link href="/" className="text-marine-600">Back to the travel guides</Link></p>
    </PageShell>
  );
}
