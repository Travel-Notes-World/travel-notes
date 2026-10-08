"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { acceptAnswerAction, bookmarkAction, followAction, removeReplyAction, replyAction, reportAction, resolvedAction, voteAction } from "@/lib/community/actions/engagement";
import { REPORT_CATEGORIES, LIMITS } from "@/lib/community/constants";
import { initialState } from "@/lib/community/next/state";
import { FormMessage, SubmitButton } from "./client";
import { describedBy, Field, inputClass } from "./ui";

/** A small inline confirmation next to a button, announced to screen readers. */
function InlineStatus({ state }: { state: { ok?: boolean; message?: string } }) {
  return <span role="status" aria-live="polite" className={`t-body-sm ${state.ok === false ? "text-signal-error" : "text-ink-600"}`}>{state.message ?? ""}</span>;
}

const smallButton = "inline-flex items-center gap-1 min-h-11 px-3 rounded-md border border-line-500 bg-paper-000 t-ui text-ink-900 hover:border-ink-900 aria-pressed:bg-marine-100 aria-pressed:border-marine-600 disabled:opacity-60";

export function BookmarkButton({ targetType, targetId, on, returnTo }: { targetType: "contribution" | "article"; targetId: string; on: boolean; returnTo: string }) {
  const [state, action] = useActionState(bookmarkAction, initialState);
  const current = typeof state.data?.on === "boolean" ? (state.data.on as boolean) : on;
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="on" value={current ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className={smallButton} pendingText="Saving…"><span aria-hidden="true">{current ? "★" : "☆"}</span>{current ? "Saved" : "Save"}<span className="sr-only">{current ? " (remove from bookmarks)" : " to bookmarks"}</span></SubmitButton>
      <InlineStatus state={state} />
    </form>
  );
}

export function HelpfulButton({ targetType, targetId, on, count, returnTo, own }: { targetType: "reply" | "contribution"; targetId: string; on: boolean; count: number; returnTo: string; own?: boolean }) {
  const [state, action] = useActionState(voteAction, initialState);
  const current = typeof state.data?.on === "boolean" ? (state.data.on as boolean) : on;
  const shown = typeof state.data?.count === "number" ? (state.data.count as number) : count;
  if (own) return <span className="t-body-sm text-ink-600">{shown === 1 ? "1 person found this helpful" : `${shown} people found this helpful`}</span>;
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="on" value={current ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className={smallButton} pendingText="Saving…">
        <span aria-hidden="true">{current ? "▲" : "△"}</span> Helpful <span className="text-ink-600">({shown})</span>
        <span className="sr-only">{current ? ", you marked this as helpful. Press to undo." : ""}</span>
      </SubmitButton>
      <InlineStatus state={state} />
    </form>
  );
}

export function FollowButton({ destinationId, name, on, returnTo }: { destinationId: string; name: string; on: boolean; returnTo: string }) {
  const [state, action] = useActionState(followAction, initialState);
  const current = typeof state.data?.on === "boolean" ? (state.data.on as boolean) : on;
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="destinationId" value={destinationId} />
      <input type="hidden" name="on" value={current ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className={smallButton} pendingText="Saving…">{current ? `Following ${name}` : `Follow ${name}`}<span className="sr-only">{current ? " (press to stop following)" : ""}</span></SubmitButton>
      <InlineStatus state={state} />
    </form>
  );
}

