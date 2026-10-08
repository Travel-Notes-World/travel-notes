import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PageShell } from "@/components/community/ui";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false, follow: false } };

export default function DeletedPage() {
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community account" title="Your account is deleted" intro="Your sign-in details, profile and private data have been deleted, and you are signed out." />
      <p className="t-body-sm"><Link href="/" className="text-marine-600">Back to Travel Notes</Link></p>
    </PageShell>
  );
}
