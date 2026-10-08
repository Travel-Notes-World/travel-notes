"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { autosaveDraftAction, saveContributionAction, similarQuestionsAction, type SimilarItem } from "@/lib/community/actions/contributions";
import { LIMITS, PARTY_TYPES, TRAVEL_STYLES, type ContributionType } from "@/lib/community/constants";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";
import { DestinationPicker, FormMessage, RestoreBanner, restoreInto, SubmitButton, useDraftBackup, type PickedPlace } from "./client";
import { describedBy, Field, inputClass } from "./ui";

export type FormInitial = {
  title: string
  body: string
  destinations: PickedPlace[]
  topics: string[]
  style: string | null
  /** Type-specific simple values, by form field name. */
  extra: Record<string, string | boolean | null | undefined>
}

export type FieldsProps = {
  /** The value to show for a field: what was just submitted if the form came back with an error, otherwise the saved value. */
  value: (name: string) => string
  checked: (name: string) => boolean
  errors: Record<string, string>
  state: ActionState
  /** Called by the destination picker with the time zone of the first chosen place. */
  destinationZone: string | null
}

/**
 * The shared form for questions, trip reports and activities.
 *
 * - "Save draft" keeps it private; "Submit for review" sends it to the moderators.
 * - An existing draft is saved automatically every few seconds while being written.
 * - A copy is also kept in this browser, so text survives an expired session.
 * - Editing something already published sends the change for review; the public version stays
 *   as it is until a moderator approves.
 */
