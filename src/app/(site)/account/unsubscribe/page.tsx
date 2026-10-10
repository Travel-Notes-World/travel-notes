import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Notice, PageHeader, PageShell } from "@/components/community/ui";
import { confirmUnsubscribeAction } from "@/lib/community/actions/unsubscribe";
import { EMAIL_CATEGORIES, type EmailCategory } from "@/lib/community/constants";

export const dynamic = "force-dynamic";
// The address carries a signed token, so it is never indexed and never sent on as a referrer.
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false }, referrer: "no-referrer" };

const CATEGORY_TEXT: Record<EmailCategory, string> = {
  replies: "emails about replies to your posts",
  moderation: "emails about moderation decisions",
  events: "emails about changes to activities you responded to",
  digest: "the destination digest email",
};

const isCategory = (value: unknown): value is EmailCategory => typeof value === "string" && (EMAIL_CATEGORIES as readonly string[]).includes(value);
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Unsubscribe from one kind of email, without signing in. Opening the link only shows a button:
 * nothing changes until the person presses it, because mail systems often open links to scan them.
 * The signature is checked by the service when the button is pressed.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const done = one(params.done);
  const m = one(params.m);
  const c = one(params.c);
  const s = one(params.s);

  let body: ReactNode;
  if (isCategory(done)) {
    body = (
      <Notice tone="success" title="You are unsubscribed">
        <p>We will not send you {CATEGORY_TEXT[done]} any more. You still see notifications on the site.</p>
        <p>Changed your mind? Switch it back on in your <Link href="/account/settings#email" className="text-marine-600 underline">email settings</Link> (sign-in needed).</p>
      </Notice>
    );
  } else if (params.invalid || params.failed) {
    body = (
      <Notice tone="error" title={params.failed ? "That did not work" : "This link is not valid"}>
        <p>{params.failed ? "Something went wrong on our side. Please try the link in your email again in a moment." : "The unsubscribe link may be incomplete. Copy the whole link from the email, or sign in and change your email settings."}</p>
        <p><Link href="/account/settings#email" className="text-marine-600 underline">Go to email settings</Link></p>
      </Notice>
    );
  } else if (m && s && isCategory(c)) {
    body = (
      <form action={confirmUnsubscribeAction} className="max-w-measure">
        <input type="hidden" name="m" value={m} />
        <input type="hidden" name="c" value={c} />
        <input type="hidden" name="s" value={s} />
        <p className="t-body mt-0">Stop sending me {CATEGORY_TEXT[c]}?</p>
        <p className="t-body-sm text-ink-600">Emails to confirm your address or reset your password are always sent. Other email settings do not change.</p>
        <button type="submit" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md bg-marine-600 text-on-marine t-ui hover:bg-marine-700">Unsubscribe</button>
      </form>
    );
  } else {
    body = (
      <Notice tone="info" title="Use the link in your email">
        <p>Emails you can switch off have an unsubscribe link at the bottom. You can also sign in and choose which emails you get in your <Link href="/account/settings#email" className="text-marine-600 underline">email settings</Link>.</p>
      </Notice>
    );
  }

  return (
    <PageShell narrow>
      <PageHeader eyebrow="Email settings" title="Unsubscribe" />
      {body}
    </PageShell>
  );
}
