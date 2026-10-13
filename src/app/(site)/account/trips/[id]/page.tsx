import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AccountNav } from "@/components/community/account-nav";
import { PlanEditor, type EditorDay } from "@/components/community/plan-editor";
import { buttonClass, formatDay, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { AiPanel, ShareForm, TripDetailsForm, UpgradeForm } from "@/components/planner/ai-panel";
import { DaysView } from "@/components/planner/days-view";
import { PlanSteps } from "@/components/planner/plan-steps";
import { deletePlanAction } from "@/lib/community/actions/plans";
import { isCommunityError } from "@/lib/community/errors";
import { confirmListingPayment } from "@/lib/community/listings";
import { formatMoney } from "@/lib/community/money";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";
import { getPlanForEdit } from "@/lib/community/plans";
import { canViewCommunity, getSettings } from "@/lib/community/settings";
import { formatYearMonth } from "@/lib/community/time";
import { removePersonalDetailsAction } from "@/lib/planner/ai-actions";
import { AI_MAX_DAYS, aiStatus } from "@/lib/planner/ai";
import { CURRENCIES, FUNDING, INTERESTS } from "@/lib/planner/details";
import { budgetGuide, nearbyPlaces, placeLegs, reportedCosts } from "@/lib/planner/extras";
import { plannerHref } from "@/lib/planner/input";
import { aiPlanPaymentsFor, aiPlanPrice } from "@/lib/planner/payments";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
// Generic title: a private plan's name is not put into page metadata.
export const metadata: Metadata = { title: "Trip plan", robots: { index: false, follow: false }, referrer: "no-referrer" };
// Writing a detailed plan with AI can take more than a minute.
export const maxDuration = 120;

const OPTION_LABEL = { budget: "Budget-friendly", balanced: "Balanced", premium: "Premium" } as const;
const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

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
  const payload = await getPayload({ config });
  const { view } = plan;
  const placeIds = view.planner?.placeIds ?? [];
  const unlocked = view.ai.unlocked;
  const community = await canViewCommunity(null);
  const [unread, ai, invoices, legs, nearby, costs] = await Promise.all([
    unreadCount(member.id),
    aiStatus(member, id, { settings, canPay: price.charge }),
    aiPlanPaymentsFor(id),
    placeLegs(payload, placeIds),
    unlocked ? nearbyPlaces(payload, placeIds) : Promise.resolve([]),
    unlocked ? reportedCosts(placeIds, community) : Promise.resolve([]),
  ]);
  const budget = budgetGuide(view.details, view.days.length);
  // The stored days carry the saved-post ids; the view carries the links that are public right now.
  const days: EditorDay[] = plan.days.map((d, i) => ({ ...d, stops: d.stops.map((s, j) => ({ ...s, saved: view.days[i]?.stops[j]?.saved ?? null })) }));
  const detailsFilled = Boolean(view.details.travellers || view.details.departFrom || view.details.interests.length || view.details.budgetAmount || view.details.accessibility || (view.purpose === "visa" && view.visa.arrivalDate));
  const hasStops = view.days.some((d) => d.stops.length > 0);
  const aiUsable = ai.available || ai.generated;
  const shareUrl = view.share.enabled && view.share.token ? `${siteUrl}/trip-planner/shared/${view.share.token}` : null;

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Your account", href: "/account" }, { label: "Trip plans", href: "/account/trips" }, { label: view.title }]} />
      <PageHeader eyebrow={unlocked ? "Private trip plan · Detailed" : "Private trip plan"} title={view.title} intro="Only you can see this plan unless you turn on a share link." />
      <AccountNav current="trips" unread={unread} />

      <div className="grid gap-4 mb-6 max-w-measure">
        {query.created && <Notice tone="success" title="Plan created">Add days and stops below, then press Save plan.</Notice>}
        {query.planned && <Notice tone="success" title="Saved to your trips">Add a few trip details below, then let the AI helper write your plan, or add your own stops.</Notice>}
        {paymentNote === "paid" && <Notice tone="success" title="Payment received. Thank you!">Your plan is upgraded. Press “Write my detailed plan” below.</Notice>}
        {paymentNote === "pending" && <Notice tone="info" title="We are still waiting for the payment">Stripe has not confirmed your payment yet. Refresh this page in a minute. If you closed the payment page, no money was taken.</Notice>}
        {query.cancelled && <Notice tone="info" title="Payment cancelled">No money was taken.</Notice>}
        {query.removed && <Notice tone="success" title="Personal details removed">Your name, accommodation, travel, funding and accessibility details were removed from this plan.</Notice>}
        {query.copied && <Notice tone="success" title="Itinerary copied">This is your own copy. Changing it does not change the original trip report.</Notice>}
        {view.source && (
          <p className="t-body-sm m-0 bg-paper-100 rounded-sm p-3">
            Based on {view.source.path ? <Link href={view.source.path} className="text-marine-600 underline">{view.source.title}</Link> : <span>“{view.source.title}” (no longer public)</span>} by {view.source.authorName}
            {view.source.copiedAt ? `, copied on ${formatDay(view.source.copiedAt)}` : ""}.
          </p>
        )}
      </div>

      {view.planner && (
        <PlanSteps
          steps={[
            { label: "Trip details", hint: "A few questions so the plan fits you.", done: detailsFilled, href: "#trip-details" },
            aiUsable
              ? { label: "Your AI plan", hint: ai.generated ? (unlocked ? "Detailed plan written." : "Free plan written.") : "The AI writes your days. The first one is free.", done: ai.generated, href: "#ai-heading" }
              : { label: "Your days", hint: "Add stops and notes to each day.", done: hasStops, href: "#days" },
            { label: "PDF and sharing", hint: unlocked ? "Download, print or share." : "Included when you upgrade a plan.", done: unlocked && Boolean(view.share.enabled), href: unlocked ? "#share-doc-heading" : "#ai-heading" },
          ]}
        />
      )}

      {view.planner && (
        <p className="t-body-sm mb-6 max-w-measure">
          <Link href={plannerHref({ placeIds, start: view.startDate, days: Math.max(1, days.length), party: (view.planner.party as never) ?? null, pace: (view.planner.pace as never) ?? undefined, purpose: view.purpose })} className="text-marine-600 underline">
            Open the Trip Planner ideas for this trip
          </Link>{" "}
          (guides, trip reports, when to go and what to check before you go).
        </p>
      )}

      {view.planner && (
        <details id="trip-details" className="mb-8 max-w-[860px] border border-paper-200 rounded-md p-4 scroll-mt-28" open={!detailsFilled}>
          <summary className="t-heading-3 cursor-pointer min-h-11 inline-flex items-center">1. Trip details{detailsFilled ? <span className="t-body-sm text-ink-600 font-normal ml-2">(saved, open to change)</span> : null}</summary>
          <TripDetailsForm
            id={view.id}
            initial={{ purpose: view.purpose, ...view.details, ...view.visa }}
            interests={INTERESTS}
            funding={FUNDING}
            currencies={[...CURRENCIES]}
          />
        </details>
      )}

      <AiPanel
        id={view.id}
        status={{ available: ai.available, reason: ai.reason, freeLeft: ai.freeLeft, unlocked: ai.unlocked, next: ai.next, blocked: ai.blocked, revisionsLeft: ai.revisionsLeft, revisionsIncluded: ai.revisionsIncluded, priceText: price.text, canPay: ai.canPay, generated: ai.generated, tooLong: ai.tooLong, hasPlaces: ai.hasPlaces, maxDays: AI_MAX_DAYS, purpose: ai.purpose }}
      />

      {view.ai.summary && (
        <section aria-labelledby="ai-summary-heading" className="mb-8 max-w-measure">
          <h2 id="ai-summary-heading" className="t-heading-3 m-0">About this plan</h2>
          <p className="t-body-sm mt-2 mb-0 whitespace-pre-line">{view.ai.summary}</p>
          <p className="t-body-sm text-ink-600 mt-2 mb-0">Written by AI from Travel Notes content{view.ai.generatedAt ? ` on ${formatDay(view.ai.generatedAt)}` : ""}. Check opening times, prices, bookings and entry rules with official sources before you travel.</p>
        </section>
      )}

      <section id="days" aria-labelledby="days-heading" className="mb-10 scroll-mt-28">
        <h2 id="days-heading" className="t-heading-2 m-0">Your days</h2>
        {hasStops ? (
          <>
            <div className="mt-4"><DaysView days={view.days} /></div>
            <details className="mt-8 max-w-[860px] border border-paper-200 rounded-md p-4">
              <summary className="t-ui cursor-pointer min-h-11 inline-flex items-center">Edit the days yourself</summary>
              <div className="mt-4"><PlanEditor id={view.id} title={view.title} startDate={view.startDate} endDate={view.endDate} notes={view.notes} days={days} /></div>
            </details>
          </>
        ) : (
          <div className="mt-4"><PlanEditor id={view.id} title={view.title} startDate={view.startDate} endDate={view.endDate} notes={view.notes} days={days} /></div>
        )}
      </section>

      {budget && (
        <section aria-labelledby="budget-heading" className="mb-8 max-w-measure">
          <h2 id="budget-heading" className="t-heading-3 m-0">Budget guidance</h2>
          <p className="t-body-sm mt-2 mb-0">
            Your budget of {money(budget.total, budget.currency)} over {budget.days} days is about <strong>{money(budget.perDay, budget.currency)} a day</strong>
            {budget.perPersonPerDay !== null ? <> or <strong>{money(budget.perPersonPerDay, budget.currency)} per person a day</strong></> : null}, before flights if they are included. This is your own budget divided up, not a price check.
          </p>
        </section>
      )}

      {unlocked && view.ai.options.length > 0 && (
        <section aria-labelledby="options-heading" className="mb-8 max-w-[860px]">
          <h2 id="options-heading" className="t-heading-3 m-0">Three ways to do this trip</h2>
          <p className="t-body-sm text-ink-600 mt-1 mb-3">The same days and places, with different choices. No prices are given: costs change and Travel Notes has not checked them.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {view.ai.options.map((o) => (
              <div key={o.style} className="border border-paper-200 rounded-md p-4">
                <h3 className="t-card-title m-0">{OPTION_LABEL[o.style]}</h3>
                <p className="t-body-sm mt-2 mb-0">{o.summary}</p>
                <p className="t-body-sm mt-2 mb-0 whitespace-pre-line">{o.choices}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {legs.length > 0 && (
        <section aria-labelledby="legs-heading" className="mb-8 max-w-measure">
          <h2 id="legs-heading" className="t-heading-3 m-0">Distances between your places</h2>
          <ul className="t-body-sm mt-2 mb-0 pl-5">{legs.map((l) => <li key={`${l.from}-${l.to}`}>{l.from} to {l.to}: about {l.km.toLocaleString("en-AU")} km in a straight line</li>)}</ul>
          <p className="t-body-sm text-ink-600 mt-1 mb-0">Real road and rail journeys are longer. Check times and fares with the transport operator.</p>
        </section>
      )}

      {unlocked ? (
        <>
          {nearby.length > 0 && (
            <section aria-labelledby="nearby-heading" className="mb-8 max-w-measure">
              <h2 id="nearby-heading" className="t-heading-3 m-0">Nearby places</h2>
              <ul className="t-body-sm mt-2 mb-0 pl-5">
                {nearby.map((n) => <li key={n.path}><Link href={`/destinations/${n.path}`} className="text-marine-600 underline">{n.name}</Link>: about {n.km} km away, {n.type === "day" ? "possible as a day trip" : "better with an overnight stay"}</li>)}
              </ul>
              <p className="t-body-sm text-ink-600 mt-1 mb-0">Our rule of thumb from straight-line distance (up to 150 km: day trip). Check real journey times before you decide.</p>
            </section>
          )}
          {costs.length > 0 && (
            <section aria-labelledby="costs-heading" className="mb-8 max-w-measure">
              <h2 id="costs-heading" className="t-heading-3 m-0">What travellers reported spending</h2>
              <ul className="t-body-sm mt-2 mb-0 pl-5 grid gap-1">
                {costs.map((c) => (
                  <li key={c.path}>
                    <Link href={c.path} className="text-marine-600 underline">{c.title}</Link>
                    {c.travelMonth ? ` (${formatYearMonth(c.travelMonth)})` : ""}: {c.totals.map((t) => formatMoney(t.totalMinor, t.currency)).join(" + ")}
                    {c.nights ? ` for ${c.nights} nights` : ""}{c.partySize ? `, ${c.partySize} ${c.partySize === 1 ? "person" : "people"}` : ""}{c.flightsIncluded ? ", flights included" : ""}{c.hasEstimates ? ", some amounts estimated" : ""}
                  </li>
                ))}
              </ul>
              <p className="t-body-sm text-ink-600 mt-1 mb-0">What one member spent on their own trip, in their currency. Prices change; use it as a rough guide only.</p>
            </section>
          )}
          <section aria-labelledby="share-doc-heading" className="mb-8 max-w-[860px] border-t border-paper-200 pt-6">
            <h2 id="share-doc-heading" className="t-heading-3 m-0">PDF, print and sharing</h2>
            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <Link href={`/account/trips/${view.id}/document`} className={buttonClass}>Preview and download the PDF</Link>
              {invoices[0] && <Link href={`/account/invoices/${invoices[0].id}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Your invoice</Link>}
            </div>
            <div className="mt-4"><ShareForm id={view.id} enabled={view.share.enabled} url={shareUrl} /></div>
          </section>
        </>
      ) : price.charge && ai.generated ? (
        <section aria-labelledby="locked-heading" className="mb-8 max-w-measure border-t border-paper-200 pt-6">
          <h2 id="locked-heading" className="t-heading-3 m-0">Want the detailed version?</h2>
          <p className="t-body-sm mt-2">Upgrading adds morning, afternoon and evening plans, where to stay, getting around, nearby places, {settings.planner.revisions} revisions, a share link and the PDF.</p>
          <UpgradeForm id={view.id} priceText={price.text} />
        </section>
      ) : null}


      <section aria-labelledby="privacy-heading" className="mt-12 border-t border-paper-200 pt-6 max-w-[860px] print:hidden">
        <h2 id="privacy-heading" className="t-heading-3 m-0">Your details</h2>
        <form action={removePersonalDetailsAction} className="mt-2">
          <input type="hidden" name="id" value={view.id} />
          <p className="t-body-sm mt-0">Remove your name, where you are travelling from, accessibility needs, accommodation, travel and funding details from this plan. The days stay.</p>
          <button type="submit" className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 t-ui hover:border-ink-900">Remove my personal details</button>
        </form>
        <h2 id="delete-heading" className="t-heading-3 mt-8 mb-0">Delete this plan</h2>
        <details className="mt-2">
          <summary className="t-ui text-signal-error cursor-pointer min-h-11 inline-flex items-center">I want to delete this plan</summary>
          <form action={deletePlanAction} className="mt-2">
            <input type="hidden" name="id" value={view.id} />
            <p className="t-body-sm mt-0">All its days, notes and details are deleted. This cannot be undone. A payment record (invoice) is kept for tax purposes.</p>
            <button type="submit" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100">Yes, delete the plan</button>
          </form>
        </details>
      </section>
    </PageShell>
  );
}
