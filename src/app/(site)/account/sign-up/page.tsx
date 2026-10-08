import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/community/auth-forms";
import { Notice, PageHeader, PageShell } from "@/components/community/ui";
import { emailMode } from "@/lib/community/email/transport";
import { getViewer } from "@/lib/community/next/session";
import { getSettings } from "@/lib/community/settings";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: false } };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { member } = await getViewer();
  if (member) redirect("/account");
  const settings = await getSettings();
  const mode = emailMode();
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community account" title="Create an account" intro="Ask questions, share trip reports and activities, and save trip plans. Anyone can read approved posts without an account." />
      {params.sent ? (
        <Notice tone="success" title="Check your email">
          <p>If this email address is new to Travel Notes, we have sent a link to confirm it. Open it to finish creating your account. The link is in an email from Travel Notes; check your spam folder if you cannot see it.</p>
          {mode === "capture" && <p><strong>Test mode:</strong> this site is not sending real email. A moderator can find the link in the test inbox.</p>}
        </Notice>
      ) : !settings.signupsOpen ? (
        <Notice tone="info" title="Sign-up is not open yet">The community opens soon. You can already read the travel guides.</Notice>
      ) : mode === "off" ? (
        <Notice tone="warning" title="Sign-up is not available yet">New accounts need a confirmation email, and this site cannot send email yet.</Notice>
      ) : (
        <>
          {mode === "capture" && <div className="mb-6"><Notice tone="warning" title="Test mode">This site is not sending real email. Confirmation links are kept in the moderators’ test inbox.</Notice></div>}
          <SignUpForm />
        </>
      )}
      <p className="t-body-sm mt-8">Already have an account? <Link href="/account/sign-in" className="text-marine-600">Sign in</Link></p>
    </PageShell>
  );
}
