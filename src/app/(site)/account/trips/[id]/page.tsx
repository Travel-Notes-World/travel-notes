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
import { PrintButton } from "@/components/community/print-button";
import { AiPanel, UnlockPrintForm } from "@/components/planner/ai-panel";
import { confirmListingPayment } from "@/lib/community/listings";
import { getSettings } from "@/lib/community/settings";
import { AI_MAX_DAYS, aiStatus } from "@/lib/planner/ai";
import { plannerHref } from "@/lib/planner/input";
import { aiPlanPaymentsFor, aiPlanPrice } from "@/lib/planner/payments";

export const dynamic = "force-dynamic";
// Generic title: a private plan's name is not put into page metadata.
export const metadata: Metadata = { title: "Trip plan", robots: { index: false, follow: false }, referrer: "no-referrer" };
// Writing a plan with AI can take most of a minute.
export const maxDuration = 60;

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
  // Coming back from Stripe: record the payment straight away (the webhook does the same).
  let paymentNote: "paid" | "pending" | null = null;
  if (query.paid && query.session_id) {
    const result = await confirmListingPayment(query.session_id).catch(() => ({ status: "unknown" as const, planId: undefined }));
    paymentNote = result.status === "paid" && result.planId === id ? "paid" : "pending";
    if (paymentNote === "paid") plan = await getPlanForEdit(member, id);
  }
  const settings = await getSettings();
  const price = aiPlanPrice(settings);
  const [unread, ai, invoices] = await Promise.all([unreadCount(member.id), aiStatus(member, id, { settings, canPay: price.charge }), aiPlanPaymentsFor(id)]);
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
        {query.planned && <Notice tone="success" title="Saved to your trips">Your days are set out below. Add stops, times and notes to each day, then press Save plan.</Notice>}
        {paymentNote === "paid" && <Notice tone="success" title="Payment received. Thank you!">{ai.paidCredit ? "Press “Fill my days with AI” below. " : ""}You can now print this plan or save it as a PDF.</Notice>}
        {paymentNote === "pending" && <Notice tone="info" title="We are still waiting for the payment">Stripe has not confirmed your payment yet. Refresh this page in a minute. If you closed the payment page, no money was taken.</Notice>}
        {query.cancelled && <Notice tone="info" title="Payment cancelled">No money was taken.</Notice>}
        {query.copied && <Notice tone="success" title="Itinerary copied">This is your own copy. Changing it does not change the original trip report.</Notice>}
        {view.source && (
          <p className="t-body-sm m-0 bg-paper-100 rounded-sm p-3">
            Based on {view.source.path ? <Link href={view.source.path} className="text-marine-600 underline">{view.source.title}</Link> : <span>“{view.source.title}” (no longer public)</span>} by {view.source.authorName}
            {view.source.copiedAt ? `, copied on ${formatDay(view.source.copiedAt)}` : ""}.
          </p>
        )}
      </div>

      {view.planner && (
        <p className="t-body-sm mb-6 max-w-measure">
          <Link
            href={plannerHref({ placeIds: view.planner.placeIds, start: view.startDate, days: Math.max(1, days.length), party: (view.planner.party as never) ?? null, pace: (view.planner.pace as never) ?? undefined })}
            className="text-marine-600 underline"
          >
            Open the Trip Planner ideas for this trip
          </Link>{" "}
          (guides, trip reports, when to go and what to check before you go).
        </p>
      )}

      <AiPanel
        id={view.id}
        status={{ available: ai.available, reason: ai.reason, freeLeft: ai.freeLeft, paidCredit: ai.paidCredit, priceText: price.text, canPay: ai.canPay, generated: ai.generated, tooLong: ai.tooLong, hasPlaces: ai.hasPlaces, maxDays: AI_MAX_DAYS }}
      />

      {view.ai.summary && (
        <section aria-labelledby="ai-summary-heading" className="mb-8 max-w-measure print:hidden">
          <h2 id="ai-summary-heading" className="t-heading-3 m-0">About these AI suggestions</h2>
          <p className="t-body-sm mt-2 mb-0 whitespace-pre-line">{view.ai.summary}</p>
          <p className="t-body-sm text-ink-600 mt-2 mb-0">Written by AI from Travel Notes content{view.ai.generatedAt ? ` on ${formatDay(view.ai.generatedAt)}` : ""}. Check opening times, prices, bookings and entry rules with official sources before you travel.</p>
        </section>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3 print:hidden">
        {view.ai.unlocked ? (
          <>
            <PrintButton />
            {invoices[0] && <Link href={`/account/invoices/${invoices[0].id}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Your invoice</Link>}
          </>
        ) : price.charge ? (
          <>
            <UnlockPrintForm id={view.id} priceText={price.text} />
            <p className="t-body-sm text-ink-600 m-0">Printing and saving as a PDF are included when you pay for this plan.</p>
          </>
        ) : null}
      </div>

      {view.ai.unlocked ? (
        <section aria-hidden="true" className="hidden print:block">
          <h2 className="t-heading-2">{view.title}</h2>
          {view.ai.summary && <p className="t-body-sm whitespace-pre-line">{view.ai.summary}</p>}
          {view.days.map((d, i) => (
            <div key={i} className="mt-4 break-inside-avoid">
              <h3 className="t-heading-3 m-0">Day {i + 1}{d.date ? ` · ${formatDay(d.date)}` : ""}{d.title ? ` · ${d.title}` : ""}</h3>
              <ul className="mt-1 mb-0 pl-5">
                {d.stops.map((s, j) => (
                  <li key={j} className="t-body-sm">
                    <strong>{s.title}</strong>{s.place ? ` (${s.place})` : ""}{s.origin === "ai_idea" ? " [AI idea, not checked]" : ""}{s.notes ? `: ${s.notes}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="t-body-sm mt-6">Printed from travelnotesworld.com. Check opening times, prices, bookings and entry rules with official sources before you travel.</p>
        </section>
      ) : (
        <p className="hidden print:block t-body">Printing this plan is available after paying for it in your Travel Notes account.</p>
      )}

      <div className="print:hidden">
      <PlanEditor id={view.id} title={view.title} startDate={view.startDate} endDate={view.endDate} notes={view.notes} days={days} />
      </div>

      <section aria-labelledby="delete-heading" className="print:hidden mt-12 border-t border-paper-200 pt-6 max-w-[860px]">
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
