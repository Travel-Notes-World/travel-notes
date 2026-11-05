import Link from "next/link";
import type { ReactNode } from "react";

import { displayRound, formatMoney, type Budget, type BudgetLine, type SelectedItem } from "@/lib/planner/trip/calc";
import { changeTripAction } from "@/lib/planner/trip/actions";
import { partyText, type TripForm } from "@/lib/planner/trip/form";
import type { LockedDay, TripView, VisibleDay } from "@/lib/planner/trip/gate";
import { CATEGORY_LABEL, MODE_LABEL, PRICE_TYPE_LABEL, priceBasisText, SLOT_LABEL, SLOTS, type Alternative, type PriceFact } from "@/lib/planner/trip/plan";

/**
 * The trip results. These are server components: they receive the view the server built for this
 * visitor (gate.ts), so a locked day's details are never part of the page.
 */

export const TABS = [
  { value: "overview", label: "Overview" },
  { value: "daily", label: "Daily plan" },
  { value: "budget", label: "Budget" },
  { value: "map", label: "Map" },
] as const;
export type Tab = (typeof TABS)[number]["value"];

const fmtDate = (d: string, long = false) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", long ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const money = (minor: number, currency: string) => formatMoney(minor, currency, { round: true });
const range = (b: { low: number; high: number }, currency: string) => (b.low === b.high ? money(b.low, currency) : `${money(b.low, currency)}–${money(b.high, currency)}`);
const mapsSearch = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const smallButton = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-body-sm hover:border-ink-900";

// ---------------------------------------------------------------------------------------------
// Header and tabs.

