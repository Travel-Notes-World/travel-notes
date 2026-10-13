import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buttonClass, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { DocumentPreview } from "@/components/planner/document-preview";
import { isCommunityError } from "@/lib/community/errors";
import { requireMemberPage } from "@/lib/community/next/session";
import { planDocument } from "@/lib/planner/document-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan document", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Check the document before downloading it. Corrections are made on the plan page, then checked here again. */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMemberPage(`/account/trips/${encodeURIComponent(id)}/document`);
  let doc: Awaited<ReturnType<typeof planDocument>>;
  try {
    doc = await planDocument(member, id);
  } catch (error) {
    if (isCommunityError(error) && error.code === "not_found") notFound();
    if (isCommunityError(error) && error.code === "forbidden") redirect(`/account/trips/${id}`);
    throw error;
  }
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Your account", href: "/account" }, { label: "Trip plans", href: "/account/trips" }, { label: "Plan", href: `/account/trips/${id}` }, { label: "Document" }]} />
      <PageHeader eyebrow="Check before you download" title={doc.layout === "visa" ? "Your proposed itinerary" : "Your trip plan document"} intro="This is what your PDF will contain. If anything is wrong or missing, correct it on the plan page, then come back here." />
      {doc.layout === "visa" && (
        <div className="mb-6 max-w-measure">
          <Notice tone="warning" title="Before you use this for a visa application">
            Check that every date and city is right and that only real bookings are marked “Confirmed”. This is a planning document: it does not guarantee a visa, and each authority sets its own requirements. Check them on the authority’s official website.
          </Notice>
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-3">
        <a href={`/account/trips/${id}/pdf`} className={buttonClass} download>Download PDF (A4)</a>
        <Link href={`/account/trips/${id}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Correct the plan</Link>
      </div>
      <DocumentPreview doc={doc} />
    </PageShell>
  );
}
