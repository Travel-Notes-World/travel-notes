"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ACTIVITY_CATEGORIES, ACTIVITY_FORMATS, COMMERCIAL_DISCLOSURES, PRICE_STATES } from "@/lib/community/constants";
import { ContributionForm, CurrencyInput, type FieldsProps, type FormInitial } from "./contribution-form";
import { describedBy, Field, inputClass } from "./ui";

type Props = { id: string | null; initial: FormInitial; published?: boolean; topics?: { id: string; name: string }[]; intro?: ReactNode };

/** Submit or edit an activity. Dates and times are always entered in the event's own local time. */
export function ActivityForm(props: Props) {
  return <ContributionForm type="activity" {...props} submitLabel="Submit activity for review">{(p) => <ActivityFields {...p} />}</ContributionForm>;
}

/** Every IANA zone this browser knows. Filled in after the page loads, so the server and browser render the same HTML. */
function useTimeZones(): string[] {
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    try {
      const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
      const list = intl.supportedValuesOf?.("timeZone") ?? [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after hydration
      setZones(list.includes("UTC") ? list : [...list, "UTC"]);
    } catch { /* an old browser: the field still accepts typed zone names */ }
  }, []);
  return zones;
}

const fieldsetClass = "mt-6 border border-paper-200 rounded-md p-4 min-w-0";
const legendClass = "t-ui px-1";

/**
 * The activity-specific fields.
 *
 * Without JavaScript every field is shown and the form still works: the server reads the date
 * fields or the date-and-time fields depending on the "all day" box, and ignores the price when
 * the activity is not paid. With JavaScript, fields that do not apply are hidden to keep it short.
 */