export function ContributionForm({
  type, id, initial, published = false, topics = [], intro, children, submitLabel = "Submit for review",
}: {
  type: ContributionType; id: string | null; initial: FormInitial; published?: boolean; topics?: { id: string; name: string }[]
  intro?: ReactNode; children?: (props: FieldsProps) => ReactNode; submitLabel?: string
}) {
  const [state, action] = useActionState(saveContributionAction, initialState);
  const { formRef, restorable, clear } = useDraftBackup(`tn-draft:${type}:${id ?? "new"}`);
  const [zone, setZone] = useState<string | null>(null);
  const [autosave, setAutosave] = useState("");
  const errors = state.fields ?? {};
  const submitted = state.values;
  const value = (name: string) => {
    if (submitted && typeof submitted[name] === "string") return submitted[name] as string;
    if (name === "title") return initial.title;
    if (name === "body") return initial.body;
    if (name === "style") return initial.style ?? "";
    const v = initial.extra[name];
    return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  };
  const checked = (name: string) => (submitted ? submitted[name] === "on" : Boolean(initial.extra[name]));

  // Background save for an existing draft, a few seconds after the last change.
  useEffect(() => {
    const form = formRef.current;
    if (!form || !id || published) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const result = await autosaveDraftAction(new FormData(form)).catch(() => ({ ok: false, message: "Could not save automatically." }));
        setAutosave(result.ok ? `Draft saved automatically at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : result.message ?? "");
      }, 5000);
    };
    form.addEventListener("input", onInput);
    return () => { form.removeEventListener("input", onInput); clearTimeout(timer); };
  }, [formRef, id, published]);

  return (
    <form ref={formRef} action={action} noValidate className="max-w-[760px]">
      <RestoreBanner restorable={restorable} onRestore={() => { restoreInto(formRef.current, restorable ?? {}); clear(); }} onDiscard={clear} />
      <FormMessage state={state} successTitle="Saved" />
      {intro}
      <input type="hidden" name="type" value={type} />
      {id && <input type="hidden" name="id" value={id} />}

      <Field id="title" label="Title" hint={type === "question" ? "Ask your question in one clear sentence." : type === "trip" ? "Where you went and what kind of trip it was." : "What it is, in a few words."} error={errors.title} required>
        <input {...describedBy("title", true, errors.title)} name="title" maxLength={LIMITS.titleMax} required defaultValue={value("title")} className={inputClass} />
      </Field>
      {type === "question" && !published && <SimilarQuestions formRef={formRef} />}

      <DestinationPicker initial={initial.destinations} error={errors.destinations} required onTimeZone={setZone} />

      <Field
        id="body"
        label={type === "question" ? "Your question in detail" : type === "trip" ? "Your trip, in your own words" : "Description"}
        hint={type === "question" ? "Say what you already know and what you are unsure about. Example: “We arrive late on Friday and leave Sunday night. Is it realistic to see the main temples without rushing?”" : type === "trip" ? "Your own first-hand experience. Plain text; leave an empty line between paragraphs." : "What happens, who it suits and what to bring. Plain text."}
        error={errors.body}
        required
      >
        <textarea {...describedBy("body", true, errors.body)} name="body" rows={type === "trip" ? 14 : 8} maxLength={LIMITS.bodyMax} required defaultValue={value("body")} className={inputClass} />
      </Field>

      {children?.({ value, checked, errors, state, destinationZone: zone })}

      <Field id="style" label="Travel style" optional error={errors.style}>
        <select {...describedBy("style", null, errors.style)} name="style" defaultValue={value("style")} className={inputClass}>
          <option value="">Not specified</option>
          {TRAVEL_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      {topics.length > 0 && (
        <fieldset className="mt-5 border-0 p-0 m-0">
          <legend className="t-ui">Topics <span className="text-ink-600 font-normal">(optional, up to {LIMITS.maxTopics})</span></legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {topics.map((t) => (
              <label key={t.id} className="inline-flex items-center gap-2 t-body-sm min-h-9">
                <input type="checkbox" name="topics" value={t.id} defaultChecked={initial.topics.includes(t.id)} className="w-4 h-4" /> {t.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-8 border-t border-paper-200 pt-6">
        {published ? (
          <p className="t-body-sm text-ink-600 max-w-measure">Your changes go to a moderator first. The published version stays as it is until they are approved.</p>
        ) : (
          <p className="t-body-sm text-ink-600 max-w-measure">A moderator reviews every new post before it appears. You can save a draft and come back to it from <Link href="/account" className="text-marine-600">your account</Link>.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <SubmitButton name="intent" value="submit" pendingText="Sending…">{published ? "Send changes for review" : submitLabel}</SubmitButton>
          {!published && <SubmitButton name="intent" value="save" variant="secondary" pendingText="Saving…">Save draft</SubmitButton>}
        </div>
        <p role="status" aria-live="polite" className="t-body-sm text-ink-600 mt-3 mb-0">{autosave}</p>
      </div>
    </form>
  );
}

/** Questions that may already have an answer, shown while the title is typed. Never blocks posting. */
function SimilarQuestions({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const [items, setItems] = useState<SimilarItem[]>([]);
  const last = useRef("");
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.name !== "title") return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const title = target.value.trim();
        if (title === last.current) return;
        last.current = title;
        setItems(await similarQuestionsAction(title).catch(() => []));
      }, 600);
    };
    form.addEventListener("input", onInput);
    return () => { form.removeEventListener("input", onInput); clearTimeout(timer); };
  }, [formRef]);
  if (!items.length) return null;
  return (
    <div role="status" className="mt-3 bg-paper-100 rounded-md p-4 max-w-measure">
      <p className="t-ui m-0">These questions may already help</p>
      <ul className="mt-2 mb-0 pl-5 t-body-sm">
        {items.map((i) => <li key={i.path}><Link href={i.path} target="_blank" className="text-marine-600">{i.title}</Link> <span className="text-ink-600">({i.answers === 1 ? "1 answer" : `${i.answers} answers`})</span></li>)}
      </ul>
    </div>
  );
}

const CURRENCIES = ["AUD", "USD", "EUR", "GBP", "JPY", "THB", "NZD", "CAD", "SGD", "INR", "IDR", "VND", "CNY", "HKD", "KRW", "MYR", "PHP", "CHF", "ZAR", "AED", "MXN", "BRL"];

/** A currency choice: common currencies in a list, any other ISO code can be typed. */
export function CurrencyInput({ id, name, value, error, label = "Currency" }: { id: string; name: string; value: string; error?: string; label?: string }) {
  return (
    <>
      <input {...describedBy(id, null, error)} name={name} list={`${id}-list`} maxLength={3} defaultValue={value} placeholder="AUD" aria-label={label} className={`${inputClass} uppercase max-w-[8rem]`} autoComplete="off" />
      <datalist id={`${id}-list`}>{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
}

/** The extra fields of a question. All optional: they help people give a useful answer. */
export function QuestionFields({ value, errors }: FieldsProps) {
  return (
    <fieldset className="mt-6 border border-paper-200 rounded-md p-4">
      <legend className="t-ui px-1">About your trip <span className="text-ink-600 font-normal">(optional)</span></legend>
      <div className="grid gap-x-6 md:grid-cols-2">
        <Field id="travelMonth" label="When are you going?" error={errors.travelMonth}>
          <input {...describedBy("travelMonth", null, errors.travelMonth)} name="travelMonth" type="month" defaultValue={value("travelMonth")} className={inputClass} />
        </Field>
        <Field id="durationDays" label="For how many days?" error={errors.durationDays}>
          <input {...describedBy("durationDays", null, errors.durationDays)} name="durationDays" type="number" inputMode="numeric" min={1} max={730} defaultValue={value("durationDays")} className={inputClass} />
        </Field>
        <Field id="partyType" label="Who is travelling?" error={errors.partyType}>
          <select {...describedBy("partyType", null, errors.partyType)} name="partyType" defaultValue={value("partyType")} className={inputClass}>
            <option value="">Not specified</option>
            {PARTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field id="budget" label="Rough budget" hint="Total for the trip, in the currency you think in." error={errors.budget}>
          <div className="flex gap-2">
            <input {...describedBy("budget", true, errors.budget)} name="budget" inputMode="decimal" defaultValue={value("budget")} placeholder="1500" className={inputClass} />
            <CurrencyInput id="budgetCurrency" name="budgetCurrency" value={value("budgetCurrency")} label="Budget currency" />
          </div>
        </Field>
      </div>
    </fieldset>
  );
}

type WrapperProps = { id: string | null; initial: FormInitial; published?: boolean; topics?: { id: string; name: string }[]; intro?: ReactNode };

export function QuestionForm(props: WrapperProps) {
  return <ContributionForm type="question" {...props} submitLabel="Submit question for review">{(p) => <QuestionFields {...p} />}</ContributionForm>;
}
