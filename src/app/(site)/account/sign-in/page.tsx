import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/community/auth-forms";
import { Notice, PageHeader, PageShell } from "@/components/community/ui";
import { getViewer, safeReturnPath } from "@/lib/community/next/session";
import { getSettings } from "@/lib/community/settings";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeReturnPath(params.next);
  const { member } = await getViewer();
  if (member) redirect(next);
  const settings = await getSettings();
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community account" title="Sign in" />
      {params.verified && <div className="mb-6"><Notice tone="success" title="Email confirmed">Your account is ready. Sign in to start.</Notice></div>}
      {params.reset && <div className="mb-6"><Notice tone="success" title="Password changed">Sign in with your new password.</Notice></div>}
      <SignInForm next={next} />
      <p className="t-body-sm mt-8">
        New here? {settings.signupsOpen ? <Link href="/account/sign-up" className="text-marine-600">Create an account</Link> : "Sign-up opens soon."}
      </p>
      <p className="t-body-sm text-ink-600">Travel Notes staff sign in to the <Link href="/admin" className="text-marine-600">CMS</Link> instead.</p>
    </PageShell>
  );
}
