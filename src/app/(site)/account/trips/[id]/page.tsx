import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AccountNav } from "@/components/community/account-nav";
import { PlanEditor, type EditorDay } from "@/components/community/plan-editor";
import { formatDay, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { deletePlanAction } from "@/lib/community/actions/plans";
import { isCommunityError } from "@/lib/community/errors";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";
import { getPlanForEdit } from "@/lib/community/plans";

export const dynamic = "force-dynamic";
// Generic title: a private plan's name is not put into page metadata.
export const metadata: Metadata = { title: "Trip plan", robots: { index: false, follow: false } };

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const member = await requireMemberPage(`/account/trips/${encodeURIComponent(id)}`);
  let plan: Awaited<ReturnType<typeof getPlanForEdit>>;
  try {
    plan = await getPlanForEdit(member, id);
  } catch (error) {
    // Another member's plan answers exactly like one that does not exist.
    if (isCommunityError(error) && error.code === "not_found") notFound();
    throw error;
  }
  const unread = await unreadCount(member.id);
  const { view } = plan;
  // The stored days carry the saved-post ids; the view carries the links that are public right now.
  const days: EditorDay[] = plan.days.map((d, i) => ({
    title: d.title,
    date: d.date,
    stops: d.stops.map((s, j) => ({ ...s, saved: view.days[i]?.stops[j]?.saved ?? null })),
  }));

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Your account", href: "/account" }, { label: "Trip plans", href: "/account/trips" }, { label: view.title }]} />
      <PageHeader eyebrow="Private trip plan" title={view.title} intro="Only you can see this plan." />
      <AccountNav current="trips" unread={unread} />

      <div className="grid gap-4 mb-6 max-w-measure">
        {query.created && <Notice tone="success" title="Plan created">Add days and stops below, then press Save plan.</Notice>}
        {query.copied && <Notice tone="success" title="Itinerary copied">This is your own copy. Changing it does not change the original trip report.</Notice>}
        {view.source && (
          <p className="t-body-sm m-0 bg-paper-100 rounded-sm p-3">
            Based on {view.source.path ? <Link href={view.source.path} className="text-marine-600 underline">{view.source.title}</Link> : <span>“{view.source.title}” (no longer public)</span>} by {view.source.authorName}
            {view.source.copiedAt ? `, copied on ${formatDay(view.source.copiedAt)}` : ""}.
          </p>
        )}
      </div>

      <PlanEditor id={view.id} title={view.title} startDate={view.startDate} endDate={view.endDate} notes={view.notes} days={days} />

      <section aria-labelledby="delete-heading" className="mt-12 border-t border-paper-200 pt-6 max-w-[860px]">
        <h2 id="delete-heading" className="t-heading-3 m-0">Delete this plan</h2>
        <details className="mt-2">
          <summary className="t-ui text-signal-error cursor-pointer min-h-11 inline-flex items-center">I want to delete this plan</summary>
          <form action={deletePlanAction} className="mt-2">
            <input type="hidden" name="id" value={view.id} />
            <p className="t-body-sm mt-0">All its days and notes are deleted. This cannot be undone.</p>
            <button type="submit" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100">Yes, delete the plan</button>
          </form>
        </details>
      </section>
    </PageShell>
  );
}
