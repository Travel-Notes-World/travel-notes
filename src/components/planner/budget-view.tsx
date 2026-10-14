import type { Budget, BudgetLine, Range } from "@/lib/planner/budget";
import { aud, audRange } from "@/lib/planner/budget";

const KIND_LABEL = { published: "Published price", quote: "Quote", estimate: "Estimate" } as const;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Where a line's price comes from, always visible next to the amount. */
export function PriceSource({ line }: { line: BudgetLine }) {
  if (line.status === "booked") return <span className="text-ink-600">{line.paid ? "Your booking · paid" : "Your booking · to pay"}</span>;
  if (line.status === "unavailable") return <span className="text-ochre-700">Price unavailable. {line.note}</span>;
  const p = line.price!;
  return (
    <span className="text-ink-600">
      {KIND_LABEL[p.kind]}{p.kind === "estimate" ? " (typical local range)" : ""} ·{" "}
      <a href={p.sourceUrl} className="text-marine-600 underline" rel="nofollow noopener noreferrer" target="_blank">{p.sourceName}</a>, checked {fmtDate(p.checkedAt)}
      {p.placeName ? ` · price for ${p.placeName}` : ""}
      {p.includes ? ` · Includes: ${p.includes}` : ""}{p.excludes ? ` · Not included: ${p.excludes}` : ""}
      {line.old ? <strong className="text-ochre-700"> · Checked more than a year ago</strong> : null}
      {line.note ? ` · ${line.note}` : ""}
    </span>
  );
}

function Lines({ lines }: { lines: BudgetLine[] }) {
  return (
    <ul className="list-none m-0 p-0 grid gap-3">
      {lines.map((l) => (
        <li key={l.id} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:gap-4 border-b border-paper-200 pb-3 last:border-b-0">
          <div className="t-body-sm min-w-0">
            <strong className="t-ui">{l.label}</strong>
            <br />
            <span>{l.quantity}</span>
            <br />
            <PriceSource line={l} />
          </div>
          <div className="t-ui sm:text-right whitespace-nowrap">{l.status === "unavailable" ? "—" : audRange(l)}</div>
        </li>
      ))}
    </ul>
  );
}

const Row = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex justify-between gap-4 py-1">
    <dt className={strong ? "t-ui" : "t-body-sm"}>{label}</dt>
    <dd className={`m-0 whitespace-nowrap ${strong ? "t-ui" : "t-body-sm"}`}>{value}</dd>
  </div>
);
const hasAmount = (r: Range) => r.lowCents > 0 || r.highCents > 0;

/**
 * The itemised trip budget: totals first, then by category, day by day, one-time costs and the
 * costs we could not price. Only lines with a booked amount or a checked price are added up.
 */
export function BudgetView({ budget, placeName, priceCount }: { budget: Budget; placeName: (id: string) => string; priceCount: number }) {
  const missingNames = [...new Set(budget.unavailable.map((l) => l.label.replace(/, .*$/, "")))];
  const daily = budget.lines.filter((l) => l.day !== null);
  const oneTime = budget.lines.filter((l) => l.day === null);
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border-2 border-marine-600 p-4">
          <p className="t-ui m-0">Estimated total for {budget.people} {budget.people === 1 ? "person" : "people"}</p>
          <p className="t-heading-2 m-0 mt-1">{audRange(budget.total)}</p>
          <p className="t-body-sm text-ink-600 mt-1 mb-0">About {audRange(budget.perPerson)} per person, including a {budget.contingencyPercent}% safety margin.{budget.unavailable.length ? " Costs without a checked price are not included." : ""}</p>
          <dl className="mt-3 mb-0">
            <Row label="Costs with a price" value={audRange(budget.subtotal)} />
            <Row label={`Safety margin (${budget.contingencyPercent}% of what is still to pay)`} value={audRange(budget.contingency)} />
            <Row label="Already paid" value={aud(budget.paid)} />
            <Row label="Still to pay (with the margin)" value={audRange({ lowCents: budget.toPay.lowCents + budget.contingency.lowCents, highCents: budget.toPay.highCents + budget.contingency.highCents })} strong />
            {budget.budget && (
              budget.budget.remaining
                ? <Row label={`Left from your budget of ${aud(budget.budget.amountCents)}`} value={audRange(budget.budget.remaining)} strong />
                : <Row label="Left from your budget" value={`Not worked out: your budget is in ${budget.budget.currency}`} />
            )}
          </dl>
        </div>
        <div>
          <h3 className="t-ui m-0">By category</h3>
          <dl className="mt-2 mb-0">
            {budget.byCategory.map((c) => (
              <Row key={c.category} label={`${c.label}${c.missing ? ` (${c.missing} without a price)` : ""}`} value={hasAmount(c) ? audRange(c) : "Price unavailable"} />
            ))}
          </dl>
        </div>
      </div>

      {missingNames.length > 0 && (
        <div className="rounded-md border border-ochre-700 p-4" role="note">
          <p className="t-ui m-0">Not in the total yet: {missingNames.join(", ")}</p>
          <p className="t-body-sm mt-1 mb-0">
            {priceCount === 0 ? "Travel Notes has not checked prices for this destination yet. " : ""}
            We only add a cost when it has a checked price or you have entered your booking. We never guess a price.
          </p>
        </div>
      )}

      <div>
        <h3 className="t-heading-3 m-0">Day by day</h3>
        <p className="t-body-sm text-ink-600 mt-1">Accommodation is shown on the day you sleep there. Booked accommodation and travel costs are under one-time costs.</p>
        <div className="grid gap-3 mt-3">
          {budget.byDay.map((d) => {
            const lines = daily.filter((l) => l.day === d.day);
            return (
              <details key={d.day} className="border border-paper-200 rounded-md p-3">
                <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-4">
                  <span className="t-ui">Day {d.day + 1}{d.date ? ` · ${fmtDay(d.date)}` : ""} · {placeName(d.placeId)}</span>
                  <span className="t-ui whitespace-nowrap">{hasAmount(d) ? audRange(d) : "—"}</span>
                </summary>
                <div className="mt-3"><Lines lines={lines} /></div>
                <p className="t-body-sm mt-3 mb-0 text-right"><strong>Day {d.day + 1} subtotal: {audRange(d)}</strong></p>
              </details>
            );
          })}
        </div>
      </div>

      {oneTime.length > 0 && (
        <div>
          <h3 className="t-heading-3 m-0">One-time costs</h3>
          <div className="mt-3"><Lines lines={oneTime} /></div>
          <p className="t-body-sm mt-3 mb-0 text-right"><strong>One-time subtotal: {audRange(budget.oneTime)}</strong></p>
        </div>
      )}

      <div className="t-body-sm text-ink-600 grid gap-1">
        <p className="m-0">How this adds up: day subtotals + one-time costs = {audRange(budget.subtotal)}; plus the safety margin = {audRange(budget.total)}. All amounts are in Australian dollars.</p>
        <p className="m-0">Travel insurance is not included. Smartraveller recommends travel insurance for overseas trips: compare policies and read what they cover before you buy.</p>
        <p className="m-0">Prices change. Check the price with the source before you book.</p>
      </div>
    </div>
  );
}
