"use client";

import { useActionState } from "react";

import { changePasswordAction, deleteAccountAction, suggestDestinationAction, updateEmailPrefsAction, updateProfileAction } from "@/lib/community/actions/account";
import { removeOwnAction, setEventStatusAction } from "@/lib/community/actions/contributions";
import { createPlanAction, renamePlanAction } from "@/lib/community/actions/plans";
import { LIMITS, type EmailCategory } from "@/lib/community/constants";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";
import { FormMessage, SubmitButton } from "./client";
import { describedBy, Field, inputClass } from "./ui";

/** The value to show: what was just submitted if the form came back with an error, otherwise the saved one. */
const val = (state: ActionState, key: string, fallback = "") => (typeof state.values?.[key] === "string" ? (state.values[key] as string) : fallback);

export function ProfileForm({ displayName, bio, experience }: { displayName: string; bio: string; experience: string }) {
  const [state, action] = useActionState(updateProfileAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[640px]">
      <FormMessage state={state} />
      <Field id="displayName" label="Name to show on your posts" hint="Your own name or a nickname, in any language or script." error={f.displayName} required>
        <input {...describedBy("displayName", true, f.displayName)} name="displayName" autoComplete="nickname" maxLength={60} required defaultValue={val(state, "displayName", displayName)} className={inputClass} />
      </Field>
      <Field id="bio" label="About you" hint={`A few lines other travellers see on your profile. Do not include phone numbers or your home address. Up to ${LIMITS.bioMax} characters.`} error={f.bio} optional>
        <textarea {...describedBy("bio", true, f.bio)} name="bio" rows={4} maxLength={LIMITS.bioMax} defaultValue={val(state, "bio", bio)} className={inputClass} />
      </Field>
      <Field id="experience" label="Travel experience" hint="For example: “Lived in Osaka for six years” or “Guide in Patagonia since 2015”. Shown next to your name on your posts, marked as self-described: Travel Notes does not check it. No links." error={f.experience} optional>
        <input {...describedBy("experience", true, f.experience)} name="experience" maxLength={200} defaultValue={val(state, "experience", experience)} className={inputClass} />
      </Field>
      <div className="mt-6"><SubmitButton>Save profile</SubmitButton></div>
    </form>
  );
}

const EMAIL_LABELS: Record<EmailCategory, { label: string; hint: string }> = {
  replies: { label: "Replies to my posts", hint: "When an answer or comment on your post is published." },
  moderation: { label: "Moderation decisions", hint: "When a moderator approves, returns or declines something you sent." },
  events: { label: "Changes to activities", hint: "When an activity you responded to is cancelled, postponed or moved." },
  digest: { label: "Destination digest", hint: "A short email with new posts about the destinations you follow." },
};

export function EmailPrefsForm({ prefs }: { prefs: Record<EmailCategory, boolean> }) {
  const [state, action] = useActionState(updateEmailPrefsAction, initialState);
  return (
    <form action={action} className="max-w-[640px]">
      <FormMessage state={state} />
      <fieldset className="border-0 p-0 m-0 mt-2">
        <legend className="t-ui p-0">Send me email about</legend>
        <p className="t-body-sm text-ink-600 mt-1 mb-2">You always see these in your notifications on the site. Emails to confirm your address or reset your password are always sent.</p>
        {(Object.keys(EMAIL_LABELS) as EmailCategory[]).map((c) => (
          <div key={c} className="flex items-start gap-3 py-2">
            <input id={`pref-${c}`} name={c} type="checkbox" defaultChecked={prefs[c]} aria-describedby={`pref-${c}-hint`} className="mt-1 w-5 h-5" />
            <div>
              <label htmlFor={`pref-${c}`} className="t-ui">{EMAIL_LABELS[c].label}</label>
              <p id={`pref-${c}-hint`} className="t-body-sm text-ink-600 m-0">{EMAIL_LABELS[c].hint}</p>
            </div>
          </div>
        ))}
      </fieldset>
      <div className="mt-4"><SubmitButton>Save email settings</SubmitButton></div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[460px]">
      <FormMessage state={state} />
      <Field id="current" label="Current password" error={f.current} required>
        <input {...describedBy("current", null, f.current)} name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field id="next" label="New password" hint="At least 10 characters. A short phrase of a few words works well." error={f.next} required>
        <input {...describedBy("next", true, f.next)} name="next" type="password" autoComplete="new-password" minLength={10} maxLength={128} required className={inputClass} />
      </Field>
      <div className="mt-6"><SubmitButton>Change password</SubmitButton></div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[640px]">
      <FormMessage state={state} />
      <fieldset className="border-0 p-0 m-0 mt-5">
        <legend className="t-ui p-0">Your published posts and replies</legend>
        <div className="mt-2 flex items-start gap-3">
          <input id="content-keep" name="content" type="radio" value="keep" defaultChecked className="mt-1 w-5 h-5" />
          <label htmlFor="content-keep" className="t-body-sm">Keep them public, shown as written by “Deleted member”. Answers you gave stay useful to other travellers.</label>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <input id="content-remove" name="content" type="radio" value="remove" className="mt-1 w-5 h-5" />
          <label htmlFor="content-remove" className="t-body-sm">Remove them from the site as well, with their photos.</label>
        </div>
      </fieldset>
      <Field id="delete-password" label="Your password" error={f.password} required>
        <input {...describedBy("delete-password", null, f.password)} name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field id="confirm" label="Type DELETE to confirm" error={f.confirm} required>
        <input {...describedBy("confirm", null, f.confirm)} name="confirm" autoComplete="off" autoCapitalize="characters" spellCheck={false} required className={`${inputClass} max-w-[14rem]`} />
      </Field>
      <div className="mt-6">
        <SubmitButton pendingText="Deleting…" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100 disabled:opacity-60">Delete my account</SubmitButton>
      </div>
    </form>
  );
}

