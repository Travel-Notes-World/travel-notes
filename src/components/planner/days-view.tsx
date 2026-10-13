import Link from "next/link";

import { formatDay } from "@/components/community/ui";
import type { PlanDay } from "@/lib/community/plans";

const TIME = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

/** A plan's days, easy to read: the default view of a written plan. Editing opens separately. */
export function DaysView({ days, showBooked = true }: { days: PlanDay[]; showBooked?: boolean }) {
  return (
    <ol className="list-none m-0 p-0 grid gap-6 max-w-[860px]">
      {days.map((d, i) => (
        <li key={i} className="border-t border-paper-200 pt-4">
          <h3 className="t-heading-3 m-0">Day {i + 1}{d.date ? ` · ${formatDay(d.date)}` : ""}{d.title ? ` · ${d.title}` : ""}</h3>
          {d.overnight && <p className="t-body-sm text-ink-600 m-0">Overnight: {d.overnight}{showBooked && d.overnightConfirmed ? " (booked)" : ""}</p>}
          {d.transport && <p className="t-body-sm text-ink-600 m-0">Getting around: {d.transport}</p>}
          {d.stops.length === 0 ? (
            <p className="t-body-sm text-ink-600 mt-2 mb-0">Nothing planned yet.</p>
          ) : (
            <ul className="list-none m-0 mt-2 p-0 grid gap-3">
              {d.stops.map((s, j) => (
                <li key={j} className="grid sm:grid-cols-[6rem_1fr] gap-x-3 t-body-sm">
                  <span className="text-ink-600">{s.timeOfDay ? TIME[s.timeOfDay] : ""}</span>
                  <span>
                    <strong>{s.title}</strong>{s.place ? ` · ${s.place}` : ""}
                    {s.notes && <><br />{s.notes}</>}
                    {s.origin === "ai_idea" && <><br /><span className="text-ochre-700">AI idea, not checked by Travel Notes</span></>}
                    {s.origin === "travel_notes" && s.sourcePath && <><br /><Link href={s.sourcePath} className="text-marine-600 underline">From Travel Notes</Link></>}
                    {s.saved && <><br /><Link href={s.saved.path} className="text-marine-600 underline">From the community: {s.saved.title}</Link></>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
