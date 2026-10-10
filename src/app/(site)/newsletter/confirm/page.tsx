import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterConfirmForm } from "@/components/NewsletterForm";
import { findPendingByToken } from "@/lib/newsletter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm your subscription", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * In a real browser the page confirms by itself (a small script presses the button once the page is
 * shown); the button stays as a fallback. A plain fetch of the link, which is what email security
 * scanners usually do, runs no script and confirms nothing.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = (await searchParams).token;
  const pending = typeof token === "string" ? await findPendingByToken(token) : null;
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-16">
      <h1 className="t-heading-1 m-0">Confirm your subscription</h1>
      {pending && typeof token === "string" ? (
        <>
          <p className="t-deck mt-3 max-w-measure">Confirming the weekly Travel Notes email for <strong>{pending.email}</strong>… If nothing happens in a few seconds, press the button.</p>
          <div className="mt-6"><NewsletterConfirmForm token={token} /></div>
        </>
      ) : (
        <p className="t-deck mt-3 max-w-measure">
          This link has expired or was already used. If you are not subscribed yet, <Link href="/newsletter" className="text-marine-600 underline">sign up again</Link>.
        </p>
      )}
    </div>
  );
}