export function SuggestDestinationForm() {
  const [state, action] = useActionState(suggestDestinationAction, initialState);
  const f = state.fields ?? {};
  // After a successful suggestion the fields start empty again (the form is re-keyed).
  return (
    <form key={state.ok ? state.message : "form"} action={action} noValidate className="max-w-[640px]">
      <FormMessage state={state} successTitle="Suggestion sent" />
      <Field id="name" label="Name of the place" hint="As people there write it, or the common English name. For example: Hội An, Cappadocia, Byron Bay." error={f.name} required>
        <input {...describedBy("name", true, f.name)} name="name" maxLength={120} required defaultValue={state.ok ? "" : val(state, "name")} className={inputClass} />
      </Field>
      <Field id="country" label="Country" error={f.country} required>
        <input {...describedBy("country", null, f.country)} name="country" maxLength={120} required autoComplete="country-name" defaultValue={state.ok ? "" : val(state, "country")} className={inputClass} />
      </Field>
      <Field id="details" label="Anything that helps us find it" hint="The region or state, or a nearby town. Up to 600 characters." error={f.details} optional>
        <textarea {...describedBy("details", true, f.details)} name="details" rows={4} maxLength={600} defaultValue={state.ok ? "" : val(state, "details")} className={inputClass} />
      </Field>
      <div className="mt-6"><SubmitButton pendingText="Sending…">Send suggestion</SubmitButton></div>
    </form>
  );
}

/** Take a published post off the site. Confirmed with a checkbox, inside a <details> on the page. */
export function RemovePublishedForm({ id }: { id: string }) {
  const [state, action] = useActionState(removeOwnAction, initialState);
  return (
    <form action={action} className="mt-3">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex items-start gap-3">
        <input id="remove-confirm" name="confirm" type="checkbox" value="yes" required className="mt-1 w-5 h-5" />
        <label htmlFor="remove-confirm" className="t-body-sm">I understand this post and its photos will no longer be public. This cannot be undone from my account.</label>
      </div>
      <div className="mt-4">
        <SubmitButton pendingText="Removing…" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100 disabled:opacity-60">Remove this post</SubmitButton>
      </div>
    </form>
  );
}

/** The organiser marks their own published activity as cancelled or postponed. */
export function EventStatusForm({ id }: { id: string }) {
  const [state, action] = useActionState(setEventStatusAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="mt-3 max-w-[640px]">
      <FormMessage state={state} successTitle="Status updated" />
      <input type="hidden" name="id" value={id} />
      <fieldset className="border-0 p-0 m-0">
        <legend className="t-ui p-0">What has changed?</legend>
        <div className="mt-2 flex items-center gap-3 min-h-11">
          <input id="status-postponed" name="status" type="radio" value="postponed" defaultChecked className="w-5 h-5" />
          <label htmlFor="status-postponed" className="t-body-sm">Postponed: it will happen later, the new date is not known yet</label>
        </div>
        <div className="flex items-center gap-3 min-h-11">
          <input id="status-cancelled" name="status" type="radio" value="cancelled" className="w-5 h-5" />
          <label htmlFor="status-cancelled" className="t-body-sm">Cancelled: it will not happen</label>
        </div>
      </fieldset>
      <Field id="status-note" label="Short note for people who responded" hint="For example the reason, or where to find updates. Up to 300 characters." error={f.note} optional>
        <textarea {...describedBy("status-note", true, f.note)} name="note" rows={3} maxLength={300} className={inputClass} />
      </Field>
      <p className="t-body-sm text-ink-600 mt-3">If only the date or time changes, edit the activity above instead and send the change for review.</p>
      <div className="mt-4"><SubmitButton pendingText="Saving…" variant="secondary">Update the status</SubmitButton></div>
    </form>
  );
}

export function CreatePlanForm() {
  const [state, action] = useActionState(createPlanAction, initialState);
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="max-w-[640px]">
      <FormMessage state={state} />
      <Field id="plan-title" label="Name of the plan" hint="For example: Japan in spring, or Weekend in Hobart." error={f.title} required>
        <input {...describedBy("plan-title", true, f.title)} name="title" maxLength={140} required defaultValue={val(state, "title")} className={inputClass} />
      </Field>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field id="plan-start" label="Start date" error={f.startDate} optional>
          <input {...describedBy("plan-start", null, f.startDate)} name="startDate" type="date" defaultValue={val(state, "startDate")} className={inputClass} />
        </Field>
        <Field id="plan-end" label="End date" error={f.endDate} optional>
          <input {...describedBy("plan-end", null, f.endDate)} name="endDate" type="date" defaultValue={val(state, "endDate")} className={inputClass} />
        </Field>
      </div>
      <div className="mt-6"><SubmitButton pendingText="Creating…">Create plan</SubmitButton></div>
    </form>
  );
}

export function RenamePlanForm({ id, title }: { id: string; title: string }) {
  const [state, action] = useActionState(renamePlanAction, initialState);
  const f = state.fields ?? {};
  const fieldId = `rename-${id}`;
  return (
    <form action={action} noValidate className="mt-2">
      <FormMessage state={state} successTitle="Renamed" />
      <input type="hidden" name="id" value={id} />
      <Field id={fieldId} label="New name" error={f.title} required>
        <input {...describedBy(fieldId, null, f.title)} name="title" maxLength={140} required defaultValue={val(state, "title", title)} className={inputClass} />
      </Field>
      <div className="mt-3"><SubmitButton variant="secondary">Save name</SubmitButton></div>
    </form>
  );
}
