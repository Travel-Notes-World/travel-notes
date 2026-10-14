import Link from "next/link";

import { SubmitButton } from "@/components/community/client";
import { inputClass } from "@/components/community/ui";
import { setDayTripAction } from "@/lib/planner/ai-actions";
import { audRange, type PriceCheck } from "@/lib/planner/budget";
import type { Nearby } from "@/lib/planner/extras";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });

export type NearbyView = Nearby & { fare: PriceCheck | null; dayUsed: number | null };

/**
 * Nearby cities and areas, with distance and, where Travel Notes has checked it, the fare. A close
 * place can take one full day of the trip as a day trip; the budget then adds the journey there
 * and back. Journey times are not checked yet.
 */
export function NearbyTrips({ id, places, days }: { id: string; places: NearbyView[]; days: { index: number; label: string; trip: string | null }[] }) {
  if (!places.length) return <p className="t-body-sm">Travel Notes has no larger nearby places with map locations for this trip yet.</p>;
  const free = days.filter((d) => !d.trip);
  return (
    <section aria-labelledby="nearby-heading" className="max-w-[860px]">
      <h2 id="nearby-heading" className="t-heading-2 m-0">Nearby trips</h2>
      <p className="t-body-sm text-ink-600 mt-1">Distances are in a straight line; real journeys are longer. Journey times are not checked yet: check the timetable before you go.</p>
      <ul className="list-none m-0 mt-4 p-0 grid gap-4">
        {places.map((n) => (
          <li key={n.id} className="border border-paper-200 rounded-md p-4 grid gap-2">
            <p className="t-ui m-0"><Link href={`/destinations/${n.path}`} className="text-marine-600 underline">{n.name}</Link>: about {n.km} km from {n.fromName}</p>
            <p className="t-body-sm m-0">{n.type === "day" ? "Close enough for a day trip." : "Better with an overnight stay."}</p>
            <p className="t-body-sm m-0">
              {n.fare
                ? <>Fare one way: {audRange(n.fare)} {n.fare.basis === "group" ? "for the group" : "per adult"} · <a href={n.fare.sourceUrl} className="text-marine-600 underline" rel="nofollow noopener noreferrer" target="_blank">{n.fare.sourceName}</a>, checked {fmtDate(n.fare.checkedAt)}</>
                : <span className="text-ochre-700">Fare not checked by Travel Notes yet.</span>}
            </p>
            {n.type === "day" && (n.dayUsed !== null ? (
              <form action={setDayTripAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="day" value={n.dayUsed} />
                <span className="t-body-sm"><strong>In your plan on day {n.dayUsed + 1}.</strong> The fare is in that day’s costs.</span>
                <SubmitButton variant="secondary" pendingText="Updating…">Remove the day trip</SubmitButton>
              </form>
            ) : free.length > 0 ? (
              <form action={setDayTripAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="place" value={n.id} />
                <label className="grid gap-1 t-body-sm">
                  <span>Use this day</span>
                  <select name="day" className={inputClass}>{free.map((d) => <option key={d.index} value={d.index}>{d.label}</option>)}</select>
                </label>
                <SubmitButton pendingText="Adding…">Add as a day trip</SubmitButton>
              </form>
            ) : null)}
          </li>
        ))}
      </ul>
      {days.length === 0 && <p className="t-body-sm text-ink-600 mt-4">Day trips need a full day: a trip of at least 3 days.</p>}
    </section>
  );
}
