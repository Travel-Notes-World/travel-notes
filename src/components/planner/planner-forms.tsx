"use client";

import { useActionState } from "react";

import { DestinationPicker, FormMessage, SubmitButton, type PickedPlace } from "@/components/community/client";
import { describedBy, Field, inputClass } from "@/components/community/ui";
import { initialState } from "@/lib/community/next/state";
import { savePlannerAction } from "@/lib/planner/actions";
import { MONTH_NAMES, MONTHS, type Month } from "@/lib/content/destinationFacts";
import { PACES, PARTIES, PLANNER, PURPOSES, type Pace, type Party, type Purpose } from "@/lib/planner/input";

/**
 * The trip details. A plain GET form: the answers become the page address, so the plan can be
 * shared or bookmarked and nothing is stored. Choosing places needs JavaScript (a search list);
 * the rest works without it.
 */
export function PlannerForm({ purpose = "holiday", places, start, month, days, party, pace, errors = {}, submitLabel = "Plan my trip" }: {
  purpose?: Purpose; places: PickedPlace[]; start: string | null; month: Month | null; days: number; party: Party | null; pace: Pace;
  errors?: Partial<Record<"to" | "start" | "days", string>>; submitLabel?: string;
}) {
  return (
    <form method="get" action="/trip-planner" className="max-w-[640px]">
      <input type="hidden" name="go" value="1" />
      <fieldset className="border-0 p-0 m-0 min-w-0">
        <legend className="t-ui text-ink-900 p-0">Why do you need a travel plan?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PURPOSES.map((p) => (
            <label key={p.value} className="flex items-start gap-2 rounded-sm border border-line-500 p-3 cursor-pointer has-[:checked]:border-marine-600 has-[:checked]:bg-marine-100">
              <input type="radio" name="for" value={p.value} defaultChecked={purpose === p.value} className="mt-1 w-4 h-4" />
              <span><span className="t-ui block">{p.label}</span><span className="t-body-sm text-ink-600">{p.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <DestinationPicker
        // A new set of places from the server (for example after "Edit") resets the list.
        key={places.map((p) => p.id).join(",")}
        name="to"
        label="Where are you going?"
        hint={`Type at least two letters of a country, region or city, then choose from the list. Add up to ${PLANNER.maxPlaces} places in the order you will visit them.`}
        initial={places}
        max={PLANNER.maxPlaces}
        error={errors.to}
        required
        suggestLink={false}
      />
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field id="start" label="First day" hint="Leave empty if you have no dates yet." error={errors.start} optional>
          <input {...describedBy("start", true, errors.start)} type="date" name="start" defaultValue={start ?? ""} className={inputClass} />
        </Field>
        <Field id="month" label="Or the month you plan to go" hint="Used when there is no first day." optional>
          <select {...describedBy("month", true)} name="month" defaultValue={month ?? ""} className={inputClass}>
            <option value="">Not sure yet</option>
            {MONTHS.map((m) => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field id="days" label="Number of days" hint={`From ${PLANNER.minDays} to ${PLANNER.maxDays}.`} error={errors.days} required>
          <input {...describedBy("days", true, errors.days)} type="number" name="days" inputMode="numeric" min={PLANNER.minDays} max={PLANNER.maxDays} required defaultValue={days} className={inputClass} />
        </Field>
        <Field id="with" label="Who is travelling?" optional>
          <select {...describedBy("with")} name="with" defaultValue={party ?? ""} className={inputClass}>
            <option value="">Prefer not to say</option>
            {PARTIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
      </div>
      <fieldset className="mt-5 border-0 p-0 m-0 min-w-0">
        <legend className="t-ui text-ink-900 p-0">Pace</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {PACES.map((p) => (
            <label key={p.value} className="flex items-start gap-2 rounded-sm border border-line-500 p-3 cursor-pointer has-[:checked]:border-marine-600 has-[:checked]:bg-marine-100">
              <input type="radio" name="pace" value={p.value} defaultChecked={pace === p.value} className="mt-1 w-4 h-4" />
              <span><span className="t-ui block">{p.label}</span><span className="t-body-sm text-ink-600">{p.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6"><SubmitButton pendingText="Planning…">{submitLabel}</SubmitButton></div>
    </form>
  );
}

/** Save the current draft to the member's account (or sign in first and come back). */
export function SavePlanForm({ query, signedIn }: { query: string; signedIn: boolean }) {
  const [state, action] = useActionState(savePlannerAction, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="query" value={query} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">{signedIn ? "Save to my trips" : "Sign in to save this plan"}</SubmitButton>
    </form>
  );
}
