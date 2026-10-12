import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingSteps } from "@/components/community/listing-steps";
import { Notice, PageHeader, PageShell, buttonClass, secondaryButtonClass } from "@/components/community/ui";
import { getOwn } from "@/lib/community/contributions";
import { isCommunityError } from "@/lib/community/errors";
import { confirmListingPayment, listingPaymentsFor } from "@/lib/community/listings";
import { requireMemberPage } from "@/lib/community/next/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment received", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Stripe sends the member back here after paying. The payment is checked with Stripe directly
 * (not trusted from the address), recorded, and the listing is sent for review. Stripe's webhook
 * does the same, so it does not matter which arrives first.
 */
export default async function PaymentDonePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const member = await requireMemberPage(`/account/posts/${encodeURIComponent(id)}`);
  try {
    await getOwn(member, id);
  } catch (error) {
    if (isCommunityError(error) && error.code === "not_found") notFound();
    throw error;
  }

  let status: "paid" | "unpaid" | "unknown" = "unknown";
  if (query.session_id) {
    const result = await confirmListingPayment(query.session_id).catch(() => ({ status: "unknown" as const, contributionId: undefined }));
    status = result.contributionId && result.contributionId !== id ? "unknown" : result.status;
  }
  const payments = await listingPaymentsFor(id);
  const paid = payments.find((p) => p.status === "paid");
  if (paid) status = "paid";

  return (
    <PageShell narrow>
      <Breadcrumbs items={[{ label: "Your account", href: "/account" }, { label: "Activity", href: `/account/posts/${id}` }, { label: "Payment" }]} />
      {status === "paid" ? (
        <>
          <PageHeader eyebrow="Business listing" title="Payment received. Thank you!" />
          <ListingSteps current={5} compact />
          <Notice tone="success" title="Your listing is waiting for review">
            A moderator will check it. You will get a notification and an email when it is published. If it is not approved, your fee is refunded in full automatically.
          </Notice>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/account/posts/${id}`} className={buttonClass}>See your listing’s status</Link>
            {paid && <Link href={`/account/invoices/${paid.id}`} className={secondaryButtonClass}>View your invoice</Link>}
          </div>
        </>
      ) : (
        <>
          <PageHeader eyebrow="Business listing" title="We are still waiting for the payment" />
          <Notice tone="info" title="Nothing to do yet">
            Stripe has not confirmed your payment yet. This can take a minute. Refresh this page shortly. If you closed the payment page, no money was taken and you can <Link href={`/account/posts/${id}/pay`} className="text-marine-600 underline">try again</Link>.
          </Notice>
        </>
      )}
    </PageShell>
  );
}
