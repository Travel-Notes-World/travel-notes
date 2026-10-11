import { MONTH_NAMES, monthShort, type MonthRating } from "@/lib/content/destinationFacts";
import type { Planning } from "@/lib/content/destinations";

const RATING: Record<MonthRating, { label: string; cell: string }> = {
  best: { label: "Best", cell: "bg-marine-600 text-on-marine" },
  good: { label: "Good", cell: "bg-marine-100 text-navy-900" },
  other: { label: "Check conditions", cell: "bg-paper-100 text-ink-600" },
};

/**
 * "When to go": a twelve-month strip rated by the editor, a plain-text summary of the same ratings
 * (so the colours are never the only way to read it), and the editor's explanation.
 */
export function WhenToGo({ name, planning }: { name: string; planning: Planning }) {
  const { months, bestRange, goodRange, whenToGo } = planning;
  if (!months) return null;
  return (
    <section id="when-to-go" aria-labelledby="when-to-go-heading" className="scroll-mt-28">
      <h2 id="when-to-go-heading" className="t-heading-2 m-0">When to go to {name}</h2>
      <ol className="list-none m-0 mt-5 p-0 grid grid-cols-6 sm:grid-cols-12 gap-1" aria-label={`Month by month for ${name}`}>
        {months.map(({ month, rating }) => (
          <li key={month} className={`rounded-sm px-1 py-2 text-center ${RATING[rating].cell}`}>
            <span className="block t-meta" aria-hidden="true">{monthShort(month)}</span>
            <span className="sr-only">{MONTH_NAMES[month]}: {RATING[rating].label}</span>
            <span aria-hidden="true" className="block text-[11px] leading-tight mt-0.5 opacity-90">{rating === "best" ? "Best" : rating === "good" ? "Good" : "–"}</span>
          </li>
        ))}
      </ol>
      <ul className="list-none m-0 mt-3 p-0 flex flex-wrap gap-x-5 gap-y-1 t-meta text-ink-600" aria-hidden="true">
        <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-marine-600" />Best</li>
        <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-marine-100 border border-line-400" />Good</li>
        <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-paper-100 border border-line-400" />Check conditions</li>
      </ul>
      <p className="t-body mt-5 mb-0">
        {bestRange && <><strong className="font-semibold">Best:</strong> {bestRange}. </>}
        {goodRange && <><strong className="font-semibold">Also good:</strong> {goodRange}.</>}
      </p>
      {whenToGo && <p className="t-body mt-3 mb-0 whitespace-pre-line">{whenToGo}</p>}
    </section>
  );
}
