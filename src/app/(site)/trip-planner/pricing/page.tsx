import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd, Notice, PageShell, buttonClass } from "@/components/community/ui";
import { PlanTiers } from "@/components/planner/ai-panel";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { getSettings } from "@/lib/community/settings";
import { aiConfigured } from "@/lib/planner/ai";
import { aiPlanPrice } from "@/lib/planner/payments";

export const dynamic = "force-dynamic";

const TITLE = "Trip Planner pricing";
const DESCRIPTION = "What the free Trip Planner and the free brief AI plan include, and what a one-off detailed plan adds: revisions, sharing and a PDF.";
export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/trip-planner/pricing" }, openGraph: { title: TITLE, description: DESCRIPTION, url: "/trip-planner/pricing" } };

const crumbs = [{ label: "Home", href: "/" }, { label: "Trip Planner", href: "/trip-planner" }, { label: "Pricing" }];

export default async function PricingPage() {
  const settings = await getSettings();
  const price = aiPlanPrice(settings);
  const priceText = price.text;
  const open = settings.planner.aiEnabled && aiConfigured();
  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-2 mb-8 max-w-measure">
        <p className="t-meta text-ochre-700 m-0">Trip Planner</p>
        <h1 className="t-heading-1 mt-2 m-0">Simple, one-off pricing</h1>
        <p className="t-deck mt-3 mb-0">The Trip Planner itself is free. Your first AI plan is free too. Pay only when you want the detailed version of a plan: once per plan, no subscription.</p>
      </header>
      {!open && <div className="mb-6 max-w-measure"><Notice tone="info" title="AI plans open soon">The free Trip Planner works now. AI plans are not switched on yet.</Notice></div>}
      <div className="max-w-[860px]"><PlanTiers priceText={priceText} revisions={settings.planner.revisions} /></div>

      <section aria-labelledby="included-heading" className="mt-10 max-w-measure">
        <h2 id="included-heading" className="t-heading-2 m-0">Good to know before you pay</h2>
        <ul className="t-body mt-3 mb-0 pl-6 grid gap-2">
          <li>The price is {priceText} per plan, including GST. You see it again on Stripe’s secure page before you pay. Travel Notes never sees your card details.</li>
          <li>One payment upgrades one plan: the detailed AI plan, {settings.planner.revisions} revisions, a private share link and the PDF and print version. Your plan stays in your account until you delete it.</li>
          <li>Paid access starts only after Stripe confirms the payment. If you press pay twice, only one payment goes through for each checkout.</li>
          <li>If the AI cannot finish your plan, nothing is used up. Try again.</li>
          <li>The AI never gives prices, opening hours or entry rules, and it never makes bookings. Suggestions it adds on its own are marked “AI idea”.</li>
          <li>A visa itinerary is a planning document. It does not guarantee a visa, and it is not offered for Australian visa applications.</li>
          <li>Refunds follow our <Link href="/terms#ai-plans" className="text-marine-600 underline">terms</Link> and the Australian Consumer Law. A tax invoice is in your account straight after you pay.</li>
        </ul>
      </section>
      <p className="mt-8"><Link href="/trip-planner" className={buttonClass}>Start planning</Link></p>
      {!price.charge && open && <p className="t-body-sm text-ink-600 mt-4">Payments are not switched on yet, so paid plans cannot be bought at the moment.</p>}
    </PageShell>
  );
}
