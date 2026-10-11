"use client";

import Link from "next/link";
import { useActionState } from "react";

import { forgotPasswordAction, resendVerificationAction, resetPasswordAction, signInAction, signUpAction } from "@/lib/community/actions/account";
import { initialState } from "@/lib/community/next/state";
import { FormMessage, SubmitButton } from "./client";
import { describedBy, Field, inputClass } from "./ui";

const v = (state: { values?: Record<string, unknown> }, key: string, fallback = "") => (typeof state.values?.[key] === "string" ? (state.values[key] as string) : fallback);

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, initialState);
  const f = state.fields ?? {};
  return (
    <>
      <form action={action} noValidate className="max-w-[460px]">
        <FormMessage state={state} />
        <input type="hidden" name="next" value={next} />
        <Field id="email" label="Email address" error={f.email}>
          <input {...describedBy("email", null, f.email)} name="email" type="email" autoComplete="email" required defaultValue={v(state, "email")} className={inputClass} />
        </Field>
        <Field id="password" label="Password" error={f.password}>
          <input {...describedBy("password", null, f.password)} name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          <Link href="/account/forgot-password" className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Forgot your password?</Link>
        </div>
      </form>
      {state.data?.unverified ? <ResendVerificationForm email={v(state, "email")} /> : null}
    </>
  );
}

export function ResendVerificationForm({ email = "" }: { email?: string }) {
  const [state, action] = useActionState(resendVerificationAction, initialState);
  return (
    <form action={action} className="mt-8 max-w-[460px] border-t border-paper-200 pt-6">
      <h2 className="t-heading-3 m-0">Send the confirmation link again</h2>
      <FormMessage state={state} successTitle="Sent" />
      <Field id="resend-email" label="Email address">
        <input id="resend-email" name="email" type="email" autoComplete="email" defaultValue={email} required className={inputClass} />
      </Field>
      <div className="mt-4"><SubmitButton pendingText="Sending…" variant="secondary">Send the link again</SubmitButton></div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[520px]">
      <FormMessage state={state} />
      <Field id="displayName" label="Name to show on your posts" hint="Your own name or a nickname. You can change it later." error={f.displayName} required>
        <input {...describedBy("displayName", true, f.displayName)} name="displayName" autoComplete="nickname" maxLength={60} required defaultValue={v(state, "displayName")} className={inputClass} />
      </Field>
      <Field id="handle" label="Profile address" hint="3 to 30 lowercase letters, numbers or hyphens. It appears in your profile address: travenotes.com/travellers/your-name. It cannot be changed later." error={f.handle} required>
        <input {...describedBy("handle", true, f.handle)} name="handle" autoComplete="username" maxLength={30} required pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]" defaultValue={v(state, "handle")} className={inputClass} />
      </Field>
      <Field id="email" label="Email address" hint="We send a link to confirm it. It is never shown to other members." error={f.email} required>
        <input {...describedBy("email", true, f.email)} name="email" type="email" autoComplete="email" required defaultValue={v(state, "email")} className={inputClass} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters. A short phrase of a few words works well." error={f.password} required>
        <input {...describedBy("password", true, f.password)} name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </Field>
      {/* A field people never see or fill in. Scripts that fill every field give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="mt-6">
        <div className="flex items-start gap-3">
          <input id="acceptTerms" name="acceptTerms" type="checkbox" required aria-invalid={f.acceptTerms ? true : undefined} aria-describedby={f.acceptTerms ? "acceptTerms-error" : undefined} className="mt-1 w-5 h-5" />
          <label htmlFor="acceptTerms" className="t-body-sm">I accept the <Link href="/community/guidelines" className="text-marine-600 underline" target="_blank">community rules</Link> and the <Link href="/terms" className="text-marine-600 underline" target="_blank">terms</Link>, and I have read the <Link href="/privacy" className="text-marine-600 underline" target="_blank">privacy notice</Link>.</label>
        </div>
        {f.acceptTerms && <p id="acceptTerms-error" className="t-body-sm text-signal-error mt-1 font-medium">⚠ {f.acceptTerms}</p>}
      </div>
      <div className="mt-6"><SubmitButton pendingText="Creating your account…">Create account</SubmitButton></div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[460px]">
      <FormMessage state={state} successTitle="Check your email" />
      <Field id="email" label="Email address" error={f.email}>
        <input {...describedBy("email", null, f.email)} name="email" type="email" autoComplete="email" required defaultValue={v(state, "email")} className={inputClass} />
      </Field>
      <div className="mt-6"><SubmitButton pendingText="Sending…">Send a reset link</SubmitButton></div>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[460px]">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field id="password" label="New password" hint="At least 10 characters." error={f.password}>
        <input {...describedBy("password", true, f.password)} name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </Field>
      <div className="mt-6"><SubmitButton pendingText="Saving…">Save the new password</SubmitButton></div>
    </form>
  );
}
