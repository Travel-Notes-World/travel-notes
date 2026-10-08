"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { findDestinationsAction, type DestinationOption } from "@/lib/community/actions/lookup";
import { COST_BASES, COST_CATEGORIES, COST_KINDS, COST_SCOPES, LIMITS, PARTY_TYPES } from "@/lib/community/constants";
import { formatMoney, isCurrency, parseAmount, totalsByCurrency, type CostLine } from "@/lib/community/money";
import type { ActionState } from "@/lib/community/next/forms";
import { ContributionForm, CurrencyInput, type FieldsProps, type FormInitial } from "./contribution-form";
import { PhotoUpload } from "./photo-upload";
import { describedBy, Field, FieldError, inputClass, secondaryButtonClass } from "./ui";

type WrapperProps = { id: string | null; initial: FormInitial; published?: boolean; topics?: { id: string; name: string }[]; intro?: ReactNode };

/** The form for writing or editing a trip report. */
export function TripForm(props: WrapperProps) {
  return (
    <ContributionForm type="trip" {...props} submitLabel="Submit trip report for review">
      {(p) => <TripFields {...p} contributionId={props.id} published={Boolean(props.published)} />}
    </ContributionForm>
  );
}

/* ------------------------------------------------------------------ helpers */

type Raw = Record<string, unknown>;
const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const parseList = (json: string): Raw[] => {
  try {
    const list = JSON.parse(json || "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
};

/**
 * Tell the surrounding form that a list changed, so its automatic draft save and the copy kept in
 * this browser both run. Buttons (add, remove, move) do not fire "input" events by themselves.
 */
function useNotifyForm(ref: React.RefObject<HTMLInputElement | null>, value: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    ref.current?.form?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [ref, value]);
}

/**
 * After a form action, React resets the form. Text boxes keep their values, but drop-down lists
 * and tick boxes in the list editors would jump back to their first option, so they are put back
 * to the values the editor holds. Each one carries its value in a data attribute for this.
 */
function useRestoreAfterReset(root: React.RefObject<HTMLElement | null>, state: ActionState) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll<HTMLSelectElement>("select[data-v]").forEach((s) => { s.value = s.dataset.v ?? ""; });
  }, [root, state]);
}

/** Move keyboard focus to an element after React has drawn the change. */
function useFocusAfterRender() {
  const target = useRef<string | null>(null);
  useEffect(() => {
    if (!target.current) return;
    const el = document.getElementById(target.current);
    target.current = null;
    el?.focus();
  });
  return (id: string) => { target.current = id; };
}

function swap<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  [copy[from], copy[to]] = [copy[to], copy[from]];
  return copy;
}

const smallButton = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-body-sm hover:border-ink-900 disabled:opacity-50 disabled:cursor-not-allowed";

/* ------------------------------------------------------------------ fields */

