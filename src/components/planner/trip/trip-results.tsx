import Link from "next/link";
import type { ReactNode } from "react";

import { displayRound, formatMoney, type Budget, type BudgetAdvice, type BudgetLine, type SelectedItem } from "@/lib/planner/trip/calc";
import { changeTripAction } from "@/lib/planner/trip/actions";
import { partyText, type TripForm } from "@/lib/planner/trip/form";
import type { LockedDay, TripView, VisibleDay } from "@/lib/planner/trip/gate";
import { CATEGORY_LABEL, isActivity, MODE_LABEL, PRICE_TYPE_LABEL, priceBasisText, SLOT_LABEL, SLOTS, type Alternative, type PlanItem, type PriceFact, type Unit } from "@/lib/planner/trip/plan";

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
const checkedOn = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
const UNIT_TEXT: Record<Unit, string> = { per_person: "per person", per_adult: "per adult", per_room_night: "per room per night", per_group: "for the group", per_vehicle: "per vehicle", per_item: "each" };
/** An amount in a price fact's own currency (whole units, as found). */
const factMoney = (n: number, currency: string) => new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
const linkClass = "text-marine-600 underline";
const smallButton = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-body-sm hover:border-ink-900";

// ---------------------------------------------------------------------------------------------
// Header and tabs.

export function TripHeader({ form, view, token, canEdit }: { form: TripForm; view: TripView; token: string; canEdit: boolean }) {
  const b = view.budget;
  // Left over or over budget, from the amounts as displayed, so the three cards always agree.
  const priced = b.lines.some((l) => l.status === "priced");
  const remaining = b.budget !== null && priced ? displayRound(b.budget, b.currency) - displayRound(b.total.working, b.currency) : null;
  return (
    <header className="mt-2 mb-6">
      <p className="t-meta text-ochre-700 m-0">Your trip</p>
      <h1 className="t-heading-1 mt-2 m-0">{form.destination}</h1>
      <p className="t-deck mt-2 mb-0">{fmtDate(form.arrive, true)} to {fmtDate(form.depart, true)} · {form.days} {form.days === 1 ? "day" : "days"}, {form.nights} {form.nights === 1 ? "night" : "nights"} · {partyText(form)}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3 max-w-[960px]">
        <div className="rounded-md border-2 border-marine-600 p-4">
          <p className="t-meta text-ink-600 m-0">Estimated total, whole party</p>
          <p className="t-heading-2 m-0 mt-1">{priced ? money(b.total.working, b.currency) : "Not priced yet"}</p>
          <p className="t-body-sm text-ink-600 m-0">{priced ? <>Range {range(b.total, b.currency)}{b.incomplete ? " · incomplete" : ""}</> : "No prices could be found this time."}</p>
        </div>
        <div className="rounded-md border border-paper-200 p-4">
          <p className="t-meta text-ink-600 m-0">Your budget</p>
          <p className="t-heading-2 m-0 mt-1">{b.budget !== null ? money(b.budget, b.currency) : "Not given"}</p>
          {remaining !== null && <p className={`t-body-sm m-0 ${remaining < 0 ? "text-signal-error font-medium" : "text-ink-600"}`}>{remaining < 0 ? `${money(-remaining, b.currency)} over budget` : `${money(remaining, b.currency)} left`}{b.incomplete ? " (before missing costs)" : ""}</p>}
        </div>
        <div className="rounded-md border border-paper-200 p-4">
          <p className="t-meta text-ink-600 m-0">Average per person</p>
          <p className="t-heading-2 m-0 mt-1">{priced ? money(b.perPerson, b.currency) : "—"}</p>
          <p className="t-body-sm text-ink-600 m-0">An average across {b.travellers} {b.travellers === 1 ? "traveller" : "travellers"}</p>
        </div>
      </div>
      <p className="t-body-sm mt-4 mb-0"><strong>Route:</strong> {view.bases.map((x) => `${x.name} (${x.nights} ${x.nights === 1 ? "night" : "nights"})`).join(" → ")}</p>
      {b.incomplete && <p className="t-body-sm text-signal-error mt-2 mb-0" role="note">The total is incomplete: {b.missing.length} {b.missing.length === 1 ? "cost has" : "costs have"} no sourced price yet and {b.missing.length === 1 ? "is" : "are"} not included. You can add your own allowance on the <Link href={`/trip-planner/t/${token}?tab=budget#missing`} className="underline">Budget</Link> tab.</p>}
      {view.advice && <p className="t-body-sm mt-2 mb-0" role="note">Over budget: the <Link href={`/trip-planner/t/${token}?tab=budget#advice-heading`} className="underline">Budget</Link> tab shows what drives the cost and {view.advice.options.length} ways to spend less.</p>}
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
    <table className="mt-3 w-full max-w-[720px] t-body-sm border-collapse">
      <caption className="sr-only">Estimated cost by category</caption>
      <thead><tr className="border-b border-paper-200 text-left"><th scope="col" className="py-2 font-semibold">Category</th><th scope="col" className="py-2 font-semibold text-right">Estimate</th><th scope="col" className="py-2 font-semibold text-right hidden sm:table-cell">Range</th></tr></thead>
      <tbody>
        {b.byCategory.map((c) => (
          <tr key={c.category} className="border-b border-paper-200 align-top">
            <th scope="row" className="py-2 font-normal text-left">
              {CATEGORY_LABEL[c.category]}
              {(c.allowance || c.userAllowance) && <span className="block text-ink-600">Includes {[c.allowance && "estimated allowances", c.userAllowance && "your own allowance"].filter(Boolean).join(" and ")}</span>}
              {c.unresolved.length > 0 && <span className="block text-signal-error">Not yet priced, so not included: {c.unresolved.map((u) => `${u.label}${u.count > 1 ? ` × ${u.count}` : ""}`).join("; ")}</span>}
            </th>
            <td className="py-2 text-right">{c.working > 0 || c.unresolved.length === 0 ? money(c.working, b.currency) : "Not priced"}</td>
            <td className="py-2 text-right text-ink-600 hidden sm:table-cell">{c.working > 0 ? range(c, b.currency) : ""}</td>
          </tr>
        ))}
        <tr className="border-b border-paper-200"><th scope="row" className="py-2 font-normal text-left">Contingency ({b.contingencyPct}%)</th><td className="py-2 text-right">{money(b.contingency.working, b.currency)}</td><td className="py-2 text-right text-ink-600 hidden sm:table-cell">{range(b.contingency, b.currency)}</td></tr>
        <tr><th scope="row" className="py-2 text-left font-semibold">Estimated total{b.incomplete ? " (incomplete)" : ""}</th><td className="py-2 text-right font-semibold">{money(b.total.working, b.currency)}</td><td className="py-2 text-right text-ink-600 hidden sm:table-cell">{range(b.total, b.currency)}</td></tr>
      </tbody>
    </table>
  );
}

