"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { DestinationPicker, FormMessage, SubmitButton, type PickedPlace } from "@/components/community/client";
import { describedBy, Field, inputClass } from "@/components/community/ui";
import { initialState } from "@/lib/community/next/state";
import { savePlannerAction } from "@/lib/planner/actions";
import { MONTH_NAMES, MONTHS, type Month } from "@/lib/content/destinationFacts";
import { PACES, PARTIES, PLANNER, PURPOSES, type Pace, type Party, type Purpose } from "@/lib/planner/input";

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

const STEP_TITLES = ["Why are you going?", "Where are you going?", "When are you going?", "Who is going?", "Check and plan"] as const;
const bigCard = "flex items-start gap-3 rounded-md border-2 border-line-500 p-4 cursor-pointer hover:border-marine-600 has-[:checked]:border-marine-600 has-[:checked]:bg-marine-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2";
const chip = "inline-flex items-center gap-2 min-h-11 px-4 rounded-full border-2 border-line-500 cursor-pointer t-ui has-[:checked]:border-marine-600 has-[:checked]:bg-marine-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2";
const nextClass = "inline-flex items-center justify-center min-h-12 px-6 rounded-md bg-marine-600 text-on-marine t-ui hover:bg-marine-700 disabled:opacity-50 disabled:cursor-not-allowed";
const backClass = "inline-flex items-center justify-center min-h-12 px-5 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui hover:border-ink-900";

/**
 * The planner as a short guide: one question per screen, a progress bar, and Back / Next. Every
 * answer still goes into one plain GET form, so the result is the same shareable address. Without
 * JavaScript all the questions show on one page and the form still works.
 */