function TripFields({ value, checked, errors, state, contributionId, published }: FieldsProps & { contributionId: string | null; published: boolean }) {
  return (
    <>
      <fieldset className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
        <legend className="t-ui px-1">When and who</legend>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Field id="travelMonth" label="Month you travelled" hint="Required unless you give the exact dates below." error={errors.travelMonth}>
            <input {...describedBy("travelMonth", true, errors.travelMonth)} name="travelMonth" type="month" defaultValue={value("travelMonth")} className={inputClass} />
          </Field>
          <Field id="durationDays" label="How many days" required hint="Worked out for you when you give both exact dates." error={errors.durationDays}>
            <input {...describedBy("durationDays", true, errors.durationDays)} name="durationDays" type="number" inputMode="numeric" min={1} max={730} defaultValue={value("durationDays")} className={inputClass} />
          </Field>
          <Field id="startDate" label="First day" optional error={errors.startDate}>
            <input {...describedBy("startDate", null, errors.startDate)} name="startDate" type="date" defaultValue={value("startDate")} className={inputClass} />
          </Field>
          <Field id="endDate" label="Last day" optional error={errors.endDate}>
            <input {...describedBy("endDate", null, errors.endDate)} name="endDate" type="date" defaultValue={value("endDate")} className={inputClass} />
          </Field>
          <Field id="partySize" label="How many people travelled" required error={errors.partySize}>
            <input {...describedBy("partySize", null, errors.partySize)} name="partySize" type="number" inputMode="numeric" min={1} max={100} defaultValue={value("partySize")} className={inputClass} />
          </Field>
          <Field id="partyType" label="Who travelled" optional error={errors.partyType}>
            <select {...describedBy("partyType", null, errors.partyType)} name="partyType" defaultValue={value("partyType")} className={inputClass}>
              <option value="">Not specified</option>
              {PARTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
        <legend className="t-ui px-1">Costs <span className="text-ink-600 font-normal">(optional)</span></legend>
        <p className="t-body-sm text-ink-600 mt-0">Real figures help other travellers most. Use the currency you paid in; amounts are never converted. You do not need receipts or booking documents, and please do not share booking references.</p>
        <fieldset className="mt-4 border-0 p-0 m-0 min-w-0">
          <legend className="t-ui p-0">Are these costs per person or for the whole party?</legend>
          <div className="mt-2 flex flex-wrap gap-x-6">
            {COST_SCOPES.map((s) => (
              <label key={s.value} className="inline-flex items-center gap-2 t-body-sm min-h-11">
                <input type="radio" name="costScope" value={s.value} defaultChecked={value("costScope") === s.value} aria-describedby={errors.costScope ? "costScope-error" : undefined} className="w-4 h-4" /> {s.label}
              </label>
            ))}
          </div>
          <FieldError id="costScope-error" message={errors.costScope} />
        </fieldset>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Field id="nights" label="Number of nights" optional error={errors.nights}>
            <input {...describedBy("nights", null, errors.nights)} name="nights" type="number" inputMode="numeric" min={0} max={730} defaultValue={value("nights")} className={inputClass} />
          </Field>
          <div className="mt-5 md:mt-12">
            <label className="inline-flex items-center gap-2 t-body-sm min-h-11">
              <input type="checkbox" name="flightsIncluded" defaultChecked={checked("flightsIncluded")} className="w-4 h-4" /> Flights are included in these costs
            </label>
          </div>
        </div>
        <CostEditor json={value("costsJson")} errors={errors} state={state} />
        <Field id="costNotes" label="What was included or left out" optional hint="For example: “Hotel price includes breakfast. Travel insurance not included.”" error={errors.costNotes}>
          <textarea {...describedBy("costNotes", true, errors.costNotes)} name="costNotes" rows={3} maxLength={LIMITS.longTextMax} defaultValue={value("costNotes")} className={inputClass} />
        </Field>
      </fieldset>

      <ItineraryEditor json={value("daysJson")} errors={errors} state={state} />

      <fieldset className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
        <legend className="t-ui px-1">Tips for other travellers <span className="text-ink-600 font-normal">(optional)</span></legend>
        <Field id="transport" label="Getting around" hint="How you travelled between places, and what worked." error={errors.transport}>
          <textarea {...describedBy("transport", true, errors.transport)} name="transport" rows={3} maxLength={LIMITS.longTextMax} defaultValue={value("transport")} className={inputClass} />
        </Field>
        <Field id="recommendations" label="What you would recommend" error={errors.recommendations}>
          <textarea {...describedBy("recommendations", null, errors.recommendations)} name="recommendations" rows={3} maxLength={LIMITS.longTextMax} defaultValue={value("recommendations")} className={inputClass} />
        </Field>
        <Field id="mistakes" label="What you would do differently" error={errors.mistakes}>
          <textarea {...describedBy("mistakes", null, errors.mistakes)} name="mistakes" rows={3} maxLength={LIMITS.longTextMax} defaultValue={value("mistakes")} className={inputClass} />
        </Field>
      </fieldset>

      <PhotoUpload contributionId={contributionId} initialJson={value("photosJson")} error={errors.photos} published={published} />

      <div className="mt-6 border-l-4 border-ochre-500 bg-ochre-100 rounded-sm p-4">
        <label className="flex items-start gap-3 t-body-sm min-h-11">
          <input type="checkbox" name="permission" defaultChecked={checked("permission")} aria-invalid={errors.permission ? true : undefined} aria-describedby={errors.permission ? "permission-error" : undefined} className="w-5 h-5 mt-0.5 shrink-0" />
          <span><strong className="t-ui">This is my own first-hand account</strong> <span className="text-ink-600">(required)</span><br />I made this trip myself, the costs and details are as I remember or recorded them, and Travel Notes may publish this report after review.</span>
        </label>
        <FieldError id="permission-error" message={errors.permission} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ costs */

type CostRow = { key: number; category: string; note: string; amount: string; currency: string; basis: string; quantity: string; kind: string; date: string };

function toCostRow(r: Raw, key: number): CostRow {
  return {
    key,
    category: text(r.category),
    note: text(r.note),
    amount: text(r.amount),
    currency: text(r.currency).toUpperCase(),
    basis: text(r.basis) || "total",
    quantity: text(r.quantity) || "1",
    kind: text(r.kind) || "measured",
    date: text(r.date),
  };
}

/** A cost line as a number, or null while it is incomplete. Same rules as the server. */
function costLine(row: CostRow): CostLine | null {
  const currency = row.currency.trim().toUpperCase();
  if (!isCurrency(currency)) return null;
  const amountMinor = parseAmount(row.amount.trim(), currency);
  const quantity = Number(row.quantity || 1);
  if (amountMinor === null || !Number.isInteger(quantity) || quantity < 1) return null;
  return { amountMinor, currency, quantity };
}

export function CostEditor({ json, errors, state }: { json: string; errors: Record<string, string>; state: ActionState }) {
  const uid = useId();
  const [rows, setRows] = useState<CostRow[]>(() => parseList(json).map((r, i) => toCostRow(r, i)));
  const next = useRef(rows.length);
  const [announce, setAnnounce] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const focus = useFocusAfterRender();
  const serialised = JSON.stringify(rows.map(({ category, note, amount, currency, basis, quantity, kind, date }) => ({ category, note, amount, currency: currency.trim().toUpperCase(), basis, quantity, kind, date })));
  useNotifyForm(hidden, serialised);
  useRestoreAfterReset(root, state);

  const update = (key: number, patch: Partial<CostRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => {
    const key = next.current++;
    const currency = rows.length ? rows[rows.length - 1].currency : "";
    setRows([...rows, toCostRow({ currency }, key)]);
    setAnnounce(`Cost ${rows.length + 1} added.`);
    focus(`${uid}-cost-${key}-category`);
  };
  const remove = (index: number) => {
    const list = rows.filter((_, i) => i !== index);
    setRows(list);
    setAnnounce(`Cost ${index + 1} removed.`);
    focus(list.length ? `${uid}-cost-${list[Math.max(0, index - 1)].key}-category` : `${uid}-add-cost`);
  };

  const counted = rows.map(costLine);
  const totals = totalsByCurrency(counted.filter((l): l is CostLine => Boolean(l)));
  const incomplete = rows.filter((r, i) => !counted[i] && (r.amount.trim() || r.category)).length;
  const hasEstimate = rows.some((r, i) => counted[i] && r.kind === "estimate");

  return (
    <div ref={root} className="mt-6">
      <input ref={hidden} type="hidden" name="costsJson" value={serialised} />
      <h3 className="t-heading-3 m-0">Cost lines</h3>
      <FieldError id={`${uid}-costs-error`} message={errors.costs} />
      {rows.length === 0 && <p className="t-body-sm text-ink-600 mt-2">No costs added yet.</p>}
      <ol className="list-none m-0 p-0 mt-3 grid gap-4">
        {rows.map((row, i) => {
          const p = `${uid}-cost-${row.key}`;
          const error = errors[`costs.${i}`];
          const errorId = error ? `${p}-error` : undefined;
          return (
            <li key={row.key}>
              <fieldset className="border border-paper-200 rounded-sm p-3 m-0 min-w-0 bg-paper-000" aria-describedby={errorId}>
                <legend className="t-ui px-1">Cost {i + 1}</legend>
                <FieldError id={`${p}-error`} message={error} />
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <div className="mt-3">
                    <label htmlFor={`${p}-category`} className="block t-body-sm font-medium">What for</label>
                    <select id={`${p}-category`} data-v={row.category} value={row.category} onChange={(e) => update(row.key, { category: e.target.value })} aria-invalid={error ? true : undefined} aria-describedby={errorId} className={`${inputClass} mt-1`}>
                      <option value="">Choose…</option>
                      {COST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="mt-3">
                    <label htmlFor={`${p}-note`} className="block t-body-sm font-medium">Description <span className="text-ink-600 font-normal">(optional)</span></label>
                    <input id={`${p}-note`} value={row.note} onChange={(e) => update(row.key, { note: e.target.value })} maxLength={200} placeholder="For example: guesthouse, 3 nights" className={`${inputClass} mt-1`} />
                  </div>
                  <div className="mt-3">
                    <label htmlFor={`${p}-amount`} className="block t-body-sm font-medium">Amount</label>
                    <input id={`${p}-amount`} value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} inputMode="decimal" placeholder="120.50" aria-invalid={error ? true : undefined} aria-describedby={errorId} className={`${inputClass} mt-1`} />
                  </div>
                  <div className="mt-3" onChange={(e) => { const t = e.target as HTMLInputElement; if (t.id === `${p}-currency`) update(row.key, { currency: t.value.toUpperCase() }); }}>
                    <label htmlFor={`${p}-currency`} className="block t-body-sm font-medium">Currency</label>
                    <div className="mt-1"><CurrencyInput id={`${p}-currency`} name="" value={row.currency} error={error && !isCurrency(row.currency) ? error : undefined} label={`Currency for cost ${i + 1}`} /></div>
                  </div>
                  <div className="mt-3">
                    <label htmlFor={`${p}-basis`} className="block t-body-sm font-medium">This amount is</label>
                    <select id={`${p}-basis`} data-v={row.basis} value={row.basis} onChange={(e) => update(row.key, { basis: e.target.value })} className={`${inputClass} mt-1`}>
                      {COST_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </div>
                  <div className="mt-3">
                    <label htmlFor={`${p}-quantity`} className="block t-body-sm font-medium">Times</label>
                    <input id={`${p}-quantity`} type="number" inputMode="numeric" min={1} max={1000} value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} aria-describedby={`${p}-quantity-hint`} className={`${inputClass} mt-1`} />
                    <p id={`${p}-quantity-hint`} className="t-meta text-ink-400 normal-case tracking-normal mt-1 mb-0">For a per-day or per-night amount, the number of days or nights.</p>
                  </div>
                  <div className="mt-3 sm:col-span-2">
                    <label htmlFor={`${p}-kind`} className="block t-body-sm font-medium">Actual or estimate</label>
                    <select id={`${p}-kind`} data-v={row.kind} value={row.kind} onChange={(e) => update(row.key, { kind: e.target.value })} className={`${inputClass} mt-1`}>
                      {COST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <button type="button" onClick={() => remove(i)} className={smallButton}>Remove cost {i + 1}</button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      {rows.length < LIMITS.maxCostLines ? (
        <button id={`${uid}-add-cost`} type="button" onClick={add} className={`${secondaryButtonClass} mt-4`}>Add a cost</button>
      ) : (
        <p className="t-body-sm text-ink-600 mt-4">You have added the most cost lines a report can have ({LIMITS.maxCostLines}).</p>
      )}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {(totals.length > 0 || incomplete > 0) && (
        <div className="mt-4 bg-paper-100 rounded-sm p-3">
          <p className="t-ui m-0">Running total</p>
          {totals.length > 0 && (
            <ul className="list-none m-0 p-0 mt-1 t-body-sm">
              {totals.map((t) => <li key={t.currency}>{formatMoney(t.totalMinor, t.currency)}</li>)}
            </ul>
          )}
          <p className="t-body-sm text-ink-600 m-0 mt-1">
            {totals.length > 1 ? "Each currency is totalled separately; nothing is converted. " : ""}
            {hasEstimate ? "Includes estimates. " : ""}
            {incomplete > 0 ? (incomplete === 1 ? "1 cost is not counted yet because its amount or currency is incomplete." : `${incomplete} costs are not counted yet because their amount or currency is incomplete.`) : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ itinerary */

type Stop = { key: number; title: string; destination: string | null; destinationLabel: string; place: string; timeNote: string; cost: string; costCurrency: string; description: string };
type Day = { key: number; title: string; date: string; stops: Stop[] };

const toStop = (r: Raw, key: number): Stop => ({
  key,
  title: text(r.title),
  destination: typeof r.destination === "string" && r.destination ? r.destination : null,
  destinationLabel: text(r.destinationLabel),
  place: text(r.place),
  timeNote: text(r.timeNote),
  cost: text(r.cost),
  costCurrency: text(r.costCurrency).toUpperCase(),
  description: text(r.description),
});

const stopHasContent = (s: Stop) => Boolean(s.title.trim() || s.description.trim() || s.place.trim() || s.timeNote.trim());

export function ItineraryEditor({ json, errors, state }: { json: string; errors: Record<string, string>; state: ActionState }) {
  const uid = useId();
  const [days, setDays] = useState<Day[]>(() => {
    let key = 0;
    return parseList(json).map((d) => ({
      key: key++,
      title: text(d.title),
      date: text(d.date),
      stops: (Array.isArray(d.stops) ? (d.stops as Raw[]) : []).filter((s) => s && typeof s === "object").map((s) => toStop(s, key++)),
    }));
  });
  const next = useRef(days.reduce((n, d) => n + 1 + d.stops.length, 0));
  const [announce, setAnnounce] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFieldSetElement>(null);
  const focus = useFocusAfterRender();
  const serialised = JSON.stringify(days.map((d) => ({
    title: d.title,
    date: d.date,
    stops: d.stops.map((s) => ({ title: s.title, destination: s.destination, destinationLabel: s.destinationLabel, place: s.place, timeNote: s.timeNote, cost: s.cost, costCurrency: s.costCurrency.trim().toUpperCase(), description: s.description })),
  })));
  useNotifyForm(hidden, serialised);
  useRestoreAfterReset(root, state);

  const dayId = (d: Day, field: string) => `${uid}-day-${d.key}-${field}`;
  const stopId = (s: Stop, field: string) => `${uid}-stop-${s.key}-${field}`;
  const updateDay = (key: number, patch: Partial<Day>) => setDays((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const updateStop = (dayKey: number, stopKey: number, patch: Partial<Stop>) =>
    setDays((list) => list.map((d) => (d.key === dayKey ? { ...d, stops: d.stops.map((s) => (s.key === stopKey ? { ...s, ...patch } : s)) } : d)));

  const addDay = () => {
    const day: Day = { key: next.current++, title: "", date: "", stops: [] };
    day.stops.push(toStop({}, next.current++));
    setDays([...days, day]);
    setAnnounce(`Day ${days.length + 1} added.`);
    focus(dayId(day, "title"));
  };
  const removeDay = (index: number) => {
    const day = days[index];
    if ((day.title.trim() || day.stops.some(stopHasContent)) && !window.confirm(`Remove day ${index + 1} and everything in it?`)) return;
    const list = days.filter((_, i) => i !== index);
    setDays(list);
    setAnnounce(`Day ${index + 1} removed.`);
    focus(list.length ? dayId(list[Math.max(0, index - 1)], "title") : `${uid}-add-day`);
  };
  const moveDay = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= days.length) return;
    setDays(swap(days, index, to));
    setAnnounce(`Day moved ${delta < 0 ? "up" : "down"}. It is now day ${to + 1}.`);
    // Keep focus on the button that was pressed, or its partner when that one is now disabled.
    const atEdge = (delta < 0 && to === 0) || (delta > 0 && to === days.length - 1);
    focus(dayId(days[index], atEdge ? (delta < 0 ? "down" : "up") : delta < 0 ? "up" : "down"));
  };
  const addStop = (dayIndex: number) => {
    const day = days[dayIndex];
    const stop = toStop({}, next.current++);
    updateDay(day.key, { stops: [...day.stops, stop] });
    setAnnounce(`Stop ${day.stops.length + 1} added to day ${dayIndex + 1}.`);
    focus(stopId(stop, "title"));
  };
  const removeStop = (dayIndex: number, index: number) => {
    const day = days[dayIndex];
    const stops = day.stops.filter((_, i) => i !== index);
    updateDay(day.key, { stops });
    setAnnounce(`Stop ${index + 1} removed from day ${dayIndex + 1}.`);
    focus(stops.length ? stopId(stops[Math.max(0, index - 1)], "title") : dayId(day, "add-stop"));
  };
  const moveStop = (dayIndex: number, index: number, delta: number) => {
    const day = days[dayIndex];
    const to = index + delta;
    if (to < 0 || to >= day.stops.length) return;
    updateDay(day.key, { stops: swap(day.stops, index, to) });
    setAnnounce(`Stop moved ${delta < 0 ? "up" : "down"}. It is now stop ${to + 1} of day ${dayIndex + 1}.`);
    const atEdge = (delta < 0 && to === 0) || (delta > 0 && to === day.stops.length - 1);
    focus(stopId(day.stops[index], atEdge ? (delta < 0 ? "down" : "up") : delta < 0 ? "up" : "down"));
  };

  return (
    <fieldset ref={root} className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
      <legend className="t-ui px-1">Day by day <span className="text-ink-600 font-normal">(optional)</span></legend>
      <input ref={hidden} type="hidden" name="daysJson" value={serialised} />
      <p className="t-body-sm text-ink-600 mt-0">Add the places you went, day by day. Use the Move buttons to change the order. Times you add are what happened on your trip, not a timetable.</p>
      <FieldError id={`${uid}-days-error`} message={errors.days} />
      {days.length === 0 && <p className="t-body-sm text-ink-600">No days added yet.</p>}
      <ol className="list-none m-0 p-0 mt-3 grid gap-6">
        {days.map((day, d) => {
          const dayError = errors[`days.${d}`];
          return (
            <li key={day.key} className="border border-line-500 rounded-sm p-3 bg-paper-000">
              <h3 className="t-heading-3 m-0" id={dayId(day, "heading")}>Day {d + 1}{day.title.trim() ? `: ${day.title.trim()}` : ""}</h3>
              <FieldError id={dayId(day, "error")} message={dayError} />
              <div className="grid gap-x-4 sm:grid-cols-2">
                <div className="mt-3">
                  <label htmlFor={dayId(day, "title")} className="block t-body-sm font-medium">Day title <span className="text-ink-600 font-normal">(optional)</span></label>
                  <input id={dayId(day, "title")} value={day.title} onChange={(e) => updateDay(day.key, { title: e.target.value })} maxLength={140} placeholder="For example: Old town and the river" className={`${inputClass} mt-1`} />
                </div>
                <div className="mt-3">
                  <label htmlFor={dayId(day, "date")} className="block t-body-sm font-medium">Date <span className="text-ink-600 font-normal">(optional)</span></label>
                  <input id={dayId(day, "date")} type="date" value={day.date} onChange={(e) => updateDay(day.key, { date: e.target.value })} aria-invalid={dayError ? true : undefined} aria-describedby={dayError ? dayId(day, "error") : undefined} className={`${inputClass} mt-1`} />
                </div>
              </div>

              <ol className="list-none m-0 p-0 mt-4 grid gap-4" aria-label={`Stops on day ${d + 1}`}>
                {day.stops.map((stop, i) => {
                  const error = errors[`days.${d}.stops.${i}`];
                  const errorId = error ? stopId(stop, "error") : undefined;
                  return (
                    <li key={stop.key}>
                      <fieldset className="border border-paper-200 rounded-sm p-3 m-0 min-w-0" aria-describedby={errorId}>
                        <legend className="t-ui px-1">Day {d + 1}, stop {i + 1}</legend>
                        <FieldError id={stopId(stop, "error")} message={error} />
                        <div className="mt-2">
                          <label htmlFor={stopId(stop, "title")} className="block t-body-sm font-medium">What you did or saw</label>
                          <input id={stopId(stop, "title")} value={stop.title} onChange={(e) => updateStop(day.key, stop.key, { title: e.target.value })} maxLength={140} placeholder="For example: Morning market and breakfast" aria-invalid={error ? true : undefined} aria-describedby={errorId} className={`${inputClass} mt-1`} />
                        </div>
                        <StopPlacePicker
                          id={stopId(stop, "destination")}
                          picked={stop.destination ? { id: stop.destination, label: stop.destinationLabel || "Chosen destination" } : null}
                          onPick={(p) => updateStop(day.key, stop.key, { destination: p?.id ?? null, destinationLabel: p?.label ?? "" })}
                        />
                        <div className="grid gap-x-4 sm:grid-cols-2">
                          <div className="mt-3">
                            <label htmlFor={stopId(stop, "place")} className="block t-body-sm font-medium">Public place <span className="text-ink-600 font-normal">(optional)</span></label>
                            <input id={stopId(stop, "place")} value={stop.place} onChange={(e) => updateStop(day.key, stop.key, { place: e.target.value })} maxLength={200} aria-describedby={`${stopId(stop, "place")}-hint`} className={`${inputClass} mt-1`} />
                            <p id={`${stopId(stop, "place")}-hint`} className="t-meta text-ink-400 normal-case tracking-normal mt-1 mb-0">A museum, station, beach or restaurant. Never a private address.</p>
                          </div>
                          <div className="mt-3">
                            <label htmlFor={stopId(stop, "time")} className="block t-body-sm font-medium">Getting there and timing <span className="text-ink-600 font-normal">(optional)</span></label>
                            <input id={stopId(stop, "time")} value={stop.timeNote} onChange={(e) => updateStop(day.key, stop.key, { timeNote: e.target.value })} maxLength={200} placeholder="For example: 40 minutes by ferry, left at 8 am" className={`${inputClass} mt-1`} />
                          </div>
                          <div className="mt-3">
                            <label htmlFor={stopId(stop, "cost")} className="block t-body-sm font-medium">Cost <span className="text-ink-600 font-normal">(optional)</span></label>
                            <input id={stopId(stop, "cost")} value={stop.cost} onChange={(e) => updateStop(day.key, stop.key, { cost: e.target.value })} inputMode="decimal" placeholder="25" aria-invalid={error ? true : undefined} aria-describedby={errorId} className={`${inputClass} mt-1`} />
                          </div>
                          <div className="mt-3" onChange={(e) => { const t = e.target as HTMLInputElement; if (t.id === stopId(stop, "currency")) updateStop(day.key, stop.key, { costCurrency: t.value.toUpperCase() }); }}>
                            <label htmlFor={stopId(stop, "currency")} className="block t-body-sm font-medium">Currency</label>
                            <div className="mt-1"><CurrencyInput id={stopId(stop, "currency")} name="" value={stop.costCurrency} label={`Currency for day ${d + 1}, stop ${i + 1}`} /></div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label htmlFor={stopId(stop, "description")} className="block t-body-sm font-medium">Notes <span className="text-ink-600 font-normal">(optional)</span></label>
                          <textarea id={stopId(stop, "description")} value={stop.description} onChange={(e) => updateStop(day.key, stop.key, { description: e.target.value })} rows={3} maxLength={LIMITS.longTextMax} className={`${inputClass} mt-1`} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button id={stopId(stop, "up")} type="button" onClick={() => moveStop(d, i, -1)} disabled={i === 0} className={smallButton} aria-label={`Move day ${d + 1}, stop ${i + 1} up`}>Move up</button>
                          <button id={stopId(stop, "down")} type="button" onClick={() => moveStop(d, i, 1)} disabled={i === day.stops.length - 1} className={smallButton} aria-label={`Move day ${d + 1}, stop ${i + 1} down`}>Move down</button>
                          <button type="button" onClick={() => removeStop(d, i)} className={smallButton} aria-label={`Remove day ${d + 1}, stop ${i + 1}`}>Remove stop</button>
                        </div>
                      </fieldset>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-paper-200 pt-3">
                {day.stops.length < LIMITS.maxStopsPerDay ? (
                  <button id={dayId(day, "add-stop")} type="button" onClick={() => addStop(d)} className={smallButton}>Add a stop to day {d + 1}</button>
                ) : (
                  <p className="t-body-sm text-ink-600 m-0">This day has the most stops a day can have.</p>
                )}
                <button id={dayId(day, "up")} type="button" onClick={() => moveDay(d, -1)} disabled={d === 0} className={smallButton} aria-label={`Move day ${d + 1} up`}>Move day up</button>
                <button id={dayId(day, "down")} type="button" onClick={() => moveDay(d, 1)} disabled={d === days.length - 1} className={smallButton} aria-label={`Move day ${d + 1} down`}>Move day down</button>
                <button type="button" onClick={() => removeDay(d)} className={smallButton} aria-label={`Remove day ${d + 1}`}>Remove day</button>
              </div>
            </li>
          );
        })}
      </ol>
      {days.length < LIMITS.maxItineraryDays ? (
        <button id={`${uid}-add-day`} type="button" onClick={addDay} className={`${secondaryButtonClass} mt-4`}>Add a day</button>
      ) : (
        <p className="t-body-sm text-ink-600 mt-4">You have added the most days a report can have ({LIMITS.maxItineraryDays}).</p>
      )}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </fieldset>
  );
}

/**
 * Choose one destination record for a stop, by typing its name. Optional: a stop can also just
 * name a public place. The choice is kept in the itinerary data, not in a form field of its own.
 */
function StopPlacePicker({ id, picked, onPick }: { id: string; picked: { id: string; label: string } | null; onPick: (place: { id: string; label: string } | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DestinationOption[]>([]);
  const [status, setStatus] = useState("");
  const latest = useRef("");
  const refocus = useRef(false);

  // The search box and the chosen place swap places, so focus follows to whichever is shown.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    document.getElementById(id)?.focus();
  });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await findDestinationsAction(q).catch(() => []);
      if (cancelled || latest.current !== q) return;
      setResults(found);
      setStatus(found.length ? `${found.length} place${found.length === 1 ? "" : "s"} found.` : "No places found with that name.");
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const choose = (place: { id: string; label: string } | null) => {
    refocus.current = true;
    onPick(place);
    onType("");
    setStatus(place ? `${place.label} chosen.` : "Destination removed.");
  };
  const onType = (value: string) => {
    setQuery(value);
    latest.current = value.trim();
    if (value.trim().length < 2) { setResults([]); setStatus(""); }
  };

  if (picked) {
    return (
      <div className="mt-3">
        <p className="block t-body-sm font-medium m-0">Destination</p>
        <p className="mt-1 mb-0 flex flex-wrap items-center gap-2 t-body-sm">
          <span className="rounded-sm bg-marine-100 px-3 py-1">{picked.label}</span>
          <button id={id} type="button" onClick={() => choose(null)} className={smallButton} aria-label={`Remove destination ${picked.label}`}>Remove</button>
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block t-body-sm font-medium">Destination <span className="text-ink-600 font-normal">(optional)</span></label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) choose({ id: results[0].id, label: results[0].label }); } }}
        autoComplete="off"
        placeholder="Type a town, city or region"
        aria-describedby={`${id}-status`}
        className={`${inputClass} mt-1`}
      />
      <p id={`${id}-status`} aria-live="polite" className="sr-only">{status}</p>
      {results.length > 0 && (
        <ul className="mt-2 list-none m-0 p-0 border border-line-500 rounded-sm bg-paper-000 divide-y divide-paper-200" aria-label="Matching places">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => choose({ id: r.id, label: r.label })} className="w-full text-left min-h-11 px-3 py-2 t-body-sm hover:bg-paper-100 focus-visible:bg-paper-100">
                {r.label} <span className="text-ink-400">· {r.kind === "area" ? "travel area" : r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