export function ActivityFields({ value, checked, errors, destinationZone }: FieldsProps) {
  const [enhanced, setEnhanced] = useState(false);
  const [format, setFormat] = useState(value("format") || "in_person");
  const [allDay, setAllDay] = useState(checked("allDay"));
  const [priceState, setPriceState] = useState(value("priceState"));
  const [category, setCategory] = useState(value("category"));
  const zoneRef = useRef<HTMLInputElement>(null);
  const zoneTouched = useRef(Boolean(value("timeZone")));
  const zones = useTimeZones();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- switch to the shorter layout only once scripts are running
  useEffect(() => setEnhanced(true), []);

  // Suggest the time zone of the first chosen destination, unless the member already chose one.
  useEffect(() => {
    const input = zoneRef.current;
    if (input && destinationZone && (!zoneTouched.current || !input.value)) input.value = destinationZone;
  }, [destinationZone]);

  const hideIf = (condition: boolean) => (enhanced && condition ? { hidden: true } : {});
  const startError = errors.startLocal;
  const endError = errors.endLocal;

  return (
    <>
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>What kind of activity <span className="text-ink-600 font-normal">(required)</span></legend>
        <p id="category-hint" className="t-body-sm text-ink-600 mt-1 mb-2">Travel Notes does not organise or endorse listed activities. Choose the one that describes who runs it.</p>
        <div className="grid gap-2" role="radiogroup" aria-describedby={["category-hint", errors.category ? "category-error" : null].filter(Boolean).join(" ")}>
          {ACTIVITY_CATEGORIES.map((c) => (
            <label key={c.value} className="flex items-start gap-3 t-body-sm min-h-11 py-1">
              <input type="radio" name="category" value={c.value} defaultChecked={value("category") === c.value} onChange={() => setCategory(c.value)} className="w-4 h-4 mt-1 shrink-0" />
              <span><span className="t-ui">{c.label}</span><br /><span className="text-ink-600">{c.help}</span></span>
            </label>
          ))}
        </div>
        {errors.category && <p id="category-error" className="t-body-sm text-signal-error mt-1 mb-0 font-medium"><span aria-hidden="true">⚠ </span>{errors.category}</p>}
        {category === "commercial_activity" && <p className="t-body-sm text-ink-600 mt-2 mb-0" role="note">Commercial listings are always shown with a disclosure that a business is involved.</p>}
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Where</legend>
        <div className="grid gap-2 mt-1" role="radiogroup" aria-label="Format">
          {ACTIVITY_FORMATS.map((f) => (
            <label key={f.value} className="inline-flex items-center gap-2 t-body-sm min-h-11">
              <input type="radio" name="format" value={f.value} defaultChecked={(value("format") || "in_person") === f.value} onChange={() => setFormat(f.value)} className="w-4 h-4" /> {f.label}
            </label>
          ))}
        </div>
        <div {...hideIf(format === "online")}>
          <Field id="venueName" label="Venue or meeting point" hint="A public place people can find. Never give a private home address." error={errors.venueName}>
            <input {...describedBy("venueName", true, errors.venueName)} name="venueName" maxLength={200} defaultValue={value("venueName")} className={inputClass} autoComplete="off" />
          </Field>
          <Field id="venueAddress" label="Address" optional hint="Write it the way it is written locally. Any country’s format is fine." error={errors.venueAddress}>
            <textarea {...describedBy("venueAddress", true, errors.venueAddress)} name="venueAddress" rows={2} maxLength={300} defaultValue={value("venueAddress")} className={inputClass} />
          </Field>
        </div>
        <Field
          id="bookingUrl"
          label={format === "online" ? "Joining or booking link" : "Booking or information link"}
          optional
          hint={format === "online" ? "Where people join or register, starting with https://. It is shown on the public page." : "Where people can book or read more, starting with https://"}
          error={errors.bookingUrl}
        >
          <input {...describedBy("bookingUrl", true, errors.bookingUrl)} name="bookingUrl" type="url" inputMode="url" maxLength={500} defaultValue={value("bookingUrl")} placeholder="https://" className={inputClass} />
        </Field>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>When <span className="text-ink-600 font-normal">(in the event’s local time)</span></legend>
        <Field
          id="timeZone"
          label="Time zone of the event"
          required
          hint="Times are shown to readers in this zone. We suggest the zone of the first destination you chose; change it if the event is somewhere else. Example: Asia/Bangkok."
          error={errors.timeZone}
        >
          <input {...describedBy("timeZone", true, errors.timeZone)} ref={zoneRef} name="timeZone" list="timeZone-list" maxLength={64} defaultValue={value("timeZone")} onInput={() => { zoneTouched.current = true; }} autoComplete="off" spellCheck={false} className={inputClass} />
          <datalist id="timeZone-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>
        </Field>
        <label className="mt-5 flex items-center gap-2 t-body-sm min-h-11">
          <input type="checkbox" name="allDay" defaultChecked={checked("allDay")} onChange={(e) => setAllDay(e.target.checked)} className="w-4 h-4" /> All-day event (no start time)
        </label>
        {!enhanced && <p className="t-body-sm text-ink-600 mt-1 mb-0">For an all-day event fill in the two date fields; otherwise fill in the date-and-time fields.</p>}
        <div className="grid gap-x-6 md:grid-cols-2" {...hideIf(allDay)}>
          <Field id="startLocal" label="Starts" required hint="Local date and time at the venue." error={allDay ? undefined : startError}>
            <input {...describedBy("startLocal", true, allDay ? undefined : startError)} name="startLocal" type="datetime-local" defaultValue={value("startLocal")} className={inputClass} />
          </Field>
          <Field id="endLocal" label="Ends" optional hint="Local date and time at the venue." error={allDay ? undefined : endError}>
            <input {...describedBy("endLocal", true, allDay ? undefined : endError)} name="endLocal" type="datetime-local" defaultValue={value("endLocal")} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-x-6 md:grid-cols-2" {...hideIf(!allDay)}>
          <Field id="startDate" label="First day" required hint="Local date at the venue." error={allDay ? startError : undefined}>
            <input {...describedBy("startDate", true, allDay ? startError : undefined)} name="startDate" type="date" defaultValue={value("startDate")} className={inputClass} />
          </Field>
          <Field id="endDate" label="Last day" optional hint="Leave empty for a one-day event." error={allDay ? endError : undefined}>
            <input {...describedBy("endDate", true, allDay ? endError : undefined)} name="endDate" type="date" defaultValue={value("endDate")} className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Price and capacity</legend>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Field id="priceState" label="Price" required error={errors.priceState}>
            <select {...describedBy("priceState", null, errors.priceState)} name="priceState" defaultValue={value("priceState")} onChange={(e) => setPriceState(e.target.value)} className={inputClass}>
              <option value="">Choose…</option>
              {PRICE_STATES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <div {...hideIf(priceState !== "paid")}>
            <Field id="price" label="Price per person" optional hint="Only used when the price is “Paid”. Travel Notes does not take payments." error={errors.price}>
              <div className="flex gap-2">
                <input {...describedBy("price", true, errors.price)} name="price" inputMode="decimal" defaultValue={value("price")} placeholder="25" className={inputClass} />
                <CurrencyInput id="priceCurrency" name="priceCurrency" value={value("priceCurrency")} label="Price currency" />
              </div>
            </Field>
          </div>
        </div>
        <Field id="capacity" label="Capacity" optional hint="The most people who can attend, if there is a limit." error={errors.capacity}>
          <input {...describedBy("capacity", true, errors.capacity)} name="capacity" type="number" inputMode="numeric" min={1} max={100000} defaultValue={value("capacity")} className={`${inputClass} max-w-[10rem]`} />
        </Field>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Organiser</legend>
        <Field id="organiserName" label="Organiser name" required hint="The person, group or business that runs it. Shown publicly." error={errors.organiserName}>
          <input {...describedBy("organiserName", true, errors.organiserName)} name="organiserName" maxLength={140} defaultValue={value("organiserName")} className={inputClass} />
        </Field>
        <Field
          id="organiserContact"
          label="Contact for moderators"
          required
          hint="An email address or phone number a moderator can use to check this listing. It is private: only moderators see it, and it is never shown on the page."
          error={errors.organiserContact}
        >
          <input {...describedBy("organiserContact", true, errors.organiserContact)} name="organiserContact" maxLength={200} defaultValue={value("organiserContact")} autoComplete="off" className={inputClass} />
        </Field>
        <Field id="disclosure" label="Commercial interest" hint="Say if you are connected to the business, or if a link earns money." error={errors.disclosure}>
          <select {...describedBy("disclosure", true, errors.disclosure)} name="disclosure" defaultValue={value("disclosure") || "none"} className={inputClass}>
            {COMMERCIAL_DISCLOSURES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field
          id="sourceUrl"
          label="Where the details can be checked"
          optional={category !== "public_event"}
          required={category === "public_event"}
          hint="The official page for the event, starting with https://. Needed for public events run by someone else."
          error={errors.sourceUrl}
        >
          <input {...describedBy("sourceUrl", true, errors.sourceUrl)} name="sourceUrl" type="url" inputMode="url" maxLength={500} defaultValue={value("sourceUrl")} placeholder="https://" className={inputClass} />
        </Field>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Who it suits <span className="text-ink-600 font-normal">(optional)</span></legend>
        <Field id="audience" label="Suitable for" hint="For example: families with young children, adults only, beginners." error={errors.audience}>
          <input {...describedBy("audience", true, errors.audience)} name="audience" maxLength={200} defaultValue={value("audience")} className={inputClass} />
        </Field>
        <Field id="accessibility" label="Accessibility" hint="Step-free access, seating, quiet spaces, sign language and anything else you know. Only write what you are sure of." error={errors.accessibility}>
          <textarea {...describedBy("accessibility", true, errors.accessibility)} name="accessibility" rows={3} maxLength={1000} defaultValue={value("accessibility")} className={inputClass} />
        </Field>
      </fieldset>
    </>
  );
}