/** Over budget: what drives the cost and sourced ways to spend less. Nothing is changed for the traveller. */
function AdviceBox({ advice, currency, budget }: { advice: BudgetAdvice; currency: string; budget: number | null }) {
  return (
    <section aria-labelledby="advice-heading" className="border-l-4 border-ochre-600 bg-ochre-100 rounded-sm p-4 max-w-[720px]">
      <h2 id="advice-heading" className="t-heading-3 m-0">This plan is {money(advice.over, currency)} over your budget</h2>
      <p className="t-body-sm mt-2 mb-0">The biggest costs: {advice.drivers.map((d) => `${CATEGORY_LABEL[d.category].toLowerCase()} ${money(d.working, currency)} (${d.share}%)`).join(", ")}.</p>
      {advice.options.length > 0 && (
        <>
          <p className="t-ui mt-3 mb-0">Ways to spend less</p>
          <ul className="t-body-sm mt-1 mb-0 pl-5 grid gap-1">
            {advice.options.map((o) => <li key={o.id}><strong>{o.label}</strong>: saves about {money(o.saving, currency)}{o.id === "night" ? " per night" : ""}. {o.detail}</li>)}
          </ul>
        </>
      )}
      <p className="t-body-sm mt-3 mb-0">
        {advice.fits
          ? `Together, the first ${advice.options.filter((o) => o.id !== "night").length} changes save about ${money(advice.combined, currency)}, which brings the plan within your budget.`
          : advice.nightsToCut
            ? `Even with the other changes (about ${money(advice.combined, currency)}), the plan stays over budget. It would also need about ${advice.nightsToCut} ${advice.nightsToCut === 1 ? "night" : "nights"} fewer, or more budget.`
            : `Even with all of these changes, this trip is unlikely to fit ${budget !== null ? money(budget, currency) : "your budget"} for these dates. Consider a shorter trip, a different season, or a larger budget.`}
        {" "}Your dates are not changed unless you edit the trip.
      </p>
    </section>
  );
}

