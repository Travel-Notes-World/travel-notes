"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { savePlanAction } from "@/lib/community/actions/plans";
import { LIMITS } from "@/lib/community/constants";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";
import { FormMessage, SubmitButton } from "./client";
import { describedBy, Field, FieldError, inputClass } from "./ui";

export type EditorStop = { title: string; place: string; notes: string; savedContribution: string | null; saved: { title: string; path: string } | null };
export type EditorDay = { title: string; date: string | null; stops: EditorStop[] };

type Stop = EditorStop & { key: number };
type Day = { key: number; title: string; date: string; stops: Stop[] };


const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

const small = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-line-500 bg-paper-000 t-ui text-ink-900 hover:border-ink-900 disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * The private plan editor. Days and stops are reordered with buttons (no drag and drop), each
 * change is announced to screen readers, and nothing is stored until "Save plan" is pressed.
 */
export function PlanEditor({ id, title, startDate, endDate, notes, days: initialDays }: { id: string; title: string; startDate: string | null; endDate: string | null; notes: string; days: EditorDay[] }) {
  const [dirty, setDirty] = useState(false);
  // A successful save clears the "unsaved changes" warning.
  const [state, action] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await savePlanAction(previous, form);
    if (result.ok) setDirty(false);
    return result;
  }, initialState);
  // Keys are numbered in order from the stored plan, so the server and the browser render the same ids.
  const [days, setDays] = useState<Day[]>(() => {
    let n = 0;
    return initialDays.map((d) => ({ key: ++n, title: d.title, date: d.date ?? "", stops: d.stops.map((s) => ({ ...s, key: ++n })) }));
  });
  const counter = useRef(100_000);
  const key = () => ++counter.current;
  const [announce, setAnnounce] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const f = state.fields ?? {};
  const v = (name: string, fallback: string) => (typeof state.values?.[name] === "string" ? (state.values[name] as string) : fallback);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (next: Day[], message?: string) => {
    setDays(next);
    setDirty(true);
    if (message) setAnnounce(message);
  };
  const setDay = (d: number, patch: Partial<Day>) => update(days.map((day, i) => (i === d ? { ...day, ...patch } : day)));
  const setStop = (d: number, s: number, patch: Partial<Stop>) => setDay(d, { stops: days[d].stops.map((stop, j) => (j === s ? { ...stop, ...patch } : stop)) });
  const dayName = (d: number) => `day ${d + 1}${days[d]?.title ? ` (${days[d].title})` : ""}`;
  const stopName = (stop: Stop) => stop.title || "unnamed stop";

  const addDay = () => update([...days, { key: key(), title: "", date: "", stops: [{ key: key(), title: "", place: "", notes: "", savedContribution: null, saved: null }] }], `Day ${days.length + 1} added at the end.`);
  const addStop = (d: number) => setDayWithMessage(d, { stops: [...days[d].stops, { key: key(), title: "", place: "", notes: "", savedContribution: null, saved: null }] }, `Stop added at the end of ${dayName(d)}.`);
  function setDayWithMessage(d: number, patch: Partial<Day>, message: string) {
    update(days.map((day, i) => (i === d ? { ...day, ...patch } : day)), message);
  }
  const moveStopAcross = (d: number, s: number, to: number) => {
    if (to < 0 || to >= days.length) return;
    if (days[to].stops.length >= LIMITS.maxStopsPerDay) { setAnnounce(`Day ${to + 1} is full.`); return; }
    const stop = days[d].stops[s];
    update(days.map((day, i) => (i === d ? { ...day, stops: day.stops.filter((_, j) => j !== s) } : i === to ? { ...day, stops: [...day.stops, stop] } : day)), `${stopName(stop)} moved to the end of day ${to + 1}.`);
  };

  return (
    <form ref={formRef} action={action} noValidate onInput={() => setDirty(true)} className="max-w-[860px]">
      <FormMessage state={state} successTitle="Saved" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="daysJson" value={JSON.stringify(days.map((d) => ({ title: d.title, date: d.date || null, stops: d.stops.map((s) => ({ title: s.title, place: s.place, notes: s.notes, savedContribution: s.savedContribution })) })))} />

      <Field id="title" label="Name of the plan" error={f.title} required>
        <input {...describedBy("title", null, f.title)} name="title" maxLength={140} required defaultValue={v("title", title)} className={inputClass} />
      </Field>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field id="startDate" label="Start date" error={f.startDate} optional>
          <input {...describedBy("startDate", null, f.startDate)} name="startDate" type="date" defaultValue={v("startDate", startDate ?? "")} className={inputClass} />
        </Field>
        <Field id="endDate" label="End date" error={f.endDate} optional>
          <input {...describedBy("endDate", null, f.endDate)} name="endDate" type="date" defaultValue={v("endDate", endDate ?? "")} className={inputClass} />
        </Field>
      </div>
      <Field id="notes" label="Notes for the whole trip" hint="Only you can see this plan. Bookings, packing, ideas." error={f.notes} optional>
        <textarea {...describedBy("notes", true, f.notes)} name="notes" rows={4} maxLength={5000} defaultValue={v("notes", notes)} className={inputClass} />
      </Field>

      <h2 className="t-heading-2 mt-10 mb-2">Days</h2>
      <p className="t-body-sm text-ink-600 mt-0 max-w-measure">Use the buttons to change the order. A stop without a name is not saved. Up to {LIMITS.maxPlanDays} days and {LIMITS.maxStopsPerDay} stops a day.</p>
      <FieldError id="days-error" message={f.days} />
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {days.length === 0 && <p className="t-body-sm text-ink-600">No days yet. Add the first day to start planning.</p>}
      <ol className="list-none m-0 p-0 grid gap-6 mt-4">
        {days.map((day, d) => {
          const dayId = `day-${day.key}`;
          return (
            <li key={day.key} className="border border-paper-200 rounded-md p-4 bg-paper-000">
              <fieldset className="border-0 p-0 m-0 min-w-0">
                <legend className="t-heading-3 p-0">Day {d + 1}</legend>
                <div className="grid gap-x-6 sm:grid-cols-[2fr_1fr]">
                  <Field id={`${dayId}-title`} label="Day title" optional>
                    <input id={`${dayId}-title`} value={day.title} maxLength={140} onChange={(e) => setDay(d, { title: e.target.value })} placeholder="For example: Old town and markets" className={inputClass} />
                  </Field>
                  <Field id={`${dayId}-date`} label="Date" error={f[`days.${d}`]} optional>
                    <input {...describedBy(`${dayId}-date`, null, f[`days.${d}`])} type="date" value={day.date} onChange={(e) => setDay(d, { date: e.target.value })} className={inputClass} />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Arrange day ${d + 1}`}>
                  <button type="button" className={small} disabled={d === 0} onClick={() => update(move(days, d, d - 1), `Day ${d + 1} moved up. It is now day ${d}.`)}>↑ Move day up<span className="sr-only"> (day {d + 1})</span></button>
                  <button type="button" className={small} disabled={d === days.length - 1} onClick={() => update(move(days, d, d + 1), `Day ${d + 1} moved down. It is now day ${d + 2}.`)}>↓ Move day down<span className="sr-only"> (day {d + 1})</span></button>
                  <button type="button" className={small} onClick={() => update(days.filter((_, i) => i !== d), `Day ${d + 1} removed. Press Save plan to keep this change.`)}>Remove day<span className="sr-only"> {d + 1}</span></button>
                </div>

                <ol className="list-none m-0 p-0 mt-4 grid gap-4">
                  {day.stops.map((stop, s) => {
                    const stopId = `stop-${stop.key}`;
                    return (
                      <li key={stop.key} className="border-t border-paper-200 pt-4">
                        <fieldset className="border-0 p-0 m-0 min-w-0">
                          <legend className="t-ui p-0">Stop {s + 1} of day {d + 1}</legend>
                          {stop.saved && (
                            <p className="t-body-sm m-0 mt-1">From the community: <Link href={stop.saved.path} className="text-marine-600">{stop.saved.title}</Link></p>
                          )}
                          {!stop.saved && stop.savedContribution && <p className="t-body-sm text-ink-600 m-0 mt-1">The post this came from is no longer public.</p>}
                          <div className="grid gap-x-6 sm:grid-cols-2">
                            <Field id={`${stopId}-title`} label="What" required>
                              <input id={`${stopId}-title`} value={stop.title} maxLength={140} required onChange={(e) => setStop(d, s, { title: e.target.value })} placeholder="For example: Fushimi Inari shrine" className={inputClass} />
                            </Field>
                            <Field id={`${stopId}-place`} label="Where" optional>
                              <input id={`${stopId}-place`} value={stop.place} maxLength={200} onChange={(e) => setStop(d, s, { place: e.target.value })} className={inputClass} />
                            </Field>
                          </div>
                          <Field id={`${stopId}-notes`} label="Notes" optional>
                            <textarea id={`${stopId}-notes`} value={stop.notes} rows={2} maxLength={2000} onChange={(e) => setStop(d, s, { notes: e.target.value })} className={inputClass} />
                          </Field>
                          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Arrange ${stopName(stop)}`}>
                            <button type="button" className={small} disabled={s === 0} onClick={() => setDayWithMessage(d, { stops: move(day.stops, s, s - 1) }, `${stopName(stop)} moved up to position ${s} of day ${d + 1}.`)}>↑ Up<span className="sr-only">: move {stopName(stop)} up</span></button>
                            <button type="button" className={small} disabled={s === day.stops.length - 1} onClick={() => setDayWithMessage(d, { stops: move(day.stops, s, s + 1) }, `${stopName(stop)} moved down to position ${s + 2} of day ${d + 1}.`)}>↓ Down<span className="sr-only">: move {stopName(stop)} down</span></button>
                            {d > 0 && <button type="button" className={small} onClick={() => moveStopAcross(d, s, d - 1)}>To day {d}<span className="sr-only">: move {stopName(stop)}</span></button>}
                            {d < days.length - 1 && <button type="button" className={small} onClick={() => moveStopAcross(d, s, d + 1)}>To day {d + 2}<span className="sr-only">: move {stopName(stop)}</span></button>}
                            <button type="button" className={small} onClick={() => setDayWithMessage(d, { stops: day.stops.filter((_, j) => j !== s) }, `${stopName(stop)} removed from day ${d + 1}. Press Save plan to keep this change.`)}>Remove<span className="sr-only"> {stopName(stop)}</span></button>
                          </div>
                        </fieldset>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-4">
                  <button type="button" className={small} disabled={day.stops.length >= LIMITS.maxStopsPerDay} onClick={() => addStop(d)}>+ Add a stop<span className="sr-only"> to day {d + 1}</span></button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-4">
        <button type="button" className={small} disabled={days.length >= LIMITS.maxPlanDays} onClick={addDay}>+ Add a day</button>
      </div>

      <div className="mt-8 border-t border-paper-200 pt-6 flex flex-wrap items-center gap-4 sticky bottom-0 bg-paper-000 pb-4">
        <SubmitButton pendingText="Saving…">Save plan</SubmitButton>
        <p className="t-body-sm text-ink-600 m-0" aria-live="polite">{dirty ? "You have changes that are not saved yet." : "No unsaved changes."}</p>
      </div>
    </form>
  );
}
