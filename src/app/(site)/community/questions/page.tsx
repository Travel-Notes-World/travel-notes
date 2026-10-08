import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/community/cards";
import { CommunityClosed, EmptyState, PageHeader, PageShell, Pagination, buttonClass } from "@/components/community/ui";
import { getViewer } from "@/lib/community/next/session";
import { listPublished } from "@/lib/community/queries";
import { canViewCommunity } from "@/lib/community/settings";

type Props = { searchParams: Promise<Record<string, string | undefined>> };
const FILTERS = [
  { value: "", label: "All" },
  { value: "unanswered", label: "Unanswered" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
] as const;

/** Filtered views are for people, not search engines: only the plain list (and its pages) can be indexed. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { show, page } = await searchParams;
  const p = Number(page) || 1;
  return {
    title: p > 1 ? `Traveller questions – page ${p}` : "Traveller questions",
    description: "Questions from travellers around the world, answered by people who have been there.",
    alternates: { canonical: p > 1 ? `/community/questions?page=${p}` : "/community/questions" },
    robots: show ? { index: false, follow: true } : undefined,
  };
}

export default async function QuestionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  const show = FILTERS.some((f) => f.value === params.show) ? (params.show as "unanswered" | "open" | "resolved") : null;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await listPublished({ type: "question", question: show, page });
  const href = (p: number) => `/community/questions?${new URLSearchParams({ ...(show ? { show } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`.replace(/\?$/, "");
  return (
    <PageShell>
      <PageHeader eyebrow="Community" title="Traveller questions" intro="Ask about anywhere in the world. Answers come from members; every question and answer is checked by a moderator first." actions={<Link href="/community/questions/new" className={buttonClass}>Ask a question</Link>} />
      <nav aria-label="Filter questions" className="mb-8">
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {FILTERS.map((f) => {
            const active = (show ?? "") === f.value;
            return <li key={f.value}><Link href={f.value ? `/community/questions?show=${f.value}` : "/community/questions"} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center px-4 rounded-md border t-ui no-underline ${active ? "bg-ink-900 text-paper-000 border-ink-900" : "border-line-500 text-ink-900"}`}>{f.label}</Link></li>;
          })}
        </ul>
      </nav>
      {result.items.length ? (
        <CardList cards={result.items} label="Questions" />
      ) : (
        <EmptyState title={show === "unanswered" ? "Every question has an answer at the moment." : "No questions here yet."} action={<Link href="/community/questions/new" className={buttonClass}>Ask the first question</Link>}>
          Questions appear here after a moderator approves them.
        </EmptyState>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} href={href} />
    </PageShell>
  );
}