/** Where a price comes from, shown in full on the page (not hidden behind a control). */
function SourceNote({ fact, compact = false }: { fact: PriceFact; compact?: boolean }) {
  if (fact.type === "unavailable") return null;
  const unit = UNIT_TEXT[fact.unit];
  return (
    <div className="t-body-sm text-ink-600 mt-1 grid gap-0.5">
      {compact
        ? <p className="m-0"><span className="text-ink-900">{PRICE_TYPE_LABEL[fact.type]}</span>{fact.low !== fact.high ? ` · Expected range ${factMoney(fact.low, fact.currency)}–${factMoney(fact.high, fact.currency)} ${unit}` : ""}</p>
        : <p className="m-0"><span className="text-ink-900">{PRICE_TYPE_LABEL[fact.type]}:</span> {fact.working === 0 ? "Free" : `${factMoney(fact.working, fact.currency)} ${unit}`}{fact.low !== fact.high ? ` · Expected range ${factMoney(fact.low, fact.currency)}–${factMoney(fact.high, fact.currency)}` : ""}</p>}
      {fact.type !== "user" && (
        <p className="m-0">Based on: {fact.sourceUrl ? <a href={fact.sourceUrl} rel="noopener nofollow" className={linkClass}>{fact.sourceName || "Source"}</a> : null}{fact.sourceUrl ? " · " : ""}{priceBasisText(fact)}{!compact && fact.method && fact.type !== "allowance" ? `. ${fact.method}` : ""}</p>
      )}
      {!compact && fact.inclusions && <p className="m-0">{fact.working === 0 ? "Extras: " : "Includes: "}{fact.inclusions}</p>}
      {!compact && fact.assumptions && <p className="m-0">{fact.assumptions}</p>}
      {fact.type !== "user" && <p className="m-0">Checked: {checkedOn(fact.checkedAt)}</p>}
    </div>
  );
}

/** Adult and child admission, from the price fact. */
function Admission({ fact }: { fact: PriceFact }) {
  if (fact.type === "unavailable") return null;
  if (fact.working === 0) return <span>Free entry{fact.inclusions ? ` (${fact.inclusions})` : ""}</span>;
  const parts = [`${fact.unit === "per_person" || fact.unit === "per_adult" ? "Adult " : ""}${factMoney(fact.working, fact.currency)} ${fact.unit === "per_person" || fact.unit === "per_adult" ? "" : UNIT_TEXT[fact.unit]}`.trim()];
  if (fact.childLow !== null) parts.push(`Child ${factMoney(fact.childLow, fact.currency)}${fact.childMaxAge !== null ? ` (to age ${fact.childMaxAge})` : ""}`);
  if (fact.freeUnderAge !== null) parts.push(`free under ${fact.freeUnderAge}`);
  if (fact.familyPass) parts.push(`family pass ${factMoney(fact.familyPass.amount, fact.currency)}`);
  return <span>{parts.join(" · ")}</span>;
}

