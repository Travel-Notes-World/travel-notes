import type { Metadata } from "next";
import Link from "next/link";

import { ReportResolveForm } from "@/components/community/moderation-ui";
import { EmptyState, PageHeader, Pagination, UserText } from "@/components/community/ui";
import { listReports } from "@/lib/community/moderation";
import { requireModeratorPage } from "@/lib/community/next/session";
import { formatAge, formatDateTime, pageOf, reportCategoryLabel } from "../format";

export const metadata: Metadata = { title: "Reports" };

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
] as const;

/** Where to act on the reported item itself. */
function targetLink(r: { targetType: string; targetId: string; contributionId: string | null }): { href: string; label: string } | null {
  if (r.targetType === "member") return { href: `/moderation/members/${r.targetId}`, label: "Open the member" };
  if (r.contributionId) return { href: `/moderation/posts/${r.contributionId}`, label: r.targetType === "contribution" ? "Review the post" : `Review the post this ${r.targetType} belongs to` };
  return null;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireModeratorPage();
  const params = await searchParams;
  const status = STATUSES.find((s) => s.value === params.status)?.value ?? "open";
  const all = await listReports(staff, status);
  const { items, page, totalPages } = pageOf(all, Number(params.page) || 1);
  const href = (p: number) => `/moderation/reports?${new URLSearchParams({ ...(status !== "open" ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`.replace(/\?$/, "");
  return (
    <>
      <PageHeader title="Reports" intro="Act on the reported item first (hide, remove, correct or suspend), then close the report with a note of what was done. Reporting never removes anything by itself." />
      <nav aria-label="Filter reports" className="mb-6">
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {STATUSES.map((s) => (
            <li key={s.value}><Link href={s.value === "open" ? "/moderation/reports" : `/moderation/reports?status=${s.value}`} aria-current={status === s.value ? "page" : undefined} className={`inline-flex min-h-11 items-center px-3 rounded-md border t-ui no-underline ${status === s.value ? "bg-ink-900 text-paper-000 border-ink-900" : "border-line-500 text-ink-900"}`}>{s.label}</Link></li>
          ))}
        </ul>
      </nav>
      {items.length ? (
        <ol className="list-none m-0 p-0 grid gap-4" aria-label="Reports">
          {items.map((r) => {
            const link = targetLink(r);
            return (
              <li key={r.id} className="border border-line-500 rounded-md p-4 bg-paper-000 min-w-0">
                <p className="t-ui m-0">{reportCategoryLabel(r.category)}</p>
                <p className="t-body-sm m-0 mt-1 text-ink-600">About a {r.targetType}{r.contributionTitle ? ` on “${r.contributionTitle}”` : ""} · reported by {r.reporterName} · {formatDateTime(r.createdAt)}{status === "open" ? ` · open for ${formatAge(r.createdAt)}` : ""}</p>
                {r.details ? <UserText text={r.details} className="t-body-sm mt-2" /> : <p className="t-body-sm text-ink-600 m-0 mt-2">No details given.</p>}
                {link && <p className="t-body-sm m-0 mt-2"><Link href={link.href} className="text-marine-600">{link.label}</Link></p>}
                {status === "open" ? <div className="mt-3"><ReportResolveForm reportId={r.id} /></div> : r.resolution && <p className="t-body-sm m-0 mt-2"><span className="t-ui">Outcome:</span> {r.resolution}</p>}
              </li>
            );
          })}
        </ol>
      ) : <EmptyState title={status === "open" ? "No open reports." : `No ${status} reports.`} />}
      <Pagination page={page} totalPages={totalPages} href={href} />
    </>
  );
}
