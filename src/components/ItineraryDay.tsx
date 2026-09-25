import type { Day } from "@/content/sample";

export function ItineraryDay({ day }: { day: Day }) {
  return (
    <section className="max-w-measure border-t border-paper-200 pt-6" aria-labelledby={`day-${day.number}`}>
      <p className="t-meta text-ochre-700 m-0">Day {day.number}</p>
      <h3 id={`day-${day.number}`} className="t-heading-3 mt-1 mb-4">{day.title}</h3>
      <ol className="list-none m-0 p-0">
        {day.stops.map((s, i) => (
          <li key={i} className="grid grid-cols-[64px_1fr] gap-4 py-3 border-t border-paper-200">
            <time className="t-meta text-ink-400 pt-[2px]">{s.time}</time>
            <div>
              <p className="t-body-sm font-semibold m-0">{s.name}</p>
              <p className="t-body-sm text-ink-600 m-0">{s.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
