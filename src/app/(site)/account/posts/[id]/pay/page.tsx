import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingSteps } from "@/components/community/listing-steps";
import { PayListingForm } from "@/components/community/listing-forms";
import { Notice, PageHeader, PageShell, secondaryButtonClass } from "@/components/community/ui";
import { getOwn, type OwnEditable } from "@/lib/community/contributions";
import { isCommunityError } from "@/lib/community/errors";
import { currentListingFee, formatAud, listingPaymentsFor, needsListingFee } from "@/lib/community/listings";
import { requireMemberPage } from "@/lib/community/next/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay for your listing", robots: { index: false, follow: false } };

export default async function PayListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const member = await requireMemberPage(`/account/posts/${encodeURIComponent(id)}/pay`);
  let post: OwnEditable;
  try {
    post = await getOwn(member, id);
  } catch (error) {
    if (isCommunityError(error) && error.code === "not_found") notFound();
    throw error;
  }
  // Only an unpaid business listing that is still a draft belongs here.
  if (post.type !== "activity" || !needsListingFee(post.type, post.content)) redirect(`/account/posts/${post.id}`);
  const payments = await listingPaymentsFor(post.id);
  if (payments.some((p) => p.status === "paid") || !["draft", "changes_requested"].includes(post.state)) redirect(`/account/posts/${post.id}`);

  const fee = await currentListingFee();
  const title = post.content.title || "Your listing";
  const amount = formatAud(fee.amountMinor);

  return (
    <PageShell narrow>
      <Breadcrumbs items={[{ label: "Your account", href: "/account" }, { label: "Activity", href: `/account/posts/${post.id}` }, { label: "Payment" }]} />
      <PageHeader eyebrow="Business listing" title="Pay and send for review" intro={<>Your listing “{title}” is saved. One last step: pay the listing fee, then it goes to a moderator.</>} />
      <ListingSteps current={4} />

      {query.cancelled && <div className="mb-6"><Notice tone="info" title="Payment not finished">No money was taken. Your listing is still saved as a draft. You can pay now or later from your account.</Notice></div>}

      {!fee.charge ? (
        <Notice tone="info" title="Paid listings are not open yet">
          Business listings are free at the moment. <Link href={`/account/posts/${post.id}`} className="text-marine-600 underline">Go back to your listing</Link> and press “Post” to send it for review.
        </Notice>
      ) : (
        <section aria-labelledby="price-heading" className="rounded-lg border border-paper-200 bg-paper-000 p-5 md:p-6 max-w-measure">
          <h2 id="price-heading" className="t-heading-3 m-0">
            {fee.label ? <span className="t-meta text-marine-600 block mb-1">{fee.label}</span> : null}
            {amount} <span className="t-body-sm text-ink-600 font-normal">AUD per listing{fee.gstRegistered ? `, including ${formatAud(fee.gstMinor)} GST` : ""}</span>
          </h2>
          <ul className="t-body-sm mt-4 mb-0 pl-5 list-disc grid gap-1">
            <li>Your activity is checked by a person, then listed on Activities and on the pages of the places you chose.</li>
            <li>Once approved, it can be shown to search engines with full event details.</li>
            <li>You can edit it, or mark it postponed or cancelled, at any time.</li>
            <li><strong>If we do not approve it, the fee is refunded in full</strong>, automatically, to the same card.</li>
            <li>You get a {fee.gstRegistered ? "tax invoice" : "receipt"} in your account straight after paying.</li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PayListingForm id={post.id} amount={amount} />
            <Link href={`/account/posts/${post.id}`} className={secondaryButtonClass}>Back to edit</Link>
          </div>
          <p className="t-body-sm text-ink-600 mt-4 mb-0">
            You pay on Stripe’s secure page. Travel Notes never sees or stores your card details. See our <Link href="/terms#paid-listings" className="text-marine-600 underline">terms for paid listings</Link>.
          </p>
        </section>
      )}
    </PageShell>
  );
}
