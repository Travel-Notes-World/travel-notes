import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PrintButton } from "@/components/community/print-button";
import { PageShell } from "@/components/community/ui";
import { isCommunityError } from "@/lib/community/errors";
import { formatAud, getInvoice, type InvoiceView } from "@/lib/community/listings";
import { getViewer } from "@/lib/community/next/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" }) : "";
const abn = (value: string) => value.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");

/**
 * A tax invoice (or a receipt when the seller is not registered for GST) for a paid listing or AI trip plan.
 * Every detail comes from the payment record as it was when paid, never from today's settings.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.member && !viewer.staff) redirect(`/account/sign-in?next=${encodeURIComponent(`/account/invoices/${id}`)}`);
  let invoice: InvoiceView;
  try {
    invoice = await getInvoice({ member: viewer.member, staff: viewer.staff }, id);
  } catch (error) {
    if (isCommunityError(error) && error.code === "not_found") notFound();
    throw error;
  }
  const taxInvoice = (invoice.gstMinor ?? 0) > 0;

  return (
    <PageShell narrow>
      <article className="max-w-measure rounded-lg border border-paper-200 bg-paper-000 p-6 md:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="t-heading-2 m-0">{taxInvoice ? "Tax invoice" : "Receipt"}</h1>
            <p className="t-body-sm text-ink-600 m-0 mt-1">Number {invoice.invoiceNumber}</p>
          </div>
          <div className="t-body-sm text-right">
            <p className="m-0 t-ui">{invoice.sellerName}</p>
            <p className="m-0">ABN {abn(invoice.sellerAbn)}</p>
            <p className="m-0">Travel Notes, travelnotesworld.com</p>
          </div>
        </header>

        <dl className="t-body-sm mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-ink-600">Date</dt>
          <dd className="m-0">{date(invoice.paidAt)}</dd>
          {invoice.buyerEmail && (
            <>
              <dt className="text-ink-600">Billed to</dt>
              <dd className="m-0">{invoice.buyerEmail}</dd>
            </>
          )}
        </dl>

        <table className="w-full mt-6 t-body-sm">
          <thead>
            <tr className="border-b border-paper-200">
              <th scope="col" className="text-left py-2">Description</th>
              <th scope="col" className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-paper-200">
              <td className="py-2 pr-4">{invoice.description}</td>
              <td className="py-2 text-right whitespace-nowrap">{formatAud(invoice.amountMinor)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="text-left py-2">Total paid (AUD)</th>
              <td className="py-2 text-right t-ui">{formatAud(invoice.amountMinor)}</td>
            </tr>
            {taxInvoice && (
              <tr>
                <th scope="row" className="text-left py-1 font-normal text-ink-600">The total includes GST of</th>
                <td className="py-1 text-right text-ink-600">{formatAud(invoice.gstMinor ?? 0)}</td>
              </tr>
            )}
          </tfoot>
        </table>

        {invoice.status === "refunded" && (
          <p className="t-body-sm mt-4 mb-0 border-l-4 border-signal-success pl-3">
            Refunded in full on {date(invoice.refundedAt)}.
          </p>
        )}
        <p className="t-body-sm text-ink-600 mt-6 mb-0">Paid by card through Stripe.</p>
      </article>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        {viewer.member && invoice.contributionId && <Link href={`/account/posts/${invoice.contributionId}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Back to your listing</Link>}
        {viewer.member && invoice.planId && <Link href={`/account/trips/${invoice.planId}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Back to your plan</Link>}
      </div>
    </PageShell>
  );
}
