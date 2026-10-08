import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader, Pagination } from "@/components/community/ui";
import { CONTRIBUTION_TYPES } from "@/lib/community/constants";
import { reviewQueue } from "@/lib/community/moderation";
import { requireModeratorPage } from "@/lib/community/next/session";
import { formatAge, formatDateTime, pageOf, typeLabel } from "../format";

export const metadata: Metadata = { title: "Review queue" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const KINDS = [
  { value: "", label: "All" },
  { value: "new", label: "New submissions" },
  { value: "edit", label: "Edits to published posts" },
] as const;

const chip = (active: boolean) => `inline-flex min-h-11 items-center px-3 rounded-md border t-ui no-underline ${active ? "bg-ink-900 text-paper-000 border-ink-900" : "border-line-500 text-ink-900"}`;

/** Posts waiting for a decision, oldest first, so nothing waits behind newer items. */
export default async function QueuePage({ searchParams }: Props) {
  const staff = await requireModeratorPage();
  const params = await searchParams;
  const type = CONTRIBUTION_TYPES.some((t) => t.value === params.type) ? params.type! : "";
  const kind = KINDS.some((k) => k.value === params.kind) ? params.kind! : "";
  const all = await reviewQueue(staff, { type: type || null, kind: kind || null });
  const { items, page, totalPages } = pageOf(all, Number(params.page) || 1);
  const href = (next: { type?: string; kind?: string; page?: number }) => {
    const q = new URLSearchParams();
    const t = next.type ?? type;
    const k = next.kind ?? kind;
    if (t) q.set("type", t);
    if (k) q.set("kind", k);
    if (next.page && next.page > 1) q.set("page", String(next.page));
    const s = q.toString();
    return s ? `/moderation/queue?${s}` : "/moderation/queue";
  };

  return (
    <>
      <PageHeader title="Review queue" intro={`${all.length} ${all.length === 1 ? "post is" : "posts are"} waiting${all.length >= 200 ? " (showing the oldest 200)" : ""}. Oldest first.`} />
      <nav aria-label="Filter the queue" className="mb-6 grid gap-3">
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0" aria-label="Type">
          <li><Link href={href({ type: "", page: 1 })} aria-current={!type ? "page" : undefined} className={chip(!type)}>All types</Link></li>
          {CONTRIBUTION_TYPES.map((t) => <li key={t.value}><Link href={href({ type: t.value, page: 1 })} aria-current={type === t.value ? "page" : undefined} className={chip(type === t.value)}>{t.label}</Link></li>)}
        </ul>
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0" aria-label="Kind">
          {KINDS.map((k) => <li key={k.value}><Link href={href({ kind: k.value, page: 1 })} aria-current={kind === k.value ? "page" : undefined} className={chip(kind === k.value)}>{k.label}</Link></li>)}
        </ul>
      </nav>

      {items.length ? (
        <ol className="list-none m-0 p-0 grid gap-3" aria-label="Posts waiting for review">
          {items.map((item) => (
            <li key={item.id} className="border border-line-500 rounded-md p-4 bg-paper-000 min-w-0">
              <p className="t-meta text-ink-600 m-0">{typeLabel(item.type)} · {item.kind === "edit" ? "Edit to a published post" : "New submission"}</p>
              <p className="t-card-title m-0 mt-1 break-words"><Link href={`/moderation/posts/${item.id}`} className="text-ink-900">{item.title || "(no title)"}</Link></p>
              <p className="t-body-sm text-ink-600 m-0 mt-1">
                By {item.authorId ? <Link href={`/moderation/members/${item.authorId}`} className="text-marine-600">{item.authorName}</Link> : item.authorName}
                {item.submittedAt && <> · sent {formatDateTime(item.submittedAt)} · waiting {formatAge(item.submittedAt)}</>}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing waiting here.">{type || kind ? "Try another filter." : "New submissions and edits appear here."}</EmptyState>
      )}
      <Pagination page={page} totalPages={totalPages} href={(p) => href({ page: p })} />
    </>
  );
}
