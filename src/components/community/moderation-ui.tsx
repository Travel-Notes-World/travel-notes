"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useId, type ReactNode } from "react";

import {
  decideContributionAction,
  decideMediaAction,
  decideReplyAction,
  decideSuggestionAction,
  markDuplicateAction,
  markMemberVerifiedAction,
  moderateEventStatusAction,
  overrideAcceptedAnswerAction,
  recordFactCheckAction,
  resendMemberVerificationAction,
  resolveReportAction,
  restrictAccountAction,
  sendMemberPasswordResetAction,
  setIndexingAction,
  setTrustedAction,
  setVisibilityAction,
} from "@/lib/community/actions/moderation";
import { EVENT_STATUSES, INDEXING_CHOICES } from "@/lib/community/constants";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";
import { DestinationPicker, FormMessage, SubmitButton } from "./client";
import { describedBy, Field, inputClass } from "./ui";

/**
 * Shared pieces of the moderation console. Every form posts to a server action that re-checks
 * the moderator from the session; nothing here decides permissions. Decisions that the author
 * will see require a written reason, and the field says so.
 */

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const dangerButton = "inline-flex items-center justify-center min-h-11 px-4 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100 disabled:opacity-60";
const primaryButton = "inline-flex items-center justify-center min-h-11 px-5 rounded-md bg-marine-600 text-on-marine t-ui hover:bg-marine-700 disabled:opacity-60 disabled:cursor-wait";
const secondaryButton = "inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui hover:border-ink-900 disabled:opacity-60";

const NAV = [
  { href: "/moderation", label: "Dashboard", exact: true },
  { href: "/moderation/queue", label: "Review queue" },
  { href: "/moderation/replies", label: "Replies" },
  { href: "/moderation/reports", label: "Reports" },
  { href: "/moderation/members", label: "Members" },
  { href: "/moderation/suggestions", label: "Destination suggestions" },
  { href: "/moderation/log", label: "Audit log" },
  { href: "/moderation/inbox", label: "Test inbox" },
] as const;