export function PlannerWizard({ purpose: initialPurpose = "holiday", places: initialPlaces, start, month, days: initialDays, party, pace, startStep = 0, error }: {
  purpose?: Purpose; places: PickedPlace[]; start: string | null; month: Month | null; days: number; party: Party | null; pace: Pace; startStep?: number; error?: string;
}) {
  const [enhanced, setEnhanced] = useState(false);
  const [step, setStep] = useState(startStep);
  const [purpose, setPurpose] = useState<Purpose>(initialPurpose);
  const [places, setPlaces] = useState<PickedPlace[]>(initialPlaces);
  const [when, setWhen] = useState<"dates" | "month" | "unsure">(start ? "dates" : month ? "month" : "dates");
  const [startDate, setStartDate] = useState(start ?? "");
  const [monthValue, setMonthValue] = useState<string>(month ?? "");
  const [days, setDays] = useState(initialDays);
  const [who, setWho] = useState<string>(party ?? "");
  const [paceValue, setPaceValue] = useState<Pace>(pace);
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  const onPlaces = useCallback((p: PickedPlace[]) => setPlaces(p), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the step-by-step view needs JavaScript; without it every question shows
    setEnhanced(true);
  }, []);
  const go = (to: number) => {
    setStep(to);
    // Move focus to the new question so screen reader and keyboard users know where they are.
    requestAnimationFrame(() => headings.current[to]?.focus());
  };
  const show = (i: number) => !enhanced || step === i;
  const canNext = step !== 1 || places.length > 0;
  const purposeLabel = PURPOSES.find((p) => p.value === purpose)?.label ?? "";
  const whenLabel = when === "dates" && startDate ? new Date(`${startDate}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : when === "month" && monthValue ? MONTH_NAMES[monthValue as Month] : "No dates yet";

  const heading = (i: number) => (
    <h2 ref={(el) => { headings.current[i] = el; }} tabIndex={-1} className="t-heading-2 m-0 outline-none">{STEP_TITLES[i]}</h2>
  );

  return (
    <form method="get" action="/trip-planner" className="max-w-[640px]">
      <input type="hidden" name="go" value="1" />
      {enhanced && (
        <div className="mb-6">
          <p className="t-meta text-ink-600 m-0" aria-live="polite">Step {step + 1} of {STEP_TITLES.length}</p>
          <div className="mt-2 h-2 rounded-full bg-paper-200 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-marine-600 transition-[width] duration-300" style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="t-body-sm text-signal-error mt-0">{error}</p>}

      <section hidden={!show(0)} aria-label={STEP_TITLES[0]}>
        {heading(0)}
        <p className="t-body-sm text-ink-600 mt-1">This changes the questions and the plan you get.</p>
        <div className="grid gap-3 mt-4">
          {PURPOSES.map((p) => (
            <label key={p.value} className={bigCard}>
              <input type="radio" name="for" value={p.value} checked={purpose === p.value} onChange={() => setPurpose(p.value)} onClick={() => { if (enhanced) go(1); }} className="mt-1 w-5 h-5 shrink-0" />
              <span><span className="t-ui block">{p.label}</span><span className="t-body-sm text-ink-600">{p.hint}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section hidden={!show(1)} aria-label={STEP_TITLES[1]} className={enhanced ? "" : "mt-10"}>
        {heading(1)}
        <DestinationPicker
          name="to"
          label="Places"
          hint={`Type a city or country, then tap it in the list. Add up to ${PLANNER.maxPlaces} places in the order you will visit them.`}
          initial={initialPlaces}
          max={PLANNER.maxPlaces}
          required
          suggestLink={false}
          onChange={onPlaces}
        />
      </section>

      <section hidden={!show(2)} aria-label={STEP_TITLES[2]} className={enhanced ? "" : "mt-10"}>
        {heading(2)}
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Do you know your dates?">
          {([["dates", "I know the dates"], ["month", "Just the month"], ["unsure", "Not sure yet"]] as const).map(([v, label]) => (
            <label key={v} className={chip}>
              <input type="radio" name="whenKind" value={v} checked={when === v} onChange={() => setWhen(v)} className="sr-only" />{label}
            </label>
          ))}
        </div>
        {when === "dates" && (
          <Field id="start" label="First day" optional>
            <input {...describedBy("start")} type="date" name="start" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </Field>
        )}
        {when === "month" && (
          <Field id="month" label="Month" optional>
            <select {...describedBy("month")} name="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} className={inputClass}>
              <option value="">Choose a month</option>
              {MONTHS.map((m) => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
            </select>
          </Field>
        )}
        <div className="mt-6">
          <p id="days-label" className="t-ui m-0">How many days?</p>
          <div className="mt-2 inline-flex items-center gap-3" role="group" aria-labelledby="days-label">
            <button type="button" className={backClass} aria-label="One day fewer" onClick={() => setDays((d) => Math.max(PLANNER.minDays, d - 1))}>−</button>
            <input aria-labelledby="days-label" type="number" name="days" inputMode="numeric" min={PLANNER.minDays} max={PLANNER.maxDays} value={days} onChange={(e) => setDays(Math.min(PLANNER.maxDays, Math.max(PLANNER.minDays, Number(e.target.value) || PLANNER.minDays)))} className="w-20 min-h-12 text-center rounded-sm border border-line-500 bg-paper-000 t-ui" />
            <button type="button" className={backClass} aria-label="One day more" onClick={() => setDays((d) => Math.min(PLANNER.maxDays, d + 1))}>+</button>
          </div>
        </div>
      </section>

      <section hidden={!show(3)} aria-label={STEP_TITLES[3]} className={enhanced ? "" : "mt-10"}>
        {heading(3)}
        <p className="t-body-sm text-ink-600 mt-1">Optional. You can skip this.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Who is travelling">
          {PARTIES.map((p) => (
            <label key={p.value} className={chip}>
              <input type="radio" name="with" value={p.value} checked={who === p.value} onChange={() => setWho(p.value)} className="sr-only" />{p.label}
            </label>
          ))}
        </div>
        <p className="t-ui mt-6 mb-0">Pace</p>
        <div className="mt-2 grid gap-3">
          {PACES.map((p) => (
            <label key={p.value} className={bigCard}>
              <input type="radio" name="pace" value={p.value} checked={paceValue === p.value} onChange={() => setPaceValue(p.value)} className="mt-1 w-5 h-5 shrink-0" />
              <span><span className="t-ui block">{p.label}</span><span className="t-body-sm text-ink-600">{p.hint}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section hidden={!show(4)} aria-label={STEP_TITLES[4]} className={enhanced ? "" : "mt-10"}>
        {heading(4)}
        {enhanced && (
          <dl className="mt-4 border-t border-paper-200 t-body-sm">
            {[
              ["Trip", purposeLabel, 0],
              ["Places", places.map((p) => p.label).join(" → ") || "None chosen", 1],
              ["When", `${whenLabel} · ${days} ${days === 1 ? "day" : "days"}`, 2],
              ["Who and pace", `${PARTIES.find((p) => p.value === who)?.label ?? "Not said"} · ${PACES.find((p) => p.value === paceValue)?.label}`, 3],
            ].map(([label, value, i]) => (
              <div key={label as string} className="flex items-start justify-between gap-4 py-3 border-b border-paper-200">
                <div><dt className="text-ink-600">{label}</dt><dd className="m-0 t-ui">{value}</dd></div>
                <button type="button" onClick={() => go(i as number)} className="t-ui text-marine-600 underline min-h-11 shrink-0">Change<span className="sr-only"> {label}</span></button>
              </div>
            ))}
          </dl>
        )}
        <p className="t-body-sm text-ink-600 mt-4">Free. You can change anything on the next page.</p>
        <div className="mt-4"><SubmitButton pendingText="Planning…" className={nextClass}>Plan my trip</SubmitButton></div>
      </section>

      {enhanced && step < 4 && (
        <div className="mt-8 flex items-center gap-3">
          {step > 0 && <button type="button" className={backClass} onClick={() => go(step - 1)}>Back</button>}
          <button type="button" className={nextClass} disabled={!canNext} onClick={() => go(step + 1)}>{step === 3 && !who ? "Skip" : "Next"}</button>
          {step === 1 && !canNext && <p className="t-body-sm text-ink-600 m-0">Add at least one place.</p>}
        </div>
      )}
      {enhanced && step === 4 && <div className="mt-4"><button type="button" className={backClass} onClick={() => go(3)}>Back</button></div>}
    </form>
  );
}
