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
import { BudgetView } from "@/components/planner/budget-view";
import { DayPlan } from "@/components/planner/day-plan";
import { DaysView } from "@/components/planner/days-view";
import { NearbyTrips, type NearbyView } from "@/components/planner/nearby-trips";
import { PlanSteps } from "@/components/planner/plan-steps";
import { PlanTabs, type PlanTab } from "@/components/planner/plan-tabs";
import { TravelAdvice } from "@/components/planner/travel-advice";
import { deletePlanAction } from "@/lib/community/actions/plans";
import { isCommunityError } from "@/lib/community/errors";
import { confirmListingPayment } from "@/lib/community/listings";
import { formatMoney } from "@/lib/community/money";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";
import { getPlanForEdit } from "@/lib/community/plans";
import { canViewCommunity, getSettings } from "@/lib/community/settings";
import { formatYearMonth } from "@/lib/community/time";
import { tripAdvice } from "@/lib/planner/advice";
import { removePersonalDetailsAction } from "@/lib/planner/ai-actions";
import { AI_MAX_DAYS, aiStatus } from "@/lib/planner/ai";
import { audRange } from "@/lib/planner/budget";
import { CURRENCIES, FUNDING, INTERESTS } from "@/lib/planner/details";
import { nearbyPlaces, placeLegs, reportedCosts } from "@/lib/planner/extras";
import { plannerHref } from "@/lib/planner/input";
import { aiPlanPaymentsFor, aiPlanPrice } from "@/lib/planner/payments";
import { loadPriceFinder } from "@/lib/planner/prices";
import { dayTimeline } from "@/lib/planner/timeline";
import { paceOf, planBudget } from "@/lib/planner/trip-budget";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
// Generic title: a private plan's name is not put into page metadata.
export const metadata: Metadata = { title: "Trip plan", robots: { index: false, follow: false }, referrer: "no-referrer" };
// Writing a detailed plan with AI can take more than a minute.
export const maxDuration = 120;