/** Links to check an activity independently. Only pages the price search returned are linked. */
function ActivityLinks({ fact, item, from }: { fact?: PriceFact; item: Pick<PlanItem, "place" | "area">; from?: Pick<PlanItem, "place" | "area"> | null }) {
  const q = (i: Pick<PlanItem, "place" | "area">) => [i.place, i.area].filter(Boolean).join(", ");
  const directions = item.place ? (from?.place ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(q(from))}&destination=${encodeURIComponent(q(item))}&travelmode=transit` : mapsSearch(q(item))) : null;
  const links: [string, string][] = [];
  if (fact?.officialUrl) links.push(["Official website", fact.officialUrl]);
  const tickets = fact?.ticketsUrl ?? (fact && (fact.type === "published" || fact.type === "quote") ? fact.sourceUrl : null);
  if (tickets && fact && fact.working > 0) links.push(["Check ticket prices", tickets]);
  if (fact?.hoursUrl) links.push(["Opening hours", fact.hoursUrl]);
  if (directions) links.push(["Directions", directions]);
  if (!links.length) return null;
  return <p className="t-body-sm m-0 mt-1 flex flex-wrap gap-x-4 gap-y-1">{links.map(([label, href]) => <a key={label} href={href} rel="noopener nofollow" className={linkClass}>{label}</a>)}</p>;
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
  if (line.status === "unavailable") return <span className="text-signal-error">Price not found yet: not included in the total</span>;
  if (line.status === "free") return null;
  return <span>For your party: {money(line.working, currency)}<span className="text-ink-600"> · {line.quantity}</span></span>;
}

const duration = (m: number) => (m >= 60 ? `${Math.round(m / 30) / 2} h` : `${m} min`);

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
      {view.days.map((d) => (d.locked ? <LockedCard key={d.day} day={d} priceSlot={d.day === view.previewDays + 1 ? priceSlot : null} /> : <DayCard key={d.day} day={d} token={token} lines={lines} facts={view.facts} currency={cur} canChange={canChange} />))}
    </div>
  );
}

function DayCard({ day, token, lines, facts, currency, canChange }: { day: VisibleDay; token: string; lines: BudgetLine[]; facts: Record<string, PriceFact>; currency: string; canChange: boolean }) {
  const anchor = `day-${day.day}`;
  const meals = lines.filter((l) => l.day === day.day && l.category === "food");
  const local = lines.filter((l) => l.day === day.day && l.category === "local_transport");
  const sub = day.subtotal;
  const activities = day.items.filter(isActivity).length;
  return (
    <article id={anchor} aria-labelledby={`${anchor}-h`} className="rounded-md border border-paper-200 p-4 md:p-5 scroll-mt-20">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="t-meta text-ochre-700 m-0">Day {day.day} · {fmtDate(day.date, true)}</p>
          <h2 id={`${anchor}-h`} className="t-heading-3 m-0 mt-1">{day.title || day.base}</h2>
          <p className="t-body-sm text-ink-600 m-0 mt-1">{day.base}{day.overnight ? ` · overnight in ${day.overnight}` : " · departure day"} · {activities} {activities === 1 ? "activity" : "activities"}</p>
          {day.pacingNote && <p className="t-body-sm m-0 mt-1">{day.pacingNote}</p>}
        </div>
        <div className="sm:text-right">
          <p className="t-ui m-0">Day costs: {money(sub.working, currency)}</p>
          {sub.missing ? <p className="t-body-sm text-signal-error m-0">{sub.missing} not yet priced</p> : null}
          <p className="t-body-sm text-ink-600 m-0 sm:max-w-[16rem]">Meals, local transport and tickets. Accommodation and travel between places are one-time costs, counted once in the Budget.</p>
        </div>
      </header>

      {SLOTS.map((slot) => {
        const items = day.items.filter((i) => i.slot === slot);
        if (!items.length) return null;
        return (
          <section key={slot} className="mt-4">
            <h3 className="t-ui m-0 text-ink-600">{SLOT_LABEL[slot]}</h3>
            <ol className="list-none m-0 mt-2 p-0 grid gap-4">
              {items.map((it) => {
                const fact = it.costKey ? facts[it.costKey] : undefined;
                const prev = day.items[day.items.indexOf(it) - 1] ?? null;
                return (
                  <li key={it.id} className="border-l-4 border-marine-600 pl-3">
                    {it.travel && it.travel.minutes > 0 && <p className="t-body-sm text-ink-600 m-0">↳ {MODE_LABEL[it.travel.mode]} · about {it.travel.minutes} min{prev?.place ? ` from ${prev.place}` : ""}</p>}
                    <p className="t-ui m-0">{it.start ? `${it.start} · ` : ""}{it.title}{isActivity(it) || it.added || it.replacedFrom ? <span className="t-body-sm text-ink-600 font-normal"> · {it.added ? "added by you" : it.replacedFrom ? "your choice" : "selected"}</span> : null}</p>
                    <p className="t-body-sm m-0">{it.place ? <><a href={mapsSearch([it.place, it.area].filter(Boolean).join(", "))} className={linkClass} rel="noopener">{it.place}</a>{it.area && it.area !== it.place ? <span className="text-ink-600"> · {it.area}</span> : null} · </> : null}about {duration(it.minutes)}</p>
                    {it.desc && <p className="t-body-sm m-0 mt-1">{it.desc}</p>}
                    {it.reason && <p className="t-body-sm m-0 mt-1"><span className="text-ink-600">Why it suits you:</span> {it.reason}</p>}
                    {it.note && <p className="t-body-sm text-ochre-700 m-0 mt-1">Check: {it.note}</p>}
                    {fact && fact.type !== "unavailable" && it.kind === "activity" && <p className="t-body-sm m-0 mt-1"><span className="text-ink-600">Admission:</span> <Admission fact={fact} /></p>}
                    {lineFor(it, lines)?.status !== "free" && <p className="t-body-sm m-0 mt-1"><ItemCost line={lineFor(it, lines)} currency={currency} /></p>}
                    {fact && <SourceNote fact={fact} compact />}
                    <ActivityLinks fact={fact} item={it} from={prev} />
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
                );
              })}
            </ol>
          </section>
        );
      })}

      <section className="mt-4">
        <h3 className="t-ui m-0 text-ink-600">Meals, coffee and getting around</h3>
        <ul className="list-none m-0 mt-2 p-0 grid gap-1 t-body-sm">
          {[...meals, ...local].map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>{l.label}{l.priceType === "allowance" ? <span className="text-ink-600"> · estimated allowance</span> : l.priceType === "user" ? <span className="text-ink-600"> · your allowance</span> : null}</span>
              <span className="text-right">{l.status === "unavailable" ? <span className="text-signal-error">Not priced yet</span> : l.status === "included" ? "Included" : money(l.working, currency)}</span>
            </li>
          ))}
        </ul>
        <p className="t-body-sm text-ink-600 mt-1 mb-0">Where these amounts come from is listed in full on the <Link href={`/trip-planner/t/${token}?tab=budget#daily-sources`} className={linkClass}>Budget</Link> tab.</p>
      </section>

      {day.alternatives.length > 0 && <Alternatives day={day} token={token} anchor={anchor} facts={facts} canChange={canChange} />}
    </article>
  );
}

