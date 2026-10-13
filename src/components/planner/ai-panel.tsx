"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormMessage, SubmitButton } from "@/components/community/client";
import { describedBy, Field, inputClass } from "@/components/community/ui";
import { initialState } from "@/lib/community/next/state";
import type { ActionState } from "@/lib/community/next/forms";
import { generateAiPlanAction, payForAiPlanAction, saveTripDetailsAction, setSharingAction } from "@/lib/planner/ai-actions";

export type AiPanelStatus = {
  available: boolean;
  reason: string | null;
  freeLeft: number;
  unlocked: boolean;
  next: "brief" | "detailed" | "revision" | null;
  blocked: string | null;
  revisionsLeft: number;
  revisionsIncluded: number;
  priceText: string;
  canPay: boolean;
  generated: boolean;
  tooLong: boolean;
  hasPlaces: boolean;
  maxDays: number;
  purpose: "holiday" | "visa" | "family" | "business";
};

/** What the free plan includes and what upgrading adds, shown before anything is generated or paid. */
export function PlanTiers({ priceText, revisions, compact = false }: { priceText: string; revisions: number; compact?: boolean }) {
  return (
    <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="rounded-md border border-paper-200 p-4">
        <p className="t-ui m-0">Free brief plan <span className="text-ink-600 font-normal">· your first plan</span></p>
        <ul className="t-body-sm mt-2 mb-0 pl-5 grid gap-1">
          <li>One destination, one plan</li>
          <li>A short outline: 2 suggestions a day</li>
          <li>Budget guidance from your own budget</li>
          <li>The same checked facts, sources and travel updates</li>
          <li>View it here in your account</li>
        </ul>
      </div>
      <div className="rounded-md border-2 border-marine-600 p-4">
        <p className="t-ui m-0">Detailed plan <span className="text-ink-600 font-normal">· {priceText} once, including GST</span></p>
        <ul className="t-body-sm mt-2 mb-0 pl-5 grid gap-1">
          <li>Up to 5 destinations</li>
          <li>Morning, afternoon and evening, with meal areas and breaks</li>
          <li>Where to stay each night and how to get around</li>
          <li>Holidays: budget, balanced and premium ways to do the trip</li>
          <li>Nearby day trips and overnight stops, with distances</li>
          <li>What travellers reported spending, where we have it</li>
          <li>{revisions} AI revisions</li>
          <li>A private share link</li>
          <li>PDF and print version (holiday or visa layout)</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * The AI helper. It shows the limits before anything is generated, then offers the one step that
 * is allowed now: write the free brief plan, upgrade, write the detailed plan, or revise it.
 */
export function AiPanel({ id, status }: { id: string; status: AiPanelStatus }) {
  const [genState, generate] = useActionState(generateAiPlanAction, initialState);
  const [payState, pay] = useActionState(payForAiPlanAction, initialState);
  const pending = "Writing your plan… this can take up to a minute";

  let body: React.ReactNode;
  if (!status.hasPlaces) {
    body = <p className="t-body-sm text-ink-600 mt-3 mb-0">This plan was not started in the Trip Planner, so the AI does not know where you are going. Start a new plan from the <Link href="/trip-planner" className="text-marine-600 underline">Trip Planner</Link>.</p>;
  } else if (!status.available) {
    body = <p className="t-body-sm text-ink-600 mt-3 mb-0">{status.reason}</p>;
  } else if (status.tooLong) {
    body = <p className="t-body-sm text-ink-600 mt-3 mb-0">AI plans cover up to {status.maxDays} days. Remove some days, or split the trip into two plans.</p>;
  } else if (status.next === "brief") {
    body = (
      <form action={generate} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <p className="t-body-sm mt-0">Your free plan is a short outline for one destination. Save your trip details above first: the AI uses them.</p>
        <SubmitButton pendingText={pending}>Write my free plan</SubmitButton>
      </form>
    );
  } else if (status.next === "detailed") {
    body = (
      <form action={generate} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <p className="t-body-sm mt-0">Thank you for upgrading. Check your trip details above, then write your detailed plan.</p>
        <SubmitButton pendingText={pending}>Write my detailed plan</SubmitButton>
      </form>
    );
  } else if (status.next === "revision") {
    body = (
      <form action={generate} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <Field id="instruction" label="What should change?" hint={`For example: “More food markets, and a slower day 3.” ${status.revisionsLeft} of ${status.revisionsIncluded} revisions left.`} optional>
          <textarea {...describedBy("instruction", true)} name="instruction" rows={2} maxLength={500} defaultValue={typeof genState.values?.instruction === "string" ? (genState.values.instruction as string) : ""} className={inputClass} />
        </Field>
        <div className="mt-3"><SubmitButton pendingText={pending}>Revise my plan</SubmitButton></div>
      </form>
    );
  } else if (!status.unlocked && status.canPay) {
    body = (
      <form action={pay} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <p className="t-body-sm mt-0">{status.blocked} One payment of {status.priceText} (including GST) upgrades this plan. You pay on Stripe’s secure page; Travel Notes never sees your card details.</p>
        <SubmitButton pendingText="Opening the secure payment page…">Upgrade this plan: {status.priceText}</SubmitButton>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">If the AI cannot finish your plan, try again: it does not use up your purchase. <Link href="/trip-planner/pricing" className="text-marine-600 underline">What is included</Link></p>
      </form>
    );
  } else {
    body = <p className="t-body-sm text-ink-600 mt-3 mb-0">{status.blocked}{!status.unlocked ? " Paid plans are not available yet." : ""}</p>;
  }

  return (
    <section aria-labelledby="ai-heading" className="mb-8 max-w-[860px] border border-marine-600 rounded-md p-4 bg-paper-000 print:hidden">
      <h2 id="ai-heading" className="t-heading-3 m-0">AI helper</h2>
      <p className="t-body-sm mt-2 mb-0">
        The AI writes your days using Travel Notes guides, trip reports and travel updates first. Anything it adds on its own is marked “AI idea”: Travel Notes has not checked it. It never gives prices, opening hours or entry rules. Your own stops are kept.
      </p>
      {!status.unlocked && !status.generated && <div className="mt-4"><PlanTiers priceText={status.priceText} revisions={status.revisionsIncluded} /></div>}
      <FormMessage state={genState} successTitle="Done" />
      <FormMessage state={payState} />
      {body}
    </section>
  );
}

/** Upgrade from elsewhere on the page (for example next to the locked PDF). */
export function UpgradeForm({ id, priceText, label }: { id: string; priceText: string; label?: string }) {
  const [state, pay] = useActionState(payForAiPlanAction, initialState);
  return (
    <form action={pay}>
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Opening the secure payment page…">{label ?? `Upgrade this plan: ${priceText}`}</SubmitButton>
    </form>
  );
}

const val = (state: ActionState, key: string, fallback: string) => (typeof state.values?.[key] === "string" ? (state.values[key] as string) : fallback);

export type DetailsInitial = {
  purpose: AiPanelStatus["purpose"];
  departFrom: string; travellers: number | null; budgetAmount: number | null; budgetCurrency: string; interests: string[]; accessibility: string;
  travellerName: string; visitPurpose: string; arrivalDate: string | null; departureDate: string | null; cities: string; accommodation: string; transport: string; funding: string | null; fundingNote: string;
};

/** The questions change with the purpose of the trip. Nothing here is required except visa dates. */
export function TripDetailsForm({ id, initial, interests, funding, currencies }: {
  id: string; initial: DetailsInitial; interests: readonly { value: string; label: string }[]; funding: readonly { value: string; label: string }[]; currencies: string[];
}) {
  const [state, action] = useActionState(saveTripDetailsAction, initialState);
  const [purpose, setPurpose] = useState(initial.purpose);
  const f = state.fields ?? {};
  const chosen = new Set(initial.interests);
  return (
    <form action={action} noValidate className="max-w-[860px]">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} successTitle="Saved" />
      <Field id="purpose" label="Purpose of the trip" required>
        <select {...describedBy("purpose")} name="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as DetailsInitial["purpose"])} className={inputClass}>
          <option value="holiday">Holiday or sightseeing</option>
          <option value="visa">Itinerary for a visa application (not Australian visas)</option>
          <option value="family">Visiting family or friends</option>
          <option value="business">Business trip with some leisure</option>
        </select>
      </Field>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field id="departFrom" label="Travelling from" hint="A city, for example Sydney." optional>
          <input {...describedBy("departFrom", true)} name="departFrom" maxLength={120} defaultValue={val(state, "departFrom", initial.departFrom)} className={inputClass} />
        </Field>
        <Field id="travellers" label="Number of travellers" error={f.travellers} optional>
          <input {...describedBy("travellers", null, f.travellers)} name="travellers" type="number" inputMode="numeric" min={1} max={20} defaultValue={val(state, "travellers", initial.travellers ? String(initial.travellers) : "")} className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-[2fr_1fr]">
        <Field id="budgetAmount" label="Total budget for the trip" hint="Used to shape the suggestions and to work out a daily amount. Optional." error={f.budgetAmount} optional>
          <input {...describedBy("budgetAmount", true, f.budgetAmount)} name="budgetAmount" inputMode="decimal" defaultValue={val(state, "budgetAmount", initial.budgetAmount !== null ? String(initial.budgetAmount) : "")} className={inputClass} />
        </Field>
        <Field id="budgetCurrency" label="Currency" error={f.budgetCurrency} optional>
          <select {...describedBy("budgetCurrency", null, f.budgetCurrency)} name="budgetCurrency" defaultValue={val(state, "budgetCurrency", initial.budgetCurrency || "AUD")} className={inputClass}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <fieldset className="mt-5 border-0 p-0 m-0 min-w-0">
        <legend className="t-ui text-ink-900 p-0">Interests <span className="text-ink-600 font-normal">(optional)</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {interests.map((i) => (
            <label key={i.value} className="inline-flex items-center gap-2 min-h-11 px-3 rounded-full border border-line-500 cursor-pointer has-[:checked]:border-marine-600 has-[:checked]:bg-marine-100 t-body-sm">
              <input type="checkbox" name="interests" value={i.value} defaultChecked={chosen.has(i.value)} className="w-4 h-4" />{i.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="accessibility" label="Accessibility needs" hint="For example: no long walks, step-free access, a wheelchair user. Only shared with the AI to shape the plan." optional>
        <textarea {...describedBy("accessibility", true)} name="accessibility" rows={2} maxLength={600} defaultValue={val(state, "accessibility", initial.accessibility)} className={inputClass} />
      </Field>

      {purpose === "visa" && (
        <fieldset className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
          <legend className="t-ui px-1">For the visa itinerary</legend>
          <p className="t-body-sm text-ink-600 mt-0">Do not enter passport numbers or booking reference numbers. Only arrangements you mark as booked are shown as “Confirmed”; everything else is shown as “Proposed”.</p>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Field id="arrivalDate" label="Planned arrival date" error={f.arrivalDate} required>
              <input {...describedBy("arrivalDate", null, f.arrivalDate)} name="arrivalDate" type="date" defaultValue={val(state, "arrivalDate", initial.arrivalDate ?? "")} className={inputClass} />
            </Field>
            <Field id="departureDate" label="Planned departure date" error={f.departureDate} required>
              <input {...describedBy("departureDate", null, f.departureDate)} name="departureDate" type="date" defaultValue={val(state, "departureDate", initial.departureDate ?? "")} className={inputClass} />
            </Field>
          </div>
          <Field id="travellerName" label="Traveller’s name on the document" hint="Optional. Only shown on your document; never sent to the AI or shared." optional>
            <input {...describedBy("travellerName", true)} name="travellerName" maxLength={120} autoComplete="name" defaultValue={val(state, "travellerName", initial.travellerName)} className={inputClass} />
          </Field>
          <Field id="visitPurpose" label="Purpose of the visit" hint="For example: Tourism, or Visiting my sister in Paris." optional>
            <input {...describedBy("visitPurpose", true)} name="visitPurpose" maxLength={120} defaultValue={val(state, "visitPurpose", initial.visitPurpose)} className={inputClass} />
          </Field>
          <Field id="cities" label="Cities you plan to visit" optional>
            <input {...describedBy("cities")} name="cities" maxLength={300} defaultValue={val(state, "cities", initial.cities)} className={inputClass} />
          </Field>
          <Field id="accommodation" label="Accommodation, if known" hint="Name and city of where you will stay, and whether it is booked. No booking numbers." optional>
            <textarea {...describedBy("accommodation", true)} name="accommodation" rows={2} maxLength={1500} defaultValue={val(state, "accommodation", initial.accommodation)} className={inputClass} />
          </Field>
          <Field id="transport" label="Flights or other travel, if known" hint="For example: Flight Sydney to Paris on 2 May, booked. No booking numbers." optional>
            <textarea {...describedBy("transport", true)} name="transport" rows={2} maxLength={1500} defaultValue={val(state, "transport", initial.transport)} className={inputClass} />
          </Field>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Field id="funding" label="Who pays for the trip" optional>
              <select {...describedBy("funding")} name="funding" defaultValue={val(state, "funding", initial.funding ?? "")} className={inputClass}>
                <option value="">Not stated</option>
                {funding.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </Field>
            <Field id="fundingNote" label="Note about funding" optional>
              <input {...describedBy("fundingNote")} name="fundingNote" maxLength={200} defaultValue={val(state, "fundingNote", initial.fundingNote)} className={inputClass} />
            </Field>
          </div>
        </fieldset>
      )}
      <div className="mt-6"><SubmitButton>Save trip details</SubmitButton></div>
    </form>
  );
}

export function ShareForm({ id, enabled, url }: { id: string; enabled: boolean; url: string | null }) {
  const [state, action] = useActionState(setSharingAction, initialState);
  return (
    <form action={action} className="max-w-measure">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <FormMessage state={state} successTitle="Done" />
      {enabled && url && (
        <p className="t-body-sm mt-0 break-all">Anyone with this link can read your plan (without your personal details): <a href={url} className="text-marine-600 underline">{url}</a></p>
      )}
      <SubmitButton variant="secondary" pendingText="Saving…">{enabled ? "Turn off sharing" : "Create a share link"}</SubmitButton>
    </form>
  );
}
