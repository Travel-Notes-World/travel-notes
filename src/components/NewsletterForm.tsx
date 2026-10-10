"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { FormMessage, SubmitButton } from "@/components/community/client";
import { describedBy, Field, inputClass } from "@/components/community/ui";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";
import { confirmAction, subscribeAction } from "@/lib/newsletter-actions";

const val = (state: ActionState, key: string) => (!state.ok && typeof state.values?.[key] === "string" ? (state.values[key] as string) : "");

export function NewsletterForm({ source }: { source: string }) {
  const [state, action] = useActionState(subscribeAction, initialState);
  const f = state.fields ?? {};
  if (state.ok) return <FormMessage state={state} successTitle="Check your inbox" />;
  return (
    <form action={action} noValidate className="max-w-[520px]">
      <FormMessage state={state} />
      <input type="hidden" name="source" value={source} />
      <Field id="newsletter-email" label="Your email address" error={f.email} required>
        <input {...describedBy("newsletter-email", null, f.email)} name="email" type="email" maxLength={254} required autoComplete="email" inputMode="email" defaultValue={val(state, "email")} className={inputClass} />
      </Field>
      {/* A field people never see or fill in. Scripts that fill every field give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label htmlFor="newsletter-website">Leave this empty</label>
        <input id="newsletter-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="t-body-sm text-ink-600 mt-4 mb-0">
        We will email you to confirm. One email a week; unsubscribe with one click at any time. See our <Link href="/privacy" className="text-marine-600 underline">privacy notice</Link>.
      </p>
      <div className="mt-5"><SubmitButton pendingText="Sending…">Subscribe</SubmitButton></div>
    </form>
  );
}

/**
 * Confirms by itself once the page is shown in a real browser, so a person only clicks the link in
 * the email (owner's decision, 10 Oct 2026). Email security scanners usually fetch the page without
 * running scripts, so their visit confirms nothing. The button is the fallback if the script does
 * not run.
 */
export function NewsletterConfirmForm({ token }: { token: string }) {
  const [state, action] = useActionState(confirmAction, initialState);
  const form = useRef<HTMLFormElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    // Once only: a second call would find the token already used and report "expired".
    const submit = () => {
      if (sent.current || document.visibilityState !== "visible") return;
      sent.current = true;
      form.current?.requestSubmit();
    };
    // A short pause, and only while the tab is shown, keeps background pre-loading out.
    const timer = window.setTimeout(submit, 400);
    document.addEventListener("visibilitychange", submit);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", submit);
    };
  }, []);

  if (state.message) {
    return (
      <div>
        <FormMessage state={state} successTitle="Done" />
        {!state.ok && <p className="t-body-sm mt-4"><Link href="/newsletter" className="text-marine-600 underline">Sign up again</Link></p>}
      </div>
    );
  }
  return (
    <form ref={form} action={action} onSubmit={() => { sent.current = true; }}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingText="Confirming…">Confirm my subscription</SubmitButton>
    </form>
  );
}