function Alternatives({ day, token, anchor, facts, canChange }: { day: VisibleDay; token: string; anchor: string; facts: Record<string, PriceFact>; canChange: boolean }) {
  return (
    <section className="mt-4 rounded-md bg-paper-100 p-3" aria-label={`Optional alternatives for day ${day.day}`}>
      <h3 className="t-ui m-0">Optional alternatives ({day.alternatives.length})</h3>
      <p className="t-body-sm text-ink-600 m-0">Not included in the budget unless you add them.</p>
      <ul className="list-none m-0 mt-2 p-0 grid gap-3">
        {day.alternatives.map((a: Alternative) => {
          const target = a.replaces && day.items.some((i) => i.id === a.replaces) ? a.replaces : null;
          const fact = a.costKey ? facts[a.costKey] : undefined;
          return (
            <li key={a.id} className="t-body-sm border-t border-paper-200 pt-2">
              <p className="t-ui m-0">{a.start ? `${a.start} · ` : ""}{a.title}<span className="text-ochre-700 font-normal"> · {a.optional ? "optional extra" : "optional alternative"}</span></p>
              <p className="m-0 text-ink-600">{SLOT_LABEL[a.slot]}{a.place ? ` · ${a.place}` : ""}{a.area && a.area !== a.place ? `, ${a.area}` : ""} · about {duration(a.minutes)}</p>
              {a.desc && <p className="m-0 mt-1">{a.desc}</p>}
              {a.reason && <p className="m-0 mt-1"><span className="text-ink-600">Why it suits you:</span> {a.reason}</p>}
              <p className="m-0 mt-1"><span className="text-ink-600">Admission:</span> {fact && fact.type !== "unavailable" ? <Admission fact={fact} /> : a.costKey ? "Price not found yet" : "No ticket needed"}</p>
              {fact && <SourceNote fact={fact} compact />}
              <ActivityLinks fact={fact} item={a} />
              {canChange && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {target && <ChangeForm token={token} anchor={anchor} fields={{ op: "replace", item: target, with: a.id }}>Replace “{day.items.find((i) => i.id === target)?.title.slice(0, 30)}”</ChangeForm>}
                  <ChangeForm token={token} anchor={anchor} fields={{ op: "add", alt: a.id }}>Add</ChangeForm>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {canChange && <p className="t-body-sm text-ink-600 mt-2 mb-0">Adding or replacing an idea updates this day’s costs and the trip total straight away.</p>}
    </section>
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
      <p className="t-body-sm mt-3 mb-0"><span aria-hidden="true">🔒 </span>Unlock to see this day’s activities, times, sources and map stops. Its costs are already in the trip total.</p>
      {priceSlot && <div className="mt-4">{priceSlot}</div>}
    </article>
  );
}

// ---------------------------------------------------------------------------------------------
// Budget.

export function BudgetTab({ view, token, canChange }: { view: TripView; token: string; canChange: boolean }) {
  const b = view.budget;
  const cur = b.currency;
  const oneTime = b.lines.filter((l) => l.day === null && !l.id.startsWith("locked-"));
  const lockedLines = b.lines.filter((l) => l.id.startsWith("locked-"));
  const groups = new Map<number, BudgetLine[]>();
  for (const l of b.lines.filter((x) => x.day !== null)) groups.set(l.day!, [...(groups.get(l.day!) ?? []), l]);
  // Routine costs (meals, coffee, snacks, local transport, accommodation) with their sources, listed once.
  const routine = Object.values(view.facts).filter((f) => /^(breakfast|lunch|dinner|coffee|snacks|water|local|stay|stay-budget)@/.test(f.key)).sort((x, y) => x.key.localeCompare(y.key));
  const row = (l: BudgetLine) => (
    <li key={l.id} className="py-2 border-b border-paper-200">
      <div className="flex justify-between gap-3 t-body-sm">
        <span><span className="t-ui">{l.label}</span>{l.note ? <span className="text-ink-600"> · {l.note}</span> : null}<span className="block text-ink-600">{l.quantity}</span></span>
        <span className="text-right shrink-0">{l.status === "unavailable" ? <span className="text-signal-error">Not priced</span> : l.status === "included" ? "Included" : <>{l.id.startsWith("locked-") ? "Estimated " : ""}{money(l.working, cur)}{l.low !== l.high && <span className="block text-ink-600">{range(l, cur)}</span>}</>}{l.paid && <span className="block text-signal-success">Paid</span>}</span>
      </div>
      {l.factKey && view.facts[l.factKey] && !/@/.test(l.factKey) && <SourceNote fact={view.facts[l.factKey]} />}
      {l.factKey && /@/.test(l.factKey) && l.status !== "unavailable" && <p className="t-body-sm text-ink-600 m-0 mt-1">{l.priceType ? `${PRICE_TYPE_LABEL[l.priceType]} · ` : ""}<a href="#daily-sources" className={linkClass}>Where this amount comes from</a></p>}
    </li>
  );
  return (
    <div className="grid gap-8 max-w-[860px]">
      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="t-heading-2 m-0">Budget</h2>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">All amounts in {cur}, for the whole party, rounded for display. Every total below is added up from the same cost lines, so the days, one-time costs and categories always agree. Estimates are not booking quotes: check prices with the provider. The planner fee is not part of these travel costs.</p>
        <CategoryTable budget={b} />
        <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr] t-body-sm max-w-[720px]">
          <dt className="font-semibold">One-time costs</dt><dd className="m-0">{money(b.oneTime.working, cur)} (flights, transfers, travel between cities, accommodation)</dd>
          <dt className="font-semibold">Daily spending</dt><dd className="m-0">{money(b.known.working - b.oneTime.working, cur)} (meals, coffee and snacks, local transport, tickets: the sum of the day costs)</dd>
          <dt className="font-semibold">Contingency</dt><dd className="m-0">{money(b.contingency.working, cur)} ({b.contingencyPct}% of the costs above)</dd>
          <dt className="font-semibold">Already paid</dt><dd className="m-0">{money(b.paid, cur)}</dd>
          <dt className="font-semibold">Still to pay (estimate)</dt><dd className="m-0">{money(b.toPay, cur)}</dd>
          {b.usesUserAllowance && <><dt className="font-semibold">Your allowances</dt><dd className="m-0">The total includes amounts you entered yourself.</dd></>}
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

      {view.advice && <AdviceBox advice={view.advice} currency={cur} budget={b.budget} />}

      {(b.incomplete || view.allowanceKeys.some((k) => k.amount !== null)) && (
        <section aria-labelledby="missing-heading" id="missing" className="border-l-4 border-signal-error bg-paper-100 rounded-sm p-4">
          <h2 id="missing-heading" className="t-heading-3 m-0">Costs without a sourced price</h2>
          <p className="t-body-sm mt-1 mb-2">We could not find a price or local cost data we could check for these, so they are not counted (never as zero). You can enter your own allowance and the totals will include it, marked as yours.</p>
          {view.allowanceKeys.length > 0 && (
            <ul className="list-none m-0 p-0 grid gap-2">
              {view.allowanceKeys.map((k) => (
                <li key={k.key}>
                  <form action={changeTripAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="op" value="allowance" />
                    <input type="hidden" name="tab" value="budget" />
                    <input type="hidden" name="anchor" value="missing" />
                    <input type="hidden" name="key" value={k.key} />
                    <label className="t-body-sm grid gap-1">{k.label} ({cur}, {UNIT_TEXT[k.unit]})<input type="number" name="amount" min={0} max={100000} step="0.01" inputMode="decimal" defaultValue={k.amount ?? ""} className="w-32 min-h-11 px-3 rounded-sm border border-line-500 bg-paper-000" /></label>
                    <button type="submit" className={smallButton}>{k.amount !== null ? "Update" : "Use my allowance"}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {b.missing.length > 0 && <p className="t-body-sm mt-3 mb-0">Still not priced: {[...new Set(b.missing.map((m) => m.label))].join("; ")}.</p>}
        </section>
      )}

      <section aria-labelledby="onetime-heading">
        <h2 id="onetime-heading" className="t-heading-3 m-0">One-time costs</h2>
        <p className="t-body-sm text-ink-600 m-0 mt-1">Counted once for the trip, not in any day’s costs.</p>
        <ul className="list-none m-0 mt-2 p-0">{oneTime.map(row)}</ul>
      </section>

      {[...groups.entries()].map(([day, ls]) => (
        <section key={day} aria-labelledby={`budget-day-${day}`}>
          <h2 id={`budget-day-${day}`} className="t-heading-3 m-0">Day {day} · {money(ls.reduce((a, l) => a + l.working, 0), cur)}</h2>
          <ul className="list-none m-0 mt-2 p-0">{ls.map(row)}</ul>
        </section>
      ))}

      {lockedLines.length > 0 && (
        <section aria-labelledby="locked-heading">
          <h2 id="locked-heading" className="t-heading-3 m-0">Days {view.previewDays + 1}–{view.days.length} (summary)</h2>
          <p className="t-body-sm text-ink-600 m-0 mt-1">Already in the total above. Unlock to see each day’s items, times and sources.</p>
          <ul className="list-none m-0 mt-2 p-0">{lockedLines.map(row)}</ul>
        </section>
      )}

      {routine.length > 0 && (
        <section aria-labelledby="daily-sources-heading" id="daily-sources" className="scroll-mt-20">
          <h2 id="daily-sources-heading" className="t-heading-3 m-0">Where the accommodation and daily amounts come from</h2>
          <ul className="list-none m-0 mt-2 p-0 grid gap-3">
            {routine.map((f) => (
              <li key={f.key} className="border-b border-paper-200 pb-2">
                <p className="t-ui m-0">{f.label}</p>
                {f.type === "unavailable" ? <p className="t-body-sm text-signal-error m-0">No sourced price or cost data found{f.route ? ` (looked for: ${f.route})` : ""}.</p> : <SourceNote fact={f} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.rates.length > 0 && (
        <section aria-labelledby="rates-heading">
          <h2 id="rates-heading" className="t-heading-3 m-0">Exchange rates used</h2>
          <ul className="t-body-sm mt-2 mb-0 pl-5">{view.rates.map((r) => <li key={r.currency}>A$1 = {r.perAud} {r.currency} · <a href={r.sourceUrl} rel="noopener nofollow" className={linkClass}>{r.sourceName}</a>, checked {checkedOn(r.checkedAt)}</li>)}</ul>
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