/** Console navigation. The current section is marked for screen readers, not only by colour. */
export function ModerationNav({ counts = {} }: { counts?: Partial<Record<(typeof NAV)[number]["href"], number>> }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Moderation sections" className="mb-8 border-b border-line-500 pb-4">
      <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
        {NAV.map((item) => {
          const active = "exact" in item ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/moderation/queue" && pathname.startsWith("/moderation/posts/"));
          const count = counts[item.href];
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 px-3 rounded-md border t-ui no-underline ${active ? "bg-ink-900 text-paper-000 border-ink-900" : "border-line-500 text-ink-900"}`}>
                {item.label}
                {typeof count === "number" && count > 0 && <span className="t-meta">({count}<span className="sr-only"> waiting</span>)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Warning signs worked out on the server. Each one is a word and an explanation, never a colour alone. */
export function RiskFlags({ flags }: { flags: { label: string; detail: string }[] }) {
  if (!flags.length) return <p className="t-body-sm text-ink-600 m-0">No automatic warning signs. Still read the whole post.</p>;
  return (
    <ul aria-label="Warning signs" className="list-none m-0 p-0 grid gap-2">
      {flags.map((f) => (
        <li key={f.label} className="border-l-4 border-ochre-500 bg-ochre-100 rounded-sm px-3 py-2 t-body-sm">
          <span className="t-ui"><span aria-hidden="true">⚑ </span>{f.label}</span>
          <span className="block text-ink-600">{f.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function ReasonField({ id, state, required, label = "Reason", hint, name = "reason", rows = 3 }: { id: string; state: ActionState; required?: boolean; label?: string; hint?: string; name?: string; rows?: number }) {
  const error = state.fields?.[name];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <textarea {...describedBy(id, hint, error)} name={name} rows={rows} maxLength={1000} defaultValue={(state.values?.[name] as string) ?? ""} className={inputClass} />
    </Field>
  );
}

/** One form wired to one action, with the result message above the fields. */
function ActionForm({ action, hidden, children, className = "", successTitle = "Done" }: { action: Action; hidden: Record<string, string>; children: (state: ActionState, id: string) => ReactNode; className?: string; successTitle?: string }) {
  const [state, formAction] = useActionState(action, initialState);
  const id = useId();
  const returnTo = usePathname() ?? "/moderation";
  return (
    <form action={formAction} className={`max-w-measure ${className}`}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormMessage state={state} successTitle={successTitle} />
      {children(state, id)}
    </form>
  );
}

/** Approve, request changes or reject a submission (or an edit to a published post). */
export function ContributionDecisionForm({ id, isEdit }: { id: string; isEdit: boolean }) {
  return (
    <ActionForm action={decideContributionAction} hidden={{ id }} successTitle="Decision saved">
      {(state, fid) => (
        <>
          <ReasonField
            id={`${fid}-reason`}
            state={state}
            label="Note to the author"
            hint={isEdit ? "Required to reject the edit. The approved version stays public either way. The author sees this note." : "Required to request changes or reject. The author sees this note, so be clear and polite."}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <SubmitButton name="decision" value="approve" className={primaryButton} pendingText="Saving…">{isEdit ? "Approve the edit" : "Approve and publish"}</SubmitButton>
            {!isEdit && <SubmitButton name="decision" value="request_changes" className={secondaryButton} pendingText="Saving…">Request changes</SubmitButton>}
            <SubmitButton name="decision" value="reject" className={dangerButton} pendingText="Saving…">{isEdit ? "Reject the edit" : "Reject"}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Hide, restore or remove a published post. Takes effect on the next page view. */
export function VisibilityForm({ id, state: postState }: { id: string; state: string }) {
  if (!["published", "hidden"].includes(postState)) return <p className="t-body-sm text-ink-600 m-0">Hiding and removal apply to published or hidden posts only.</p>;
  return (
    <ActionForm action={setVisibilityAction} hidden={{ id }}>
      {(state, fid) => (
        <>
          <ReasonField id={`${fid}-reason`} state={state} hint="Required to hide or remove. The author sees it. Hiding can be undone; removal is for content that must not return." />
          <div className="mt-4 flex flex-wrap gap-3">
            {postState === "published" && <SubmitButton name="action" value="hide" className={secondaryButton} pendingText="Saving…">Hide</SubmitButton>}
            {postState === "hidden" && <SubmitButton name="action" value="unhide" className={secondaryButton} pendingText="Saving…">Restore (make public again)</SubmitButton>}
            <SubmitButton name="action" value="remove" className={dangerButton} pendingText="Saving…">Remove</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Decide one reply. The buttons shown depend on the reply's current state. */
export function ReplyDecisionForm({ replyId, state: replyState }: { replyId: string; state: string }) {
  const buttons: { value: string; label: string; danger?: boolean; primary?: boolean }[] =
    replyState === "pending" ? [{ value: "approve", label: "Approve", primary: true }, { value: "reject", label: "Reject", danger: true }]
    : replyState === "published" ? [{ value: "hide", label: "Hide" }, { value: "remove", label: "Remove", danger: true }]
    : replyState === "hidden" ? [{ value: "unhide", label: "Restore" }, { value: "remove", label: "Remove", danger: true }]
    : [];
  if (!buttons.length) return null;
  return (
    <ActionForm action={decideReplyAction} hidden={{ replyId }} successTitle="Decision saved">
      {(state, fid) => (
        <>
          <ReasonField id={`${fid}-reason`} state={state} rows={2} hint={replyState === "pending" ? "Required to reject. The author sees it." : replyState === "hidden" ? "Optional when restoring. Required to remove." : "Required. The author sees it."} />
          <div className="mt-3 flex flex-wrap gap-3">
            {buttons.map((b) => <SubmitButton key={b.value} name="decision" value={b.value} className={b.primary ? primaryButton : b.danger ? dangerButton : secondaryButton} pendingText="Saving…">{b.label}</SubmitButton>)}
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Reject or remove one photo without deciding the whole post. */
export function MediaDecisionForm({ mediaId, label }: { mediaId: string; label: string }) {
  return (
    <details className="mt-2">
      <summary className="t-body-sm underline underline-offset-4 cursor-pointer min-h-11 inline-flex items-center">Turn down this photo<span className="sr-only">: {label}</span></summary>
      <ActionForm action={decideMediaAction} hidden={{ mediaId }}>
        {(state, fid) => (
          <>
            <ReasonField id={`${fid}-reason`} state={state} rows={2} required hint="The owner sees this reason." />
            <div className="mt-3 flex flex-wrap gap-3">
              <SubmitButton name="decision" value="reject" className={secondaryButton} pendingText="Saving…">Reject photo</SubmitButton>
              <SubmitButton name="decision" value="remove" className={dangerButton} pendingText="Saving…">Remove photo</SubmitButton>
            </div>
          </>
        )}
      </ActionForm>
    </details>
  );
}

/** Search-engine indexing for one post. The page only shows this to administrators; the service checks again. */
export function IndexingForm({ id, current }: { id: string; current: string }) {
  return (
    <ActionForm action={setIndexingAction} hidden={{ id }}>
      {(state, fid) => (
        <>
          <Field id={`${fid}-indexing`} label="Search engines" hint="Approval and indexing are separate. “Follow the quality policy” lets the site decide from answers and quality rules." error={state.fields?.indexing}>
            <select {...describedBy(`${fid}-indexing`, true, state.fields?.indexing)} name="indexing" defaultValue={current} className={inputClass}>
              {INDEXING_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Save search setting</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** Link a question to an earlier one that already answers it. Empty clears the link. */
export function DuplicateForm({ id, current }: { id: string; current: string | null }) {
  return (
    <ActionForm action={markDuplicateAction} hidden={{ id }}>
      {(state, fid) => (
        <>
          <Field id={`${fid}-other`} label="Earlier question" hint={`Paste the address or short id of a published question. Leave empty to remove the link.${current ? " A link is set now." : ""}`} error={state.fields?.other}>
            <input {...describedBy(`${fid}-other`, true, state.fields?.other)} name="other" type="text" maxLength={200} defaultValue={(state.values?.other as string) ?? ""} className={inputClass} />
          </Field>
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Save duplicate link</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** Correct an accepted answer that was chosen in bad faith. A reason is always recorded. */
export function AcceptedAnswerForm({ id, options, current }: { id: string; options: { id: string; label: string }[]; current: string | null }) {
  return (
    <ActionForm action={overrideAcceptedAnswerAction} hidden={{ id }}>
      {(state, fid) => (
        <>
          <Field id={`${fid}-reply`} label="Accepted answer" hint="Only published answers can be chosen." error={state.fields?.replyId}>
            <select {...describedBy(`${fid}-reply`, true, state.fields?.replyId)} name="replyId" defaultValue={current ?? ""} className={inputClass}>
              <option value="">No accepted answer</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <ReasonField id={`${fid}-reason`} state={state} rows={2} required hint="Recorded in the audit log." />
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Change accepted answer</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** Set an activity's status, for example after a report that it was cancelled. */
export function EventStatusForm({ id, current }: { id: string; current: string }) {
  return (
    <ActionForm action={moderateEventStatusAction} hidden={{ id }}>
      {(state, fid) => (
        <>
          <Field id={`${fid}-status`} label="Activity status" error={state.fields?.status}>
            <select {...describedBy(`${fid}-status`, false, state.fields?.status)} name="status" defaultValue={current} className={inputClass}>
              {EVENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field id={`${fid}-note`} label="Public note" optional hint="Shown with the status, for example “Cancelled by the organiser because of the weather”." error={state.fields?.note}>
            <input {...describedBy(`${fid}-note`, true, state.fields?.note)} name="note" type="text" maxLength={300} defaultValue={(state.values?.note as string) ?? ""} className={inputClass} />
          </Field>
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Save status</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** Record that the listing's facts were checked today, and whether the organiser is confirmed. */
export function FactCheckForm({ id, organiserVerified }: { id: string; organiserVerified: boolean }) {
  return (
    <ActionForm action={recordFactCheckAction} hidden={{ id }}>
      {(_state, fid) => (
        <>
          <p className="t-body-sm text-ink-600 mt-0">Use this after checking the date, place, price and booking link against the organiser’s own source.</p>
          <label htmlFor={`${fid}-verified`} className="flex items-center gap-2 t-body-sm min-h-11">
            <input id={`${fid}-verified`} type="checkbox" name="organiserVerified" defaultChecked={organiserVerified} className="w-5 h-5" />
            The organiser is confirmed (this is separate from sponsorship or affiliation)
          </label>
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Record fact check</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** Suspend an account until a day (or with no end date), or lift a suspension. */
export function RestrictForm({ memberId, status }: { memberId: string; status: string }) {
  if (status === "deleted") return <p className="t-body-sm text-ink-600 m-0">This account was deleted.</p>;
  if (status === "suspended") {
    return (
      <ActionForm action={restrictAccountAction} hidden={{ memberId, action: "unsuspend" }}>
        {(state, fid) => (
          <>
            <ReasonField id={`${fid}-reason`} state={state} rows={2} label="Reason (optional)" hint="Recorded in the audit log." />
            <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Lift the suspension</SubmitButton></div>
          </>
        )}
      </ActionForm>
    );
  }
  return (
    <ActionForm action={restrictAccountAction} hidden={{ memberId, action: "suspend" }}>
      {(state, fid) => (
        <>
          <p className="t-body-sm text-ink-600 mt-0">A suspended member can still read and sign in, but cannot post, reply, vote or report.</p>
          <Field id={`${fid}-until`} label="Suspended until" optional hint="Leave empty for no end date. The suspension ends at the start of this day (UTC)." error={state.fields?.until}>
            <input {...describedBy(`${fid}-until`, true, state.fields?.until)} name="until" type="date" defaultValue={(state.values?.until as string) ?? ""} className={inputClass} />
          </Field>
          <ReasonField id={`${fid}-reason`} state={state} required hint="The member sees that they are suspended. Keep the reason factual." />
          <div className="mt-3"><SubmitButton className={dangerButton} pendingText="Saving…">Suspend account</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** A person decides trust; posting volume never does. */
export function TrustedForm({ memberId, trusted }: { memberId: string; trusted: boolean }) {
  return (
    <ActionForm action={setTrustedAction} hidden={{ memberId, trusted: trusted ? "false" : "true" }}>
      {() => (
        <>
          <p className="t-body-sm m-0">Currently: <strong>{trusted ? "Trusted" : "Not marked as trusted"}</strong></p>
          <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">{trusted ? "Remove trusted mark" : "Mark as trusted"}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/**
 * Help a member who cannot get in. Moderators never see or choose a member's password: they can
 * only send the member the same reset link the member could ask for themselves.
 */
export function MemberSignInHelp({ memberId, verified }: { memberId: string; verified: boolean }) {
  return (
    <div className="grid gap-6">
      {!verified && (
        <>
          <ActionForm action={resendMemberVerificationAction} hidden={{ memberId }} successTitle="Sent">
            {() => (
              <>
                <p className="t-body-sm m-0">This member has not confirmed their email address yet, so they cannot sign in.</p>
                <div className="mt-3"><SubmitButton variant="secondary" pendingText="Sending…">Send the confirmation email again</SubmitButton></div>
              </>
            )}
          </ActionForm>
          <ActionForm action={markMemberVerifiedAction} hidden={{ memberId }} successTitle="Confirmed">
            {(state, fid) => (
              <>
                <ReasonField id={`${fid}-reason`} state={state} rows={2} required label="How do you know the address is theirs?" hint="Only confirm by hand when the email cannot reach them, for example after they wrote to you from this address. Recorded in the audit log." />
                <div className="mt-3"><SubmitButton variant="secondary" pendingText="Saving…">Mark email as confirmed</SubmitButton></div>
              </>
            )}
          </ActionForm>
        </>
      )}
      <ActionForm action={sendMemberPasswordResetAction} hidden={{ memberId }} successTitle="Sent">
        {() => (
          <>
            <p className="t-body-sm m-0">Sends the member a link to choose a new password. It works for one hour. You never see the link or the password.</p>
            <div className="mt-3"><SubmitButton variant="secondary" pendingText="Sending…">Send a password reset link</SubmitButton></div>
          </>
        )}
      </ActionForm>
    </div>
  );
}

/** Close an open report with a written resolution. */
export function ReportResolveForm({ reportId }: { reportId: string }) {
  return (
    <ActionForm action={resolveReportAction} hidden={{ reportId }}>
      {(state, fid) => (
        <>
          <ReasonField id={`${fid}-resolution`} name="resolution" label="What was done" state={state} rows={2} required hint="For example: “Post hidden for spam” or “Checked; the facts are correct”. Take any action on the item itself first." />
          <div className="mt-3 flex flex-wrap gap-3">
            <SubmitButton name="status" value="resolved" className={primaryButton} pendingText="Saving…">Mark resolved</SubmitButton>
            <SubmitButton name="status" value="dismissed" className={secondaryButton} pendingText="Saving…">Dismiss</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Accept a suggested place by linking it to a published destination, or turn it down. */
export function SuggestionForm({ id }: { id: string }) {
  return (
    <ActionForm action={decideSuggestionAction} hidden={{ id }} successTitle="Decision saved">
      {(state, fid) => (
        <>
          <DestinationPicker name="destinationId" label="Matching destination" max={1} initial={[]} error={state.fields?.destinationId} hint="To accept, choose the published destination this suggestion should become. Create it in the CMS first if it does not exist yet (a merge is the same: choose the existing record)." />
          <ReasonField id={`${fid}-resolution`} name="resolution" label="Note" state={state} rows={2} hint="Required to turn it down. The member is told the outcome." />
          <div className="mt-3 flex flex-wrap gap-3">
            <SubmitButton name="decision" value="accept" className={primaryButton} pendingText="Saving…">Accept and link</SubmitButton>
            <SubmitButton name="decision" value="reject" className={dangerButton} pendingText="Saving…">Turn down</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** A labelled block on the review page. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-8 border border-line-500 rounded-md p-4 md:p-5 bg-paper-000 min-w-0">
      <h2 id={id} className="t-heading-3 mt-0 mb-3">{title}</h2>
      {children}
    </section>
  );
}