/** Report something to the moderators. Opens in place; works without JavaScript. */
export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "contribution" | "reply" | "member" | "media"; targetId: string; label?: string }) {
  const [state, action] = useActionState(reportAction, initialState);
  const id = useId();
  if (state.ok) return <p role="status" className="t-body-sm text-ink-600 m-0">{state.message}</p>;
  return (
    <details className="group">
      <summary className="t-body-sm text-ink-600 underline underline-offset-4 cursor-pointer min-h-11 inline-flex items-center">{label}</summary>
      <form action={action} className="mt-2 p-4 border border-line-500 rounded-md bg-paper-000 max-w-[480px]">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <FormMessage state={state} />
        <fieldset className="border-0 p-0 m-0">
          <legend className="t-ui">What is the problem?</legend>
          <div className="mt-2 grid gap-1">
            {REPORT_CATEGORIES.map((c, i) => (
              <label key={c.value} className="flex items-center gap-2 t-body-sm min-h-9">
                <input type="radio" name="category" value={c.value} required defaultChecked={state.values?.category === c.value || (!state.values && i === 0 && false)} className="w-4 h-4" /> {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id={`${id}-details`} label="Details" optional hint="Needed for privacy, copyright and “something else”. Please do not include anyone’s private information." error={state.fields?.details}>
          <textarea {...describedBy(`${id}-details`, true, state.fields?.details)} name="details" rows={3} maxLength={1500} defaultValue={(state.values?.details as string) ?? ""} className={inputClass} />
        </Field>
        <p className="t-body-sm text-ink-600 mt-3 mb-0">Moderators review reports. Reporting does not remove anything automatically.</p>
        <div className="mt-3"><SubmitButton pendingText="Sending…" variant="secondary">Send report</SubmitButton></div>
      </form>
    </details>
  );
}

export function ReplyForm({ contributionId, parentId, returnTo, label, buttonText }: { contributionId: string; parentId?: string; returnTo: string; label: string; buttonText: string }) {
  const [state, action] = useActionState(replyAction, initialState);
  const id = useId();
  const field = `${id}-body`;
  return (
    <form action={action} className="mt-4 max-w-measure">
      <input type="hidden" name="contributionId" value={contributionId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormMessage state={state} successTitle="Thank you" />
      {!state.ok && (
        <>
          <Field id={field} label={label} hint="Share what you know first-hand, and say when you were there. Plain text; web addresses become links." error={state.fields?.body}>
            <textarea {...describedBy(field, true, state.fields?.body)} name="body" rows={parentId ? 3 : 6} maxLength={LIMITS.replyMax} required defaultValue={(state.values?.body as string) ?? ""} className={inputClass} />
          </Field>
          <div className="mt-3"><SubmitButton pendingText="Sending…">{buttonText}</SubmitButton></div>
        </>
      )}
    </form>
  );
}

export function AcceptButton({ contributionId, replyId, accepted, returnTo }: { contributionId: string; replyId: string; accepted: boolean; returnTo: string }) {
  const [state, action] = useActionState(acceptAnswerAction, initialState);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="contributionId" value={contributionId} />
      <input type="hidden" name="replyId" value={accepted ? "" : replyId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className={smallButton} pendingText="Saving…">{accepted ? "Undo: not the answer that helped" : "This answer helped me"}</SubmitButton>
      <InlineStatus state={state} />
    </form>
  );
}

export function ResolvedToggle({ contributionId, resolved, returnTo }: { contributionId: string; resolved: boolean; returnTo: string }) {
  const [state, action] = useActionState(resolvedAction, initialState);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="contributionId" value={contributionId} />
      <input type="hidden" name="resolved" value={resolved ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton className={smallButton} pendingText="Saving…">{resolved ? "Mark as open again" : "Mark my question as resolved"}</SubmitButton>
      <InlineStatus state={state} />
    </form>
  );
}

export function RemoveReplyButton({ replyId, returnTo }: { replyId: string; returnTo: string }) {
  const [state, action] = useActionState(removeReplyAction, initialState);
  if (state.ok) return <p role="status" className="t-body-sm m-0">{state.message}</p>;
  return (
    <details>
      <summary className="t-body-sm text-ink-600 underline underline-offset-4 cursor-pointer min-h-11 inline-flex items-center">Remove my reply</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-3">
        <input type="hidden" name="replyId" value={replyId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <p className="t-body-sm m-0">This takes your reply off the page. It cannot be undone.</p>
        <SubmitButton variant="secondary" pendingText="Removing…">Yes, remove it</SubmitButton>
        <InlineStatus state={state} />
      </form>
    </details>
  );
}

export function SignInTo({ action, returnTo }: { action: string; returnTo: string }) {
  return (
    <p className="t-body-sm m-0">
      <Link href={`/account/sign-in?next=${encodeURIComponent(returnTo)}`} className="text-marine-600">Sign in</Link> or <Link href="/account/sign-up" className="text-marine-600">create an account</Link> to {action}.
    </p>
  );
}
