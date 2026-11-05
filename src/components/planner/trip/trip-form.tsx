"use client";

import { useActionState, useMemo, useState } from "react";

import { FormMessage, SubmitButton } from "@/components/community/client";
import { inputClass } from "@/components/community/ui";
import { initialState } from "@/lib/community/next/state";
import { generateTripAction } from "@/lib/planner/trip/actions";
import { DAY_TIMES, departureFor, INTERESTS, STAY_LEVELS, TRAVELLER_TYPES, TRIP_CURRENCIES, TRIP_LIMITS, TRIP_PACES, tripDays } from "@/lib/planner/trip/form";

type Values = Record<string, unknown>;
const s = (v: unknown, d = "") => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const label = "block t-ui text-ink-900";
const hint = "t-body-sm text-ink-600 mt-1 mb-0";
const chip = "inline-flex items-center gap-2 min-h-11 px-4 rounded-full border-2 border-line-500 cursor-pointer t-ui has-[:checked]:border-marine-600 has-[:checked]:bg-marine-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2";
const generateClass = "inline-flex items-center justify-center min-h-12 px-7 rounded-md bg-marine-600 text-on-marine t-ui text-[1.05rem] hover:bg-marine-700 disabled:opacity-60 disabled:cursor-wait w-full sm:w-auto";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="t-body-sm text-signal-error mt-1 mb-0 font-medium"><span aria-hidden="true">⚠ </span>{message}</p>;
}

/**
 * The single Trip Planner form. One screen, works on a phone, and keeps every value the traveller
 * typed after an error (the server sends them back). Dates and the number of days stay in step:
 * enter a departure date, or a number of days, and the other is worked out.
 */