const OPTION_LABEL = { budget: "Budget-friendly", balanced: "Balanced", premium: "Premium" } as const;

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
  const [unread, ai, invoices, legs, nearby, costs, advice, tripBudget] = await Promise.all([
    unreadCount(member.id),
    aiStatus(member, id, { settings, canPay: price.charge }),
    aiPlanPaymentsFor(id),
    placeLegs(payload, placeIds),
    unlocked ? nearbyPlaces(payload, placeIds) : Promise.resolve([]),
    unlocked ? reportedCosts(placeIds, community) : Promise.resolve([]),
    tripAdvice(payload, placeIds),
    planBudget(payload, view),
  ]);
  // The stored days carry the saved-post ids; the view carries the links that are public right now.
  const days: EditorDay[] = plan.days.map((d, i) => ({ ...d, stops: d.stops.map((s, j) => ({ ...s, saved: view.days[i]?.stops[j]?.saved ?? null })) }));
  const detailsFilled = Boolean(view.details.travellers || view.trip.flights.status !== "not_booked" || view.details.departFrom || view.details.interests.length || view.details.budgetAmount || view.details.accessibility || (view.purpose === "visa" && view.visa.arrivalDate));
  const hasStops = view.days.some((d) => d.stops.length > 0);
  const aiUsable = ai.available || ai.generated;
  const shareUrl = view.share.enabled && view.share.token ? `${siteUrl}/trip-planner/shared/${view.share.token}` : null;
  const placeName = (pid: string) => tripBudget?.places.find((p) => p.id === pid)?.name ?? "";

  // Sections of the plan. Days only appear once there is a budget to show them with.
  const dayCount = view.days.length;
  const tabs: PlanTab[] = [
    { key: "overview", label: "Overview" },
    ...(tripBudget ? [{ key: "budget", label: "Budget" }, ...view.days.map((_, i) => ({ key: `day-${i + 1}`, label: `Day ${i + 1}` }))] : []),
    ...(view.planner ? [{ key: "nearby", label: "Nearby trips" }] : []),
    { key: "documents", label: "Documents" },
  ];
  const current = tabs.some((t) => t.key === query.view) ? query.view! : "overview";
  const dayIndex = current.startsWith("day-") ? Number(current.slice(4)) - 1 : -1;

  // Nearby trips with their checked one-way fare, when there is one.
  let nearbyViews: NearbyView[] = [];
  if (current === "nearby" && nearby.length) {
    const { find } = await loadPriceFinder(payload, [...placeIds, ...nearby.map((n) => n.id)]);
    nearbyViews = nearby.map((n) => ({ ...n, fare: find("intercity", n.fromId, { toPlaceId: n.id }), dayUsed: view.choices.days.findIndex((d) => d.dayTrip === n.id) }))
      .map((n) => ({ ...n, dayUsed: n.dayUsed >= 0 ? n.dayUsed : null }));
  }
  const tripDays = tripBudget?.days ?? [];
  const middleDays = view.days.map((d, i) => ({ index: i, label: `Day ${i + 1}${d.date ? ` · ${formatDay(d.date)}` : ""}`, trip: view.choices.days[i]?.dayTrip ?? null })).filter((d) => d.index > 0 && d.index < dayCount - 1);

  let dayView: React.ReactNode = null;
  if (dayIndex >= 0 && tripBudget) {
    const b = tripBudget.budget;
    const dayLines = b.lines.filter((l) => l.day === dayIndex);
    const choice = view.choices.days[dayIndex];
    const tripId = choice?.dayTrip ?? null;
    const tripName = tripId ? (await payload.find({ collection: "destinations", where: { id: { equals: tripId } }, limit: 1, depth: 0, select: { name: true } })).docs[0]?.name ?? null : null;
    const entries = dayTimeline({ day: dayIndex, days: dayCount, setup: view.trip, pace: paceOf(view), choice, lines: dayLines, placeName: placeName(tripDays[dayIndex]?.placeId ?? ""), dayTripName: tripName });
    const upTo = b.byDay.filter((d) => d.day <= dayIndex);
    const spent = { lowCents: b.oneTime.lowCents + upTo.reduce((a, d) => a + d.lowCents, 0), highCents: b.oneTime.highCents + upTo.reduce((a, d) => a + d.highCents, 0) };
    const remaining = b.budget?.remaining ? { lowCents: b.budget.amountCents - spent.highCents, highCents: b.budget.amountCents - spent.lowCents } : null;
    const d = view.days[dayIndex];
    dayView = (
      <DayPlan
        id={view.id}
        day={dayIndex}
        title={`Day ${dayIndex + 1}${d.date ? ` · ${formatDay(d.date)}` : ""} · ${placeName(tripDays[dayIndex]?.placeId ?? "") || d.title}`}
        entries={entries}
        subtotal={b.byDay[dayIndex]}
        remaining={remaining}
        priceById={tripBudget.priceById}
        unavailableCount={dayLines.filter((l) => l.status === "unavailable").length}
      />
    );
    if (!choice?.slots.length && !tripId) {
      dayView = <>{dayView}<p className="t-body-sm text-ink-600 mt-4 max-w-measure">{unlocked ? "Activity choices appear here once the AI has written your detailed plan." : "Upgrade this plan for 2–3 activity choices for each part of every day, with ticket prices where Travel Notes has checked them."}</p></>;
    }
  }

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

      <TravelAdvice advice={advice} />
      <PlanTabs id={view.id} tabs={tabs} current={current} />

      {current === "overview" && (
        <>
          {view.planner && (
            <PlanSteps
              steps={[
                { label: "Trip details", hint: "Who is going, rooms and bookings, so the budget fits you.", done: detailsFilled, href: "#trip-details" },
                aiUsable
                  ? { label: "Your AI plan", hint: ai.generated ? (unlocked ? "Detailed plan written." : "Free plan written.") : "The AI writes your days. The first one is free.", done: ai.generated, href: "#ai-heading" }
                  : { label: "Your days", hint: "Add stops and notes to each day.", done: hasStops, href: "#days" },
                { label: "Budget and days", hint: "Check the costs and choose activities day by day.", done: false, href: tripBudget ? `?view=budget` : "#days" },
              ]}
            />
          )}

          {tripBudget && (
            <section aria-labelledby="summary-budget-heading" className="mb-8 max-w-[860px] rounded-md border-2 border-marine-600 p-4">
              <h2 id="summary-budget-heading" className="t-heading-3 m-0">Estimated trip cost: {audRange(tripBudget.budget.total)}</h2>
              <p className="t-body-sm mt-1 mb-0">For {tripBudget.budget.people} {tripBudget.budget.people === 1 ? "person" : "people"}, including a {tripBudget.budget.contingencyPercent}% safety margin.{tripBudget.budget.unavailable.length ? ` ${tripBudget.budget.unavailable.length} costs have no checked price yet and are not included.` : ""}{tripBudget.budget.budget?.remaining ? ` Left from your budget: ${audRange(tripBudget.budget.budget.remaining)}.` : ""}</p>
              <p className="t-body-sm mt-2 mb-0"><Link href="?view=budget" className="text-marine-600 underline">See the full budget</Link> · <Link href="?view=day-1" className="text-marine-600 underline">Go to day 1</Link></p>
            </section>
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
              <TripDetailsForm id={view.id} initial={{ purpose: view.purpose, ...view.details, ...view.visa, trip: view.trip }} interests={INTERESTS} funding={FUNDING} currencies={[...CURRENCIES]} />
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
              <p className="t-body-sm text-ink-600 mt-2 mb-0">Written by AI from Travel Notes content{view.ai.generatedAt ? ` on ${formatDay(view.ai.generatedAt)}` : ""}. Prices come only from your bookings and prices Travel Notes has checked. Check opening times, bookings and entry rules with official sources before you travel.</p>
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

          {unlocked && view.ai.options.length > 0 && (
            <section aria-labelledby="options-heading" className="mb-8 max-w-[860px]">
              <h2 id="options-heading" className="t-heading-3 m-0">Three ways to do this trip</h2>
              <p className="t-body-sm text-ink-600 mt-1 mb-3">The same days and places, with different choices. Costs for your own choices are in the budget.</p>
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

          {unlocked && costs.length > 0 && (
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

          {!unlocked && price.charge && ai.generated && (
            <section aria-labelledby="locked-heading" className="mb-8 max-w-measure border-t border-paper-200 pt-6">
              <h2 id="locked-heading" className="t-heading-3 m-0">Want the detailed version?</h2>
              <p className="t-body-sm mt-2">Upgrading adds 2–3 activity choices for every part of each day (with ticket prices where checked), a timed day plan, nearby day trips, {settings.planner.revisions} revisions, a share link and the PDF.</p>
              <UpgradeForm id={view.id} priceText={price.text} />
            </section>
          )}

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
        </>
      )}

      {current === "budget" && tripBudget && (
        <section id="budget" aria-labelledby="budget-heading" className="mb-10 max-w-[960px]">
          <h2 id="budget-heading" className="t-heading-2 m-0">Trip budget</h2>
          <p className="t-body-sm text-ink-600 mt-1 mb-4">Worked out from your trip details, your chosen activities and prices Travel Notes has checked. Change who is going or your bookings on the <Link href="?view=overview#trip-details" className="text-marine-600 underline">Overview</Link>, or your activities on each day, and the budget updates.</p>
          <BudgetView budget={tripBudget.budget} priceCount={tripBudget.prices} placeName={placeName} />
        </section>
      )}

      {dayView}

      {current === "nearby" && (unlocked
        ? <NearbyTrips id={view.id} places={nearbyViews} days={middleDays} />
        : (
          <section className="max-w-measure">
            <h2 className="t-heading-2 m-0">Nearby trips</h2>
            <p className="t-body-sm mt-2">Nearby cities and day trips, with distance and checked fares, are part of the detailed plan. Adding one to a day updates the budget.</p>
            {price.charge && <UpgradeForm id={view.id} priceText={price.text} />}
          </section>
        ))}

      {current === "documents" && (
        <section aria-labelledby="share-doc-heading" className="mb-8 max-w-[860px]">
          <h2 id="share-doc-heading" className="t-heading-2 m-0">PDF, print and sharing</h2>
          {unlocked ? (
            <>
              <p className="t-body-sm mt-2">A clean travel document with your chosen plan, daily costs, the budget, sources and check dates. No website menus or forms. Preview it and correct anything before you download.</p>
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <Link href={`/account/trips/${view.id}/document`} className={buttonClass}>Preview and download the PDF</Link>
                {invoices[0] && <Link href={`/account/invoices/${invoices[0].id}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Your invoice</Link>}
              </div>
              <div className="mt-4"><ShareForm id={view.id} enabled={view.share.enabled} url={shareUrl} /></div>
            </>
          ) : (
            <>
              <p className="t-body-sm mt-2">The PDF and a private share link are included when you upgrade this plan.</p>
              {price.charge && <UpgradeForm id={view.id} priceText={price.text} />}
            </>
          )}
        </section>
      )}
    </PageShell>
  );
}
