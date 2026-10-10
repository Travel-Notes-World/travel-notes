import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/community/auth-forms";
import { Notice, PageHeader, PageShell } from "@/components/community/ui";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token = "" } = await searchParams;
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community account" title="Choose a new password" />
      {token ? <ResetPasswordForm token={token} /> : <Notice tone="error" title="This link is incomplete">Ask for a <Link href="/account/forgot-password" className="text-marine-600 underline">new reset link</Link>.</Notice>}
    </PageShell>
  );
}
