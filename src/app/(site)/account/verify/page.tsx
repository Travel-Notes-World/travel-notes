import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResendVerificationForm } from "@/components/community/auth-forms";
import { Notice, PageHeader, PageShell, buttonClass } from "@/components/community/ui";
import { isCommunityError } from "@/lib/community/errors";
import { verifyEmail } from "@/lib/community/members";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Opening the link does not confirm by itself: the member presses a button. Mail scanners that
 * open every link can therefore not confirm an account on someone's behalf.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token = "" } = await searchParams;
  async function confirm(form: FormData) {
    "use server";
    const value = String(form.get("token") ?? "");
    try {
      await verifyEmail(value);
    } catch (error) {
      if (isCommunityError(error)) redirect(`/account/verify?failed=1`);
      throw error;
    }
    redirect("/account/sign-in?verified=1");
  }
  const failed = !token;
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community account" title="Confirm your email address" />
      {failed ? (
        <>
          <Notice tone="error" title="This link did not work">It may have been used already or copied incompletely. If you already confirmed, you can <Link href="/account/sign-in" className="text-marine-600">sign in</Link>.</Notice>
          <ResendVerificationForm />
        </>
      ) : (
        <form action={confirm}>
          <input type="hidden" name="token" value={token} />
          <p className="t-body max-w-measure">Press the button to confirm this email address and finish creating your account.</p>
          <button type="submit" className={buttonClass}>Confirm my email address</button>
        </form>
      )}
    </PageShell>
  );
}
