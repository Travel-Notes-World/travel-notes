import Link from "next/link";

import { SubmitButton } from "@/components/community/client";
import { updateChoiceAction } from "@/lib/planner/ai-actions";
import { audRange, type BudgetLine, type PriceCheck, type Range } from "@/lib/planner/budget";
import { SLOT_LABEL, type ChoiceOption, type Slot } from "@/lib/planner/choices";
import type { TimelineEntry } from "@/lib/planner/timeline";
import { PriceSource } from "./budget-view";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
const hours = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 2) / 2} h`);
const linesTotal = (lines: BudgetLine[]): Range | null => {
  const priced = lines.filter((l) => l.status !== "unavailable");
  if (!priced.length) return null;
  return { lowCents: priced.reduce((a, l) => a + l.lowCents, 0), highCents: priced.reduce((a, l) => a + l.highCents, 0) };
};

function OptionPrice({ option, price }: { option: ChoiceOption; price: PriceCheck | null }) {
  if (!option.priceId || !price) return <span className="text-ochre-700">Entry price not checked</span>;
  const range = price.lowCents === price.highCents ? audRange({ lowCents: price.lowCents, highCents: price.lowCents }) : audRange(price);
  return (
    <span>
      {range} {price.basis === "group" ? "per group" : "per adult"}
      {price.childLowCents !== null ? `, child ${audRange({ lowCents: price.childLowCents, highCents: price.childHighCents ?? price.childLowCents })}` : ""}
      {price.freeUnderAge !== null ? `, under ${price.freeUnderAge} free` : ""}
      {" · "}<a href={price.sourceUrl} className="text-marine-600 underline" rel="nofollow noopener noreferrer" target="_blank">{price.sourceName}</a>, checked {fmtDate(price.checkedAt)}
    </span>
  );
}

function ChoiceForm({ id, day, slot, action, option, label, variant = "secondary" }: { id: string; day: number; slot: Slot; action: string; option?: string; label: string; variant?: "primary" | "secondary" }) {
  return (
    <form action={updateChoiceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="time" value={slot.time} />
      <input type="hidden" name="action" value={action} />
      {option && <input type="hidden" name="option" value={option} />}
      <SubmitButton variant={variant} pendingText="Updating…">{label}</SubmitButton>
    </form>
  );
}

function OptionCard({ option, price, children, current }: { option: ChoiceOption; price: PriceCheck | null; children?: React.ReactNode; current: boolean }) {
  return (
    <div className={`rounded-md p-3 border ${current ? "border-2 border-marine-600" : "border-paper-200"} grid gap-2 content-start`}>
      <p className="t-ui m-0">{option.title}{current ? <span className="t-body-sm text-marine-600 font-normal"> · chosen</span> : null}</p>
      {option.place && <p className="t-body-sm m-0 text-ink-600">{option.place}</p>}
      {option.notes && <p className="t-body-sm m-0">{option.notes}</p>}
      <p className="t-body-sm m-0">{option.minutes ? `Time: about ${hours(option.minutes)} (estimate) · ` : ""}<OptionPrice option={option} price={price} /></p>
      <p className="t-body-sm m-0">
        {option.origin === "travel_notes" && option.sourcePath
          ? <Link href={option.sourcePath} className="text-marine-600 underline">From Travel Notes</Link>
          : <span className="text-ochre-700">AI idea, not checked by Travel Notes</span>}
        {" · "}<span className="text-ink-600">Opening hours and access not checked</span>
      </p>
      {price?.bookingUrl && <a href={price.bookingUrl} className="t-body-sm text-marine-600 underline" rel="nofollow noopener noreferrer" target="_blank">Official booking page</a>}
      {children}
    </div>
  );
}

/** One part of the day: the chosen activity, and the other choices side by side to compare. */
function SlotChoices({ id, day, slot, priceById }: { id: string; day: number; slot: Slot; priceById: (id: string) => PriceCheck | null }) {
  const current = slot.options.find((o) => o.id === slot.selected) ?? null;
  const others = slot.options.filter((o) => o.id !== slot.selected);
  return (
    <div className="mt-3 grid gap-3">
      {current ? (
        <OptionCard option={current} price={current.priceId ? priceById(current.priceId) : null} current>
          <div className="flex flex-wrap gap-2">
            {slot.locked
              ? <ChoiceForm id={id} day={day} slot={slot} action="unlock" label="Unlock" />
              : <>
                  <ChoiceForm id={id} day={day} slot={slot} action="lock" label="Lock this choice" />
                  <ChoiceForm id={id} day={day} slot={slot} action="remove" label="Remove" />
                </>}
          </div>
          {slot.locked && <p className="t-body-sm text-ink-600 m-0">Locked: AI revisions keep it.</p>}
        </OptionCard>
      ) : (
        <p className="t-body-sm m-0 text-ink-600">Nothing chosen for the {SLOT_LABEL[slot.time].toLowerCase()}. Add one of the choices below, or keep it free.</p>
      )}
      {others.length > 0 && !slot.locked && (
        <details open={!current}>
          <summary className="t-ui cursor-pointer min-h-11 inline-flex items-center text-marine-600">{current ? `Compare ${others.length} other ${others.length === 1 ? "choice" : "choices"}` : "Choices"}</summary>
          <div className="grid gap-3 mt-2 md:grid-cols-2">
            {others.map((o) => (
              <OptionCard key={o.id} option={o} price={o.priceId ? priceById(o.priceId) : null} current={false}>
                <ChoiceForm id={id} day={day} slot={slot} action="choose" option={o.id} label={current ? "Replace with this" : "Add this"} variant="primary" />
              </OptionCard>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * One day of the plan: a timeline with a cost beside each item, the choices for each part of the
 * day, the day's subtotal and what is left of the trip budget after it.
 */
export function DayPlan({ id, day, title, entries, subtotal, remaining, priceById, unavailableCount }: {
  id: string; day: number; title: string; entries: TimelineEntry[]; subtotal: Range; remaining: Range | null; priceById: (id: string) => PriceCheck | null; unavailableCount: number;
}) {
  return (
    <section aria-labelledby="day-heading" className="max-w-[960px]">
      <h2 id="day-heading" className="t-heading-2 m-0">{title}</h2>
      <p className="t-body-sm text-ink-600 mt-1 mb-4">Times are a suggested rhythm, not bookings. Choosing, replacing or removing an activity updates the costs straight away.</p>
      <ol className="list-none m-0 p-0 grid gap-0">
        {entries.map((e, i) => {
          const cost = linesTotal(e.lines);
          const missing = e.lines.some((l) => l.status === "unavailable");
          return (
            <li key={i} className={`grid grid-cols-[3.5rem_1fr] gap-3 py-3 border-b border-paper-200 ${e.kind === "travel" ? "text-ink-600" : ""}`}>
              <span className="t-ui">{e.time}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap justify-between gap-x-4">
                  <span className={e.kind === "travel" || e.kind === "rest" ? "t-body-sm" : "t-ui"}>{e.slot ? `${SLOT_LABEL[e.slot.time]}: ` : ""}{e.title}</span>
                  <span className="t-ui whitespace-nowrap">{cost ? audRange(cost) : missing ? "Price unavailable" : ""}</span>
                </div>
                {e.detail && <p className="t-body-sm m-0 text-ink-600">{e.detail}</p>}
                {e.lines.length > 0 && (
                  <ul className="list-none m-0 mt-1 p-0 grid gap-1">
                    {e.lines.map((l) => (
                      <li key={l.id} className="t-body-sm">
                        {e.lines.length > 1 || l.label !== e.title ? <strong className="font-medium">{l.label}: </strong> : null}
                        {l.status === "unavailable" ? "" : `${l.quantity} · `}<PriceSource line={l} />
                      </li>
                    ))}
                  </ul>
                )}
                {e.slot && <SlotChoices id={id} day={day} slot={e.slot} priceById={priceById} />}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 rounded-md bg-paper-100 p-4 grid gap-1">
        <p className="t-ui m-0 flex justify-between gap-4"><span>Day subtotal</span><span>{audRange(subtotal)}</span></p>
        {unavailableCount > 0 && <p className="t-body-sm m-0 text-ochre-700">{unavailableCount} {unavailableCount === 1 ? "cost has" : "costs have"} no checked price yet and {unavailableCount === 1 ? "is" : "are"} not included.</p>}
        {remaining && <p className="t-body-sm m-0 flex justify-between gap-4"><span>Left from your budget after this day (including one-time costs)</span><span>{audRange(remaining)}</span></p>}
      </div>
    </section>
  );
}
