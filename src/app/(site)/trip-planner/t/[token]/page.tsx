import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Notice, PageShell } from "@/components/community/ui";
import { GeneratingPoller, UnlockButton } from "@/components/planner/trip/trip-client";
import { BudgetTab, DailyTab, MapTab, OverviewTab, TABS, TripHeader, TripTabs, type Tab } from "@/components/planner/trip/trip-results";
import { confirmListingPayment } from "@/lib/community/listings";
import { getViewer } from "@/lib/community/next/session";
import { getSettings } from "@/lib/community/settings";
import { aiPlanPrice } from "@/lib/planner/payments";
import { retryTripAction } from "@/lib/planner/trip/actions";
import { PRICE_WARNING } from "@/lib/planner/trip/plan";
import { findTrip, tripPage } from "@/lib/planner/trip/store";

/**
 * One planned trip: /trip-planner/t/<token>. The token is long and random; the trip's details are
 * stored on the server, never in the address. Every page view rebuilds what this visitor may see
 * (tripPage → tripView), so locked days are never sent to a browser that has not paid.
 */
export const dynamic = "force-dynamic";
// "Try again" starts the generation again from this page.
export const maxDuration = 300;

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> };

export const metadata: Metadata = { title: "Your trip", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function TripPage({ params, searchParams }: Props) {
  const { token } = await params;
  const q = await searchParams;
  let trip = await findTrip(token);
  if (!trip) notFound();

  // Returning from Stripe: ask Stripe on the server whether the session was paid before unlocking.
  let paidNotice: "paid" | "pending" | null = null;
  if (q.paid && q.session_id) {
    const result = await confirmListingPayment(q.session_id).catch(() => ({ status: "unknown" as const }));
    paidNotice = result.status === "paid" ? "paid" : "pending";
    trip = (await findTrip(token))!;
  }

  const { member } = await getViewer();
  const page = tripPage(trip, member?.id ?? null);
  const settings = await getSettings();
  const price = aiPlanPrice(settings);
  const crumbs = [{ label: "Home", href: "/" }, { label: "Trip Planner", href: "/trip-planner" }, { label: trip.title }];

  if (page.state === "generating") {
    return (
      <PageShell>
        <Breadcrumbs items={crumbs} />
        <h1 className="t-heading-1 mt-2 mb-4">Planning {trip.title}</h1>
        <GeneratingPoller seconds={page.seconds} />
      </PageShell>
    );
  }
  if (page.state === "failed") {
    return (
      <PageShell>
        <Breadcrumbs items={crumbs} />
        <h1 className="t-heading-1 mt-2 mb-4">{trip.title}</h1>
        <Notice tone="error" title="Your trip could not be finished">{page.trip.error ?? "Something went wrong while planning your trip."} Your details are saved.</Notice>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={retryTripAction}><input type="hidden" name="token" value={trip.token} /><button type="submit" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md bg-marine-600 text-on-marine t-ui hover:bg-marine-700">Try again</button></form>
          <Link href={`/trip-planner?edit=${trip.token}`} className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui no-underline hover:border-ink-900">Edit trip</Link>
        </div>
      </PageShell>
    );
  }

  const { view, full } = page;
  const tab: Tab = TABS.some((t) => t.value === q.tab) ? (q.tab as Tab) : "overview";
  const owned = !trip.memberId || trip.memberId === member?.id;
  const lockedCount = view.days.filter((d) => d.locked).length;
  const needsPaymentForPdf = !full;
  const unlock = <UnlockButton token={trip.token} priceText={price.text} canPay={price.charge} />;
  const pricePanel = (
    <div className="rounded-md border-2 border-ochre-600 bg-ochre-100 p-4">
      <p className="t-ui m-0">{lockedCount > 0 ? `Unlock days ${view.previewDays + 1}–${view.days.length}, their map stops and the PDF` : "Download your full trip as a PDF"}</p>
      <p className="t-body-sm mt-1 mb-3">A one-off planner fee of {price.text} for this trip. It is not part of your travel costs, and nothing is booked for you. You keep the plan exactly as shown here, with {settings.planner.revisions} changes included.</p>
      {unlock}
    </div>
  );

  return (
    <PageShell>
      <Breadcrumbs items={crumbs} />
      <div className="grid gap-3 mb-4 max-w-measure">
        {paidNotice === "paid" && <Notice tone="success" title="Payment received">Your full trip is unlocked. You can download the PDF below.</Notice>}
        {paidNotice === "pending" && <Notice tone="info" title="Payment not confirmed yet">Stripe has not confirmed the payment yet. Refresh this page in a minute. You will not be charged twice.</Notice>}
        {q.cancelled && <Notice tone="info" title="Payment cancelled">No money was taken. Your trip is still here.</Notice>}
        {q.problem && <Notice tone="error" title="That change was not saved">{q.problem}</Notice>}
        {trip.unlocked && !full && <Notice tone="info" title="This trip is unlocked for another account">Sign in to the account that paid for it to see every day.</Notice>}
        {q.unlock && member && !full && <Notice tone="info" title="You are signed in">Press the unlock button to continue to the secure payment page.</Notice>}
      </div>

      <TripHeader form={trip.form} view={view} token={trip.token} canEdit={owned} />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        {full ? <a href={`/trip-planner/t/${trip.token}/pdf`} className="inline-flex items-center justify-center min-h-11 px-5 rounded-md bg-marine-600 text-on-marine t-ui no-underline hover:bg-marine-700">Download PDF</a> : null}
        {!full && lockedCount === 0 && needsPaymentForPdf && <p className="t-body-sm m-0">Every day of this trip is free to view. Unlock it for the PDF and paid changes.</p>}
      </div>

      <div id="plan" className="scroll-mt-4">
        <TripTabs token={trip.token} current={tab} />
        <div className="mt-6">
          {tab === "overview" && <OverviewTab view={view} form={trip.form} />}
          {tab === "daily" && <DailyTab view={view} token={trip.token} canChange={owned} priceSlot={pricePanel} />}
          {tab === "budget" && <BudgetTab view={view} token={trip.token} canChange={owned} />}
          {tab === "map" && <MapTab view={view} />}
        </div>
      </div>

      {!full && <div className="mt-10 max-w-[720px]">{pricePanel}</div>}

      {/* Space for future affiliate offers (flights, stays, activities, insurance): clearly labelled, verified discounts only, never used to rank activities. */}
      <section role="note" aria-labelledby="price-warning" className="mt-12 max-w-[720px] border-l-4 border-ochre-600 bg-ochre-100 rounded-sm p-4">
        <h2 id="price-warning" className="t-heading-3 m-0">{PRICE_WARNING.title}</h2>
        <p className="t-body-sm mt-2 mb-0">{PRICE_WARNING.text}</p>
      </section>

      <aside aria-label="About this plan" className="mt-8 max-w-measure border-t border-paper-200 pt-6">
        <h2 className="t-heading-3 m-0">About this plan</h2>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">Planned by the Travel Notes Trip Planner using AI, with prices looked up on the web and every total worked out by our own calculator. Estimates can change before you book, and nothing has been reserved. Check opening days, prices and entry rules with the official source before you travel.</p>
      </aside>
    </PageShell>
  );
}
