"use client";

import Link from "next/link";
import { useActionState } from "react";

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
        We will email you to confirm. One email a week; unsubscribe with one click at any time. See our <Link href="/privacy" className="text-marine-600">privacy notice</Link>.
      </p>
      <div className="mt-5"><SubmitButton pendingText="Sending…">Subscribe</SubmitButton></div>
    </form>
  );
}

export function NewsletterConfirmForm({ token }: { token: string }) {
  const [state, action] = useActionState(confirmAction, initialState);
  if (state.message) {
    return (
      <div>
        <FormMessage state={state} successTitle="Done" />
        {!state.ok && <p className="t-body-sm mt-4"><Link href="/newsletter" className="text-marine-600">Sign up again</Link></p>}
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingText="Confirming…">Confirm my subscription</SubmitButton>
    </form>
  );
}