export function TripForm({ initial = {}, reviseToken, priceText, today }: { initial?: Values; reviseToken?: string; priceText: string; today: string }) {
  const [state, action] = useActionState(generateTripAction, initialState);
  const v: Values = { ...initial, ...(state.values ?? {}) };
  const errors = (state.fields ?? {}) as Record<string, string>;

  const [by, setBy] = useState<"dates" | "days">(s(v.by) === "days" ? "days" : "dates");
  const [arrive, setArrive] = useState(s(v.arrive));
  const [depart, setDepart] = useState(s(v.depart));
  const [days, setDays] = useState(s(v.days, "7"));
  const [type, setType] = useState(s(v.travellerType, "solo"));
  const [adults, setAdults] = useState(s(v.adults, type === "solo" ? "1" : "2"));
  const [children, setChildren] = useState(s(v.children, String(arr(v.childAge).length)));
  const [ages, setAges] = useState<string[]>(arr(v.childAge));
  const [flightBooked, setFlightBooked] = useState(s(v.flightBooked) === "on");
  const [hotelBooked, setHotelBooked] = useState(s(v.hotelBooked) === "on");
  const personalised = Boolean(arr(v.interests).length || s(v.mustSee) || s(v.accessibility) || s(v.dietary) || flightBooked || hotelBooked || s(v.arrivalTime) || Object.keys(errors).some((k) => ["flightAmount", "hotelAmount", "rooms"].includes(k)));

  // Days and nights shown as the traveller types.
  const summary = useMemo(() => {
    if (!isDate(arrive)) return null;
    if (by === "dates") {
      if (!isDate(depart)) return null;
      const n = tripDays(arrive, depart);
      return n >= 1 ? { days: n, depart } : null;
    }
    const n = Number(days);
    return Number.isInteger(n) && n >= 1 ? { days: n, depart: departureFor(arrive, n) } : null;
  }, [arrive, depart, days, by]);

  const pickType = (t: string) => {
    setType(t);
    if (t === "solo") { setAdults("1"); setChildren("0"); setAges([]); }
    if (t === "couple") { setAdults("2"); setChildren("0"); setAges([]); }
    if (t === "family" && Number(children) === 0) { setAdults(adults === "1" ? "2" : adults); setChildren("1"); setAges([""]); }
  };
  const setChildCount = (value: string) => {
    const n = Math.max(0, Math.min(TRIP_LIMITS.maxChildren, Number(value) || 0));
    setChildren(String(n));
    setAges((a) => Array.from({ length: n }, (_, i) => a[i] ?? ""));
  };
  const childCount = Number(children) || 0;
  const err = (k: string) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <form action={action} className="max-w-[720px]" noValidate>
      {reviseToken && <input type="hidden" name="trip" value={reviseToken} />}
      <input type="hidden" name="by" value={by} />
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="origin" className={label}>Travelling from</label>
          <input id="origin" name="origin" defaultValue={s(v.origin)} placeholder="City or airport, e.g. Singapore" autoComplete="off" className={`${inputClass} mt-1`} required {...err("origin")} />
          <FieldError id="origin-error" message={errors.origin} />
        </div>
        <div>
          <label htmlFor="destination" className={label}>Destination</label>
          <input id="destination" name="destination" defaultValue={s(v.destination)} placeholder="Country or city, e.g. Australia" autoComplete="off" className={`${inputClass} mt-1`} required {...err("destination")} />
          <p className={hint}>A country is fine: we choose the cities for you.</p>
          <FieldError id="destination-error" message={errors.destination} />
        </div>
      </div>

      <fieldset className="mt-6 border-0 p-0 m-0 min-w-0">
        <legend className="t-ui p-0">Dates</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Enter dates or a number of days">
          <label className={chip}><input type="radio" name="byChoice" checked={by === "dates"} onChange={() => setBy("dates")} className="sr-only" />Arrival and departure dates</label>
          <label className={chip}><input type="radio" name="byChoice" checked={by === "days"} onChange={() => setBy("days")} className="sr-only" />Arrival date and number of days</label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 mt-3">
          <div>
            <label htmlFor="arrive" className={label}>Arrival date at destination</label>
            <input id="arrive" name="arrive" type="date" min={today} value={arrive} onChange={(e) => setArrive(e.target.value)} className={`${inputClass} mt-1`} {...err("arrive")} />
            <FieldError id="arrive-error" message={errors.arrive} />
          </div>
          {by === "dates" ? (
            <div>
              <label htmlFor="depart" className={label}>Departure date from destination</label>
              <input id="depart" name="depart" type="date" min={arrive || today} value={depart} onChange={(e) => setDepart(e.target.value)} className={`${inputClass} mt-1`} {...err("depart")} />
              <FieldError id="depart-error" message={errors.depart} />
            </div>
          ) : (
            <div>
              <label htmlFor="days" className={label}>Number of days</label>
              <input id="days" name="days" type="number" inputMode="numeric" min={TRIP_LIMITS.minDays} max={TRIP_LIMITS.maxDays} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputClass} mt-1`} {...err("days")} />
              <FieldError id="days-error" message={errors.days} />
            </div>
          )}
        </div>
        {by === "days" && summary && <input type="hidden" name="depart" value={summary.depart} />}
        {by === "dates" && summary && <input type="hidden" name="days" value={summary.days} />}
        <p className="t-body-sm mt-3 mb-0" aria-live="polite">
          {summary
            ? <><strong>{summary.days} {summary.days === 1 ? "day" : "days"}</strong> at your destination ({fmt(arrive)} to {fmt(summary.depart)}), <strong>{Math.max(0, summary.days - 1)} {summary.days - 1 === 1 ? "night" : "nights"}</strong> of accommodation. Arrival and departure days count as days.</>
            : <span className="text-ink-600">Enter your dates to see the number of days and nights.</span>}
        </p>
      </fieldset>

      <fieldset className="mt-6 border-0 p-0 m-0 min-w-0">
        <legend className="t-ui p-0">Who is travelling</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Traveller type">
          {TRAVELLER_TYPES.map((t) => (
            <label key={t.value} className={chip}><input type="radio" name="travellerType" value={t.value} checked={type === t.value} onChange={() => pickType(t.value)} className="sr-only" />{t.label}</label>
          ))}
        </div>
        <div className="grid gap-5 grid-cols-2 mt-3 max-w-[420px]">
          <div>
            <label htmlFor="adults" className={label}>Adults</label>
            <input id="adults" name="adults" type="number" inputMode="numeric" min={1} max={TRIP_LIMITS.maxAdults} value={adults} onChange={(e) => setAdults(e.target.value)} readOnly={type === "solo" || type === "couple"} className={`${inputClass} mt-1`} {...err("adults")} />
          </div>
          <div>
            <label htmlFor="children" className={label}>Children (0–17)</label>
            <input id="children" name="children" type="number" inputMode="numeric" min={0} max={TRIP_LIMITS.maxChildren} value={children} onChange={(e) => setChildCount(e.target.value)} readOnly={type === "solo" || type === "couple"} className={`${inputClass} mt-1`} />
          </div>
        </div>
        <FieldError id="adults-error" message={errors.adults} />
        {childCount > 0 && (
          <div className="mt-3">
            <p className="t-ui m-0">Age of each child on the arrival date</p>
            <p className={hint}>Ages decide child tickets, free entry and suitable activities.</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {ages.map((a, i) => (
                <label key={i} className="t-body-sm grid gap-1">
                  Child {i + 1}
                  <input name="childAge" type="number" inputMode="numeric" min={0} max={17} value={a} onChange={(e) => setAges((list) => list.map((x, j) => (j === i ? e.target.value : x)))} className="w-20 min-h-11 px-3 rounded-sm border border-line-500 bg-paper-000" aria-describedby={errors.childAges ? "childAges-error" : undefined} />
                </label>
              ))}
            </div>
          </div>
        )}
        <FieldError id="childAges-error" message={errors.childAges} />
      </fieldset>

      <div className="grid gap-5 grid-cols-[1fr_auto] mt-6 max-w-[480px]">
        <div>
          <label htmlFor="budget" className={label}>Total trip budget</label>
          <input id="budget" name="budget" inputMode="decimal" defaultValue={s(v.budget)} placeholder="e.g. 5000" className={`${inputClass} mt-1`} {...err("budget")} />
        </div>
        <div>
          <label htmlFor="currency" className={label}>Currency</label>
          <select id="currency" name="currency" defaultValue={s(v.currency, "AUD")} className={`${inputClass} mt-1`}>
            {TRIP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <p className={hint}>For everything: flights, accommodation, food, transport and activities.</p>
      <FieldError id="budget-error" message={errors.budget} />

      <details className="mt-8 rounded-md border border-paper-200 p-4 group" open={personalised}>
        <summary className="t-ui cursor-pointer min-h-11 flex items-center">Personalise my trip <span className="t-body-sm text-ink-600 font-normal ml-2">(optional)</span></summary>

        <fieldset className="mt-4 border-0 p-0 m-0 min-w-0">
          <legend className="t-ui p-0">Interests</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <label key={i.value} className={chip}><input type="checkbox" name="interests" value={i.value} defaultChecked={arr(v.interests).includes(i.value)} className="sr-only" />{i.label}</label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2 mt-5">
          <div>
            <label htmlFor="pace" className={label}>Travel pace</label>
            <select id="pace" name="pace" defaultValue={s(v.pace, "balanced")} className={`${inputClass} mt-1`}>
              {TRIP_PACES.map((p) => <option key={p.value} value={p.value}>{p.label}: {p.hint}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="stay" className={label}>Accommodation level</label>
            <select id="stay" name="stay" defaultValue={s(v.stay, "mid")} className={`${inputClass} mt-1`}>
              {STAY_LEVELS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rooms" className={label}>Rooms</label>
            <input id="rooms" name="rooms" type="number" inputMode="numeric" min={1} max={9} defaultValue={s(v.rooms)} placeholder="Worked out for you" className={`${inputClass} mt-1`} />
          </div>
          <div>
            <label htmlFor="roomNotes" className={label}>Room requirements</label>
            <input id="roomNotes" name="roomNotes" defaultValue={s(v.roomNotes)} placeholder="e.g. two queen beds, cot" className={`${inputClass} mt-1`} />
          </div>
          <div>
            <label htmlFor="accessibility" className={label}>Accessibility needs</label>
            <input id="accessibility" name="accessibility" defaultValue={s(v.accessibility)} placeholder="e.g. step-free access, wheelchair" className={`${inputClass} mt-1`} />
          </div>
          <div>
            <label htmlFor="dietary" className={label}>Dietary needs</label>
            <input id="dietary" name="dietary" defaultValue={s(v.dietary)} placeholder="e.g. vegetarian, halal, nut allergy" className={`${inputClass} mt-1`} />
          </div>
        </div>
        <div className="mt-5">
          <label htmlFor="mustSee" className={label}>Preferred cities or must-see attractions</label>
          <textarea id="mustSee" name="mustSee" rows={2} defaultValue={s(v.mustSee)} placeholder="e.g. Sydney Opera House, the Great Barrier Reef" className={`${inputClass} mt-1`} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 mt-5">
          <div>
            <label htmlFor="arrivalTime" className={label}>Arrival time</label>
            <select id="arrivalTime" name="arrivalTime" defaultValue={s(v.arrivalTime)} className={`${inputClass} mt-1`}>
              {DAY_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="departureTime" className={label}>Departure time</label>
            <select id="departureTime" name="departureTime" defaultValue={s(v.departureTime)} className={`${inputClass} mt-1`}>
              {DAY_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <fieldset className="mt-5 border-0 p-0 m-0 min-w-0">
          <legend className="t-ui p-0">Bookings you already have</legend>
          <label className="mt-2 flex items-center gap-3 min-h-11 t-body-sm"><input type="checkbox" name="flightBooked" checked={flightBooked} onChange={(e) => setFlightBooked(e.target.checked)} className="w-5 h-5" />My flights are booked</label>
          {flightBooked && (
            <div className="ml-8 grid gap-2 max-w-[360px]">
              <label htmlFor="flightAmount" className="t-body-sm">Amount for all travellers (in your budget currency)</label>
              <input id="flightAmount" name="flightAmount" inputMode="decimal" defaultValue={s(v.flightAmount)} className={inputClass} {...err("flightAmount")} />
              <FieldError id="flightAmount-error" message={errors.flightAmount} />
              <label className="flex items-center gap-3 min-h-11 t-body-sm"><input type="checkbox" name="flightPaid" defaultChecked={s(v.flightPaid) === "on"} className="w-5 h-5" />Already paid</label>
            </div>
          )}
          <label className="mt-2 flex items-center gap-3 min-h-11 t-body-sm"><input type="checkbox" name="hotelBooked" checked={hotelBooked} onChange={(e) => setHotelBooked(e.target.checked)} className="w-5 h-5" />My first accommodation is booked</label>
          {hotelBooked && (
            <div className="ml-8 grid gap-2 max-w-[360px]">
              <label htmlFor="hotelName" className="t-body-sm">Name or area</label>
              <input id="hotelName" name="hotelName" defaultValue={s(v.hotelName)} className={inputClass} />
              <label htmlFor="hotelAmount" className="t-body-sm">Total amount for the stay</label>
              <input id="hotelAmount" name="hotelAmount" inputMode="decimal" defaultValue={s(v.hotelAmount)} className={inputClass} {...err("hotelAmount")} />
              <FieldError id="hotelAmount-error" message={errors.hotelAmount} />
              <label className="flex items-center gap-3 min-h-11 t-body-sm"><input type="checkbox" name="hotelPaid" defaultChecked={s(v.hotelPaid) === "on"} className="w-5 h-5" />Already paid</label>
            </div>
          )}
          <label className="mt-2 flex items-center gap-3 min-h-11 t-body-sm"><input type="checkbox" name="breakfastIncluded" defaultChecked={s(v.breakfastIncluded) === "on"} className="w-5 h-5" />Breakfast is included with my accommodation</label>
        </fieldset>
      </details>

      <div className="mt-8 rounded-md bg-marine-100 p-4">
        <p className="t-ui m-0">What you get</p>
        <ul className="t-body-sm mt-2 mb-0 pl-5 grid gap-1">
          <li>Free: your route, the estimated total for the whole trip with every cost category, and the first three days in full.</li>
          <li>Trips of three days or fewer are shown in full for free.</li>
          <li>Unlock the remaining days and a PDF for a one-off planner fee of {priceText}. This fee is separate from your travel costs. Nothing is booked for you.</li>
        </ul>
      </div>

      <div className="mt-6">
        <SubmitButton pendingText="Starting your trip…" className={generateClass}>Generate my trip</SubmitButton>
      </div>
    </form>
  );
}
