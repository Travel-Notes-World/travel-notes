import type { Metadata } from "next";
import Link from "next/link";

import { AccountNav } from "@/components/community/account-nav";
import { CreatePlanForm, RenamePlanForm } from "@/components/community/account-forms";
import { EmptyState, formatDay, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { deletePlanAction } from "@/lib/community/actions/plans";
import { LIMITS } from "@/lib/community/constants";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";
import { listPlans } from "@/lib/community/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trip plans", robots: { index: false, follow: false } };

const summaryClass = "t-ui text-marine-600 cursor-pointer min-h-11 inline-flex items-center";

export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const member = await requireMemberPage("/account/trips");
  const [plans, unread] = await Promise.all([listPlans(member), unreadCount(member.id)]);
  const full = plans.length >= LIMITS.maxPlans;
  return (
    <PageShell>
      <PageHeader eyebrow="Your account" title="Trip plans" intro="Plan a trip day by day. Plans are private: only you can see them, and there is no sharing in this version." />
      <AccountNav current="trips" unread={unread} />
      {params.deleted && <div className="mb-6"><Notice tone="success" title="Deleted">The plan is deleted.</Notice></div>}

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="t-heading-2 m-0">Your plans <span className="text-ink-600 font-normal">({plans.length} of {LIMITS.maxPlans})</span></h2>
        {plans.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No plans yet">
              Start one below, or open a <Link href="/community/trips" className="text-marine-600">trip report</Link> and copy its itinerary into your own plan. Copying never changes the original report.
            </EmptyState>
          </div>
        ) : (
          <ul className="list-none m-0 p-0 mt-4 grid gap-4 max-w-[860px]">
            {plans.map((plan) => (
              <li key={plan.id} className="border-t border-paper-200 pt-4">
                <h3 className="t-card-title m-0"><Link href={`/account/trips/${plan.id}`} className="text-ink-900 no-underline hover:underline underline-offset-4">{plan.title}</Link></h3>
                <p className="t-body-sm text-ink-600 m-0 mt-1">
                  {[plan.startDate ? `Starts ${formatDay(plan.startDate)}` : null, plan.days === 1 ? "1 day" : `${plan.days} days`, `Updated ${formatDay(plan.updatedAt)}`].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-6">
                  <Link href={`/account/trips/${plan.id}`} className="t-ui text-marine-600 min-h-11 inline-flex items-center">Open<span className="sr-only">: {plan.title}</span></Link>
                  <details>
                    <summary className={summaryClass}>Rename<span className="sr-only">: {plan.title}</span></summary>
                    <RenamePlanForm id={plan.id} title={plan.title} />
                  </details>
                  <details>
                    <summary className="t-ui text-signal-error cursor-pointer min-h-11 inline-flex items-center">Delete<span className="sr-only">: {plan.title}</span></summary>
                    <form action={deletePlanAction} className="mt-2">
                      <input type="hidden" name="id" value={plan.id} />
                      <p className="t-body-sm mt-0">Delete “{plan.title}” with all its days and notes? This cannot be undone.</p>
                      <button type="submit" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100">Yes, delete the plan</button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="new-heading" className="mt-12 border-t border-paper-200 pt-8">
        <h2 id="new-heading" className="t-heading-2 m-0">Start a new plan</h2>
        {full ? <p className="t-body-sm mt-2">You can keep up to {LIMITS.maxPlans} plans. Delete one you no longer need to start another.</p> : <CreatePlanForm />}
      </section>
    </PageShell>
  );
}