export function TripHeader({ form, view, token, canEdit }: { form: TripForm; view: TripView; token: string; canEdit: boolean }) {
  const b = view.budget;
  // Left over or over budget, from the amounts as displayed, so the three cards always agree.
  const remaining = b.budget !== null ? displayRound(b.budget, b.currency) - displayRound(b.total.working, b.currency) : null;
  return (
    <header className="mt-2 mb-6">
      <p className="t-meta text-ochre-700 m-0">Your trip</p>
      <h1 className="t-heading-1 mt-2 m-0">{form.destination}</h1>
      <p className="t-deck mt-2 mb-0">{fmtDate(form.arrive, true)} to {fmtDate(form.depart, true)} · {form.days} {form.days === 1 ? "day" : "days"}, {form.nights} {form.nights === 1 ? "night" : "nights"} · {partyText(form)}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3 max-w-[960px]">
        <div className="rounded-md border-2 border-marine-600 p-4">
          <p className="t-meta text-ink-600 m-0">Estimated total, whole party</p>
          <p className="t-heading-2 m-0 mt-1">{money(b.total.working, b.currency)}</p>
          <p className="t-body-sm text-ink-600 m-0">Range {range(b.total, b.currency)}{b.incomplete ? " · incomplete" : ""}</p>
        </div>
        <div className="rounded-md border border-paper-200 p-4">
          <p className="t-meta text-ink-600 m-0">Your budget</p>
          <p className="t-heading-2 m-0 mt-1">{b.budget !== null ? money(b.budget, b.currency) : "Not given"}</p>
          {remaining !== null && <p className={`t-body-sm m-0 ${remaining < 0 ? "text-signal-error font-medium" : "text-ink-600"}`}>{remaining < 0 ? `${money(-remaining, b.currency)} over budget` : `${money(remaining, b.currency)} left`}{b.incomplete ? " (before missing costs)" : ""}</p>}
        </div>
        <div className="rounded-md border border-paper-200 p-4">
          <p className="t-meta text-ink-600 m-0">Average per person</p>
          <p className="t-heading-2 m-0 mt-1">{money(b.perPerson, b.currency)}</p>
          <p className="t-body-sm text-ink-600 m-0">An average across {b.travellers} {b.travellers === 1 ? "traveller" : "travellers"}</p>
        </div>
      </div>
      <p className="t-body-sm mt-4 mb-0"><strong>Route:</strong> {view.bases.map((x) => `${x.name} (${x.nights} ${x.nights === 1 ? "night" : "nights"})`).join(" → ")}</p>
      {b.incomplete && <p className="t-body-sm text-signal-error mt-2 mb-0" role="note">The total is incomplete: {b.missing.length} {b.missing.length === 1 ? "cost has" : "costs have"} no reliable price yet and {b.missing.length === 1 ? "is" : "are"} not included. See Budget.</p>}
      {canEdit && <p className="mt-4 mb-0"><Link href={`/trip-planner?edit=${token}`} className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui no-underline hover:border-ink-900">Edit trip</Link></p>}
    </header>
  );
}

export function TripTabs({ token, current }: { token: string; current: Tab }) {
  return (
    <nav aria-label="Trip sections" className="sticky top-0 z-10 bg-paper-000 border-b border-paper-200 -mx-4 px-4 md:mx-0 md:px-0">
      <ul className="list-none m-0 p-0 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <li key={t.value}>
            <Link href={`/trip-planner/t/${token}?tab=${t.value}#plan`} aria-current={current === t.value ? "page" : undefined} className={`inline-flex items-center min-h-12 px-4 t-ui no-underline border-b-4 ${current === t.value ? "border-marine-600 text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900"}`}>{t.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------
// Overview.

export function OverviewTab({ view, form }: { view: TripView; form: TripForm }) {
  return (
    <div className="grid gap-8 max-w-[860px]">
      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="t-heading-2 m-0">Why this route</h2>
        {view.summary && <p className="t-body mt-3 mb-0">{view.summary}</p>}
        {view.why && <p className="t-body mt-3 mb-0">{view.why}</p>}
        <ol className="list-none m-0 mt-4 p-0 grid gap-3">
          {view.bases.map((b, i) => (
            <li key={b.name} className="rounded-md border border-paper-200 p-4">
              <p className="t-ui m-0">{i + 1}. {b.name}{b.region ? `, ${b.region}` : ""}</p>
              <p className="t-body-sm text-ink-600 m-0 mt-1">Days {b.fromDay}–{b.toDay} · {b.nights} {b.nights === 1 ? "night" : "nights"}</p>
              {b.reason && <p className="t-body-sm m-0 mt-2">{b.reason}</p>}
            </li>
          ))}
        </ol>
        {view.gateway.needsFlight && (view.gateway.arrivalAirport || view.gateway.departureAirport) && (
          <p className="t-body-sm mt-4 mb-0">Fly into <strong>{view.gateway.arrivalAirport || view.bases[0].name}</strong> from {form.origin}{view.gateway.departureAirport && view.gateway.departureAirport !== view.gateway.arrivalAirport ? <> and home from <strong>{view.gateway.departureAirport}</strong></> : null}.{view.gateway.note ? ` ${view.gateway.note}` : ""}</p>
        )}
      </section>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="t-heading-2 m-0">Cost summary</h2>
        <CategoryTable budget={view.budget} />
      </section>

      <section aria-labelledby="days-heading">
        <h2 id="days-heading" className="t-heading-2 m-0">Your days</h2>
        <ol className="list-none m-0 mt-3 p-0 border-t border-paper-200">
          {view.days.map((d) => (
            <li key={d.day} className="grid grid-cols-[6.5rem_1fr] gap-3 py-3 border-b border-paper-200 t-body-sm">
              <span className="t-ui">Day {d.day}<span className="block text-ink-600 font-normal">{fmtDate(d.date)}</span></span>
              <span>{d.locked ? <>{d.base} · <span className="text-ink-600">Locked: unlock to see this day</span></> : <>{d.title || d.base}<span className="block text-ink-600">{d.base}{d.overnight ? ` · overnight in ${d.overnight}` : " · departure day"}</span></>}</span>
            </li>
          ))}
        </ol>
      </section>

      {(view.checks.length > 0 || view.assumptions.length > 0) && (
        <section aria-labelledby="check-heading">
          <h2 id="check-heading" className="t-heading-2 m-0">Before you book</h2>
          {view.checks.length > 0 && <ul className="t-body-sm mt-3 mb-0 pl-5 grid gap-1">{view.checks.map((c) => <li key={c}>{c}</li>)}</ul>}
          {view.assumptions.length > 0 && <><h3 className="t-heading-3 mt-5 mb-0">Assumptions in this plan</h3><ul className="t-body-sm mt-2 mb-0 pl-5 grid gap-1">{view.assumptions.map((c) => <li key={c}>{c}</li>)}</ul></>}
        </section>
      )}
    </div>
  );
}

function CategoryTable({ budget: b }: { budget: Budget }) {
  return (
    <table className="mt-3 w-full max-w-[640px] t-body-sm border-collapse">
      <caption className="sr-only">Estimated cost by category</caption>
      <thead><tr className="border-b border-paper-200 text-left"><th scope="col" className="py-2 font-semibold">Category</th><th scope="col" className="py-2 font-semibold text-right">Estimate</th><th scope="col" className="py-2 font-semibold text-right hidden sm:table-cell">Range</th></tr></thead>
      <tbody>
        {b.byCategory.map((c) => (
          <tr key={c.category} className="border-b border-paper-200">
            <th scope="row" className="py-2 font-normal text-left">{CATEGORY_LABEL[c.category]}{c.missing > 0 && <span className="block text-signal-error">{c.missing} missing</span>}</th>
            <td className="py-2 text-right">{money(c.working, b.currency)}</td>
            <td className="py-2 text-right text-ink-600 hidden sm:table-cell">{range(c, b.currency)}</td>
          </tr>
        ))}
        <tr className="border-b border-paper-200"><th scope="row" className="py-2 font-normal text-left">Contingency ({b.contingencyPct}%)</th><td className="py-2 text-right">{money(b.contingency.working, b.currency)}</td><td className="py-2 text-right text-ink-600 hidden sm:table-cell">{range(b.contingency, b.currency)}</td></tr>
        <tr><th scope="row" className="py-2 text-left font-semibold">Estimated total</th><td className="py-2 text-right font-semibold">{money(b.total.working, b.currency)}</td><td className="py-2 text-right text-ink-600 hidden sm:table-cell">{range(b.total, b.currency)}</td></tr>
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------------------------
// Daily plan.

function ChangeForm({ token, fields, children, tab = "daily", anchor }: { token: string; fields: Record<string, string>; children: ReactNode; tab?: string; anchor: string }) {
  return (
    <form action={changeTripAction} className="inline">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="anchor" value={anchor} />
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className={smallButton}>{children}</button>
    </form>
  );
}

function lineFor(item: SelectedItem, lines: BudgetLine[]): BudgetLine | undefined {
  return lines.find((l) => l.id === `item-${item.id}`);
}

function ItemCost({ line, currency }: { line?: BudgetLine; currency: string }) {
  if (!line) return <span className="text-ink-600">No cost</span>;
  if (line.status === "unavailable") return <span className="text-signal-error">Price unavailable</span>;
  if (line.status === "free") return <span>Free entry</span>;
  return <span>{money(line.working, currency)}<span className="text-ink-600"> · {line.quantity}</span></span>;
}

export function DailyTab({ view, token, canChange, priceSlot }: { view: TripView; token: string; canChange: boolean; priceSlot: ReactNode }) {
  const lines = view.budget.lines;
  const cur = view.budget.currency;
  return (
    <div className="grid gap-8 max-w-[860px]">
      {view.warnings.length > 0 && (
        <div role="status" className="border-l-4 border-ochre-600 bg-ochre-100 rounded-sm p-4 max-w-measure">
          <p className="t-ui m-0">Check these changes</p>
          <ul className="t-body-sm mt-1 mb-0 pl-5">{view.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {view.days.map((d) => (d.locked ? <LockedCard key={d.day} day={d} priceSlot={d.day === view.previewDays + 1 ? priceSlot : null} /> : <DayCard key={d.day} day={d} token={token} lines={lines} currency={cur} canChange={canChange} />))}
    </div>
  );
}

function DayCard({ day, token, lines, currency, canChange }: { day: VisibleDay; token: string; lines: BudgetLine[]; currency: string; canChange: boolean }) {
  const anchor = `day-${day.day}`;
  const meals = lines.filter((l) => l.day === day.day && l.category === "food");
  const local = lines.filter((l) => l.day === day.day && l.category === "local_transport");
  const sub = day.subtotal;
  return (
    <article id={anchor} aria-labelledby={`${anchor}-h`} className="rounded-md border border-paper-200 p-4 md:p-5 scroll-mt-20">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="t-meta text-ochre-700 m-0">Day {day.day} · {fmtDate(day.date, true)}</p>
          <h2 id={`${anchor}-h`} className="t-heading-3 m-0 mt-1">{day.title || day.base}</h2>
          <p className="t-body-sm text-ink-600 m-0 mt-1">{day.base}{day.overnight ? ` · overnight in ${day.overnight}` : " · departure day"}</p>
        </div>
        <p className="t-ui m-0">Day costs: {money(sub.working, currency)}{sub.missing ? <span className="block t-body-sm text-signal-error font-normal">{sub.missing} missing</span> : null}</p>
      </header>

      {SLOTS.map((slot) => {
        const items = day.items.filter((i) => i.slot === slot);
        if (!items.length) return null;
        return (
          <section key={slot} className="mt-4">
            <h3 className="t-ui m-0 text-ink-600">{SLOT_LABEL[slot]}</h3>
            <ol className="list-none m-0 mt-2 p-0 grid gap-3">
              {items.map((it) => (
                <li key={it.id} className="border-l-4 border-marine-600 pl-3">
                  {it.travel && it.travel.minutes > 0 && <p className="t-body-sm text-ink-600 m-0">↳ {MODE_LABEL[it.travel.mode]} · about {it.travel.minutes} min</p>}
                  <p className="t-ui m-0">{it.title}{it.added ? <span className="t-body-sm text-ochre-700 font-normal"> · added by you</span> : null}{it.replacedFrom ? <span className="t-body-sm text-ochre-700 font-normal"> · your choice</span> : null}</p>
                  <p className="t-body-sm m-0">{it.place && <a href={mapsSearch([it.place, it.area].filter(Boolean).join(", "))} className="text-marine-600 underline" rel="noopener">{it.place}</a>}{it.area && it.area !== it.place ? <span className="text-ink-600"> · {it.area}</span> : null} · about {it.minutes >= 60 ? `${Math.round(it.minutes / 30) / 2} h` : `${it.minutes} min`}</p>
                  {it.reason && <p className="t-body-sm m-0 mt-1">{it.reason}</p>}
                  {it.note && <p className="t-body-sm text-ochre-700 m-0 mt-1">Check: {it.note}</p>}
                  <p className="t-body-sm m-0 mt-1"><ItemCost line={lineFor(it, lines)} currency={currency} /></p>
                  {canChange && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {it.added
                        ? <ChangeForm token={token} anchor={anchor} fields={{ op: "unadd", alt: it.id }}>Remove</ChangeForm>
                        : it.replacedFrom
                          ? <ChangeForm token={token} anchor={anchor} fields={{ op: "undo", item: it.replacedFrom }}>Undo change</ChangeForm>
                          : <ChangeForm token={token} anchor={anchor} fields={{ op: "remove", item: it.id }}>Remove<span className="sr-only">: {it.title}</span></ChangeForm>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section className="mt-4">
        <h3 className="t-ui m-0 text-ink-600">Meals, coffee and getting around</h3>
        <ul className="list-none m-0 mt-2 p-0 grid gap-1 t-body-sm">
          {[...meals, ...local].map((l) => (
            <li key={l.id} className="flex justify-between gap-3"><span>{l.label}</span><span className="text-right">{l.status === "unavailable" ? <span className="text-signal-error">Price unavailable</span> : l.status === "included" ? "Included" : money(l.working, currency)}</span></li>
          ))}
        </ul>
      </section>

      {canChange && day.alternatives.length > 0 && <Alternatives day={day} token={token} anchor={anchor} />}
    </article>
  );
}

function Alternatives({ day, token, anchor }: { day: VisibleDay; token: string; anchor: string }) {
  return (
    <details className="mt-4 rounded-md bg-paper-100 p-3">
      <summary className="t-ui cursor-pointer min-h-11 flex items-center">Other ideas for this day ({day.alternatives.length})</summary>
      <ul className="list-none m-0 mt-2 p-0 grid gap-3">
        {day.alternatives.map((a: Alternative) => {
          const target = a.replaces && day.items.some((i) => i.id === a.replaces) ? a.replaces : null;
          return (
            <li key={a.id} className="t-body-sm border-t border-paper-200 pt-2">
              <p className="t-ui m-0">{a.title}{a.optional ? <span className="text-ochre-700 font-normal"> · optional extra</span> : null}</p>
              <p className="m-0 text-ink-600">{SLOT_LABEL[a.slot]}{a.place ? ` · ${a.place}` : ""} · {a.costKey ? "Paid" : "No ticket needed"}</p>
              {a.reason && <p className="m-0 mt-1">{a.reason}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {target && <ChangeForm token={token} anchor={anchor} fields={{ op: "replace", item: target, with: a.id }}>Replace “{day.items.find((i) => i.id === target)?.title.slice(0, 30)}”</ChangeForm>}
                <ChangeForm token={token} anchor={anchor} fields={{ op: "add", alt: a.id }}>Add</ChangeForm>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="t-body-sm text-ink-600 mt-2 mb-0">Adding or replacing an idea updates this day’s costs and the trip total straight away.</p>
    </details>
  );
}

function LockedCard({ day, priceSlot }: { day: LockedDay; priceSlot: ReactNode }) {
  return (
    <article aria-label={`Day ${day.day}, locked`} className="relative rounded-md border border-paper-200 p-4 md:p-5 overflow-hidden">
      <p className="t-meta text-ochre-700 m-0">Day {day.day} · {fmtDate(day.date, true)}</p>
      <p className="t-heading-3 m-0 mt-1">{day.base}</p>
      {/* Placeholder shapes only: the day's real items are not part of this page. */}
      <div className="mt-3 grid gap-2 blur-[3px] select-none" aria-hidden="true">
        <div className="h-4 w-2/3 rounded bg-paper-200" />
        <div className="h-3 w-5/6 rounded bg-paper-200" />
        <div className="h-3 w-1/2 rounded bg-paper-200" />
        <div className="h-4 w-3/5 rounded bg-paper-200 mt-2" />
        <div className="h-3 w-4/5 rounded bg-paper-200" />
      </div>
      <p className="t-body-sm mt-3 mb-0"><span aria-hidden="true">🔒 </span>Unlock to see this day’s activities, times, costs and map stops.</p>
      {priceSlot && <div className="mt-4">{priceSlot}</div>}
    </article>
  );
}

// ---------------------------------------------------------------------------------------------
// Budget.

function Sources({ fact }: { fact: PriceFact }) {
  return (
    <details className="mt-1">
      <summary className="t-body-sm text-marine-600 cursor-pointer min-h-11 inline-flex items-center">Where this price comes from</summary>
      <dl className="t-body-sm mt-1 mb-2 grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr] text-ink-600">
        <dt className="font-semibold text-ink-900">Type</dt><dd className="m-0">{PRICE_TYPE_LABEL[fact.type]}: {priceBasisText(fact)}</dd>
        {fact.type !== "unavailable" && <><dt className="font-semibold text-ink-900">Range used</dt><dd className="m-0">{fact.currency} {fact.low}–{fact.high}, working amount {fact.currency} {fact.working} ({fact.unit.replace(/_/g, " ")})</dd></>}
        {fact.childLow !== null && <><dt className="font-semibold text-ink-900">Child price</dt><dd className="m-0">{fact.currency} {fact.childLow}{fact.childMaxAge !== null ? ` up to age ${fact.childMaxAge}` : ""}{fact.freeUnderAge !== null ? `; free under ${fact.freeUnderAge}` : ""}</dd></>}
        {fact.route && <><dt className="font-semibold text-ink-900">For</dt><dd className="m-0">{fact.route}</dd></>}
        {fact.inclusions && <><dt className="font-semibold text-ink-900">Includes</dt><dd className="m-0">{fact.inclusions}</dd></>}
        {fact.method && <><dt className="font-semibold text-ink-900">How worked out</dt><dd className="m-0">{fact.method}{fact.searchDates ? ` (searched ${fact.searchDates})` : ""}</dd></>}
        {fact.assumptions && <><dt className="font-semibold text-ink-900">Assumptions</dt><dd className="m-0">{fact.assumptions}</dd></>}
        {fact.sourceUrl && <><dt className="font-semibold text-ink-900">Source</dt><dd className="m-0"><a href={fact.sourceUrl} rel="noopener nofollow" className="text-marine-600 underline">{fact.sourceName || "Source"}</a></dd></>}
        <dt className="font-semibold text-ink-900">Checked</dt><dd className="m-0">{new Date(fact.checkedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</dd>
      </dl>
    </details>
  );
}

export function BudgetTab({ view, token, canChange }: { view: TripView; token: string; canChange: boolean }) {
  const b = view.budget;
  const cur = b.currency;
  const oneTime = b.lines.filter((l) => l.day === null);
  const groups = new Map<number, BudgetLine[]>();
  for (const l of b.lines.filter((x) => x.day !== null)) groups.set(l.day!, [...(groups.get(l.day!) ?? []), l]);
  const row = (l: BudgetLine) => (
    <li key={l.id} className="py-2 border-b border-paper-200">
      <div className="flex justify-between gap-3 t-body-sm">
        <span><span className="t-ui">{l.label}</span>{l.note ? <span className="text-ink-600"> · {l.note}</span> : null}<span className="block text-ink-600">{l.quantity}</span></span>
        <span className="text-right shrink-0">{l.status === "unavailable" ? <span className="text-signal-error">Missing</span> : l.status === "included" ? "Included" : <>{money(l.working, cur)}{l.low !== l.high && <span className="block text-ink-600">{range(l, cur)}</span>}</>}{l.paid && <span className="block text-signal-success">Paid</span>}</span>
      </div>
      {l.factKey && view.facts[l.factKey] && <Sources fact={view.facts[l.factKey]} />}
    </li>
  );
  return (
    <div className="grid gap-8 max-w-[860px]">
      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="t-heading-2 m-0">Budget</h2>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">All amounts in {cur}, for the whole party, rounded for display. Estimates can change before you book: check prices with the provider. The planner fee is not part of these travel costs.</p>
        <CategoryTable budget={b} />
        <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr] t-body-sm max-w-[640px]">
          <dt className="font-semibold">One-time costs</dt><dd className="m-0">{money(b.oneTime.working, cur)} (flights, transfers, travel between cities, accommodation)</dd>
          <dt className="font-semibold">Daily spending</dt><dd className="m-0">{money(b.known.working - b.oneTime.working, cur)} (meals, coffee and snacks, local transport, tickets)</dd>
          <dt className="font-semibold">Already paid</dt><dd className="m-0">{money(b.paid, cur)}</dd>
          <dt className="font-semibold">Still to pay (estimate)</dt><dd className="m-0">{money(b.toPay, cur)}</dd>
        </dl>
        {canChange && (
          <form action={changeTripAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="op" value="contingency" />
            <input type="hidden" name="tab" value="budget" />
            <label className="t-body-sm grid gap-1">Contingency allowance (%)<input type="number" name="pct" min={0} max={30} defaultValue={b.contingencyPct} className="w-24 min-h-11 px-3 rounded-sm border border-line-500 bg-paper-000" /></label>
            <button type="submit" className={smallButton}>Update</button>
          </form>
        )}
      </section>

      {b.incomplete && (
        <section aria-labelledby="missing-heading" className="border-l-4 border-signal-error bg-paper-100 rounded-sm p-4">
          <h2 id="missing-heading" className="t-heading-3 m-0">Not included in the total</h2>
          <p className="t-body-sm mt-1 mb-2">We could not find a reliable price for these, so the total is incomplete. They are not counted as zero.</p>
          <ul className="t-body-sm m-0 pl-5">{b.missing.map((m, i) => <li key={i}>{m.label}{m.day ? ` (day ${m.day})` : ""}</li>)}</ul>
        </section>
      )}

      <section aria-labelledby="onetime-heading">
        <h2 id="onetime-heading" className="t-heading-3 m-0">One-time costs</h2>
        <ul className="list-none m-0 mt-2 p-0">{oneTime.map(row)}</ul>
      </section>

      {[...groups.entries()].map(([day, ls]) => (
        <section key={day} aria-labelledby={`budget-day-${day}`}>
          <h2 id={`budget-day-${day}`} className="t-heading-3 m-0">Day {day} · {money(ls.reduce((a, l) => a + l.working, 0), cur)}</h2>
          <ul className="list-none m-0 mt-2 p-0">{ls.map(row)}</ul>
        </section>
      ))}

      {view.rates.length > 0 && (
        <section aria-labelledby="rates-heading">
          <h2 id="rates-heading" className="t-heading-3 m-0">Exchange rates used</h2>
          <ul className="t-body-sm mt-2 mb-0 pl-5">{view.rates.map((r) => <li key={r.currency}>A$1 = {r.perAud} {r.currency} · <a href={r.sourceUrl} rel="noopener nofollow" className="text-marine-600 underline">{r.sourceName}</a>, checked {new Date(r.checkedAt).toLocaleDateString("en-AU")}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Map.

export function MapTab({ view }: { view: TripView }) {
  return (
    <div className="grid gap-6 max-w-[860px]">
      <p className="t-body-sm text-ink-600 m-0">Numbered stops for each day, in order. Open a stop in Google Maps, or get directions for the whole day.</p>
      {view.days.map((d) => {
        if (d.locked) return <p key={d.day} className="t-body-sm m-0 rounded-md border border-paper-200 p-4"><strong>Day {d.day}</strong> · {d.base}: unlock to see this day’s map stops.</p>;
        const stops = d.items.filter((i) => i.place);
        const q = (i: SelectedItem) => [i.place, i.area].filter(Boolean).join(", ");
        const directions = stops.length >= 2
          ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(q(stops[0]))}&destination=${encodeURIComponent(q(stops.at(-1)!))}${stops.length > 2 ? `&waypoints=${encodeURIComponent(stops.slice(1, -1).map(q).join("|"))}` : ""}&travelmode=transit`
          : null;
        return (
          <section key={d.day} aria-labelledby={`map-${d.day}`} className="rounded-md border border-paper-200 p-4">
            <h2 id={`map-${d.day}`} className="t-heading-3 m-0">Day {d.day} · {d.base}</h2>
            {stops.length ? (
              <ol className="list-none m-0 mt-3 p-0 grid gap-2">
                {stops.map((s, i) => (
                  <li key={s.id} className="flex items-start gap-3 t-body-sm">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-marine-600 text-on-marine t-ui shrink-0" aria-hidden="true">{i + 1}</span>
                    <span><span className="sr-only">Stop {i + 1}: </span><a href={mapsSearch(q(s))} className="text-marine-600 underline" rel="noopener">{s.place}</a><span className="block text-ink-600">{s.area}</span></span>
                  </li>
                ))}
              </ol>
            ) : <p className="t-body-sm text-ink-600 mt-2 mb-0">No map stops on this day.</p>}
            {directions && <p className="mt-3 mb-0"><a href={directions} className="t-ui text-marine-600 underline" rel="noopener">Directions for day {d.day} in Google Maps</a></p>}
          </section>
        );
      })}
    </div>
  );
}
