import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDay, PageShell } from "@/components/community/ui";
import { getSharedPlan } from "@/lib/planner/share";

/**
 * A plan its owner chose to share. Read-only, never indexed, and without personal details (no
 * traveller name, accommodation, travel, funding, accessibility needs or private notes).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared trip plan", robots: { index: false, follow: false }, referrer: "no-referrer" };

const OPTION_LABEL = { budget: "Budget-friendly", balanced: "Balanced", premium: "Premium" } as const;
const TIME = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const plan = await getSharedPlan((await params).token);
  if (!plan) notFound();
  const [summary, ...checks] = plan.summary.split("\n");
  return (
    <PageShell>
      <header className="mt-2 mb-6 max-w-measure">
        <p className="t-meta text-ochre-700 m-0">Shared trip plan</p>
        <h1 className="t-heading-1 mt-2 m-0">{plan.title}</h1>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">
          {plan.startDate ? `${formatDay(plan.startDate)}${plan.endDate ? ` to ${formatDay(plan.endDate)}` : ""} · ` : ""}{plan.days.length} days · Made with the <Link href="/trip-planner" className="text-marine-600 underline">Travel Notes Trip Planner</Link>
        </p>
      </header>
      {summary && <p className="t-body max-w-measure">{summary}</p>}
      {checks.length > 0 && <ul className="t-body-sm max-w-measure pl-5">{checks.map((c) => <li key={c}>{c.replace(/^•\s*/, "")}</li>)}</ul>}
      <ol className="list-none m-0 mt-6 p-0 grid gap-6 max-w-[860px]">
        {plan.days.map((d, i) => (
          <li key={i} className="border-t border-paper-200 pt-4">
            <h2 className="t-heading-3 m-0">Day {i + 1}{d.date ? ` · ${formatDay(d.date)}` : ""}{d.title ? ` · ${d.title}` : ""}</h2>
            {d.overnight && <p className="t-body-sm text-ink-600 m-0">Overnight: {d.overnight}</p>}
            {d.transport && <p className="t-body-sm text-ink-600 m-0">Getting around: {d.transport}</p>}
            <ul className="list-none m-0 mt-2 p-0 grid gap-2">
              {d.stops.map((s, j) => (
                <li key={j} className="t-body-sm">
                  {s.timeOfDay && <span className="text-ink-600">{TIME[s.timeOfDay]}: </span>}<strong>{s.title}</strong>{s.place ? ` · ${s.place}` : ""}
                  {s.notes && <><br />{s.notes}</>}
                  {s.origin === "ai_idea" && <><br /><span className="text-ochre-700">AI idea, not checked by Travel Notes</span></>}
                  {s.origin === "travel_notes" && s.sourcePath && <><br /><Link href={s.sourcePath} className="text-marine-600 underline">From Travel Notes</Link></>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {plan.options.length > 0 && (
        <section className="mt-10 max-w-[860px]" aria-labelledby="opt-h">
          <h2 id="opt-h" className="t-heading-2 m-0">Three ways to do this trip</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">{plan.options.map((o) => <div key={o.style} className="border border-paper-200 rounded-md p-4"><h3 className="t-card-title m-0">{OPTION_LABEL[o.style]}</h3><p className="t-body-sm mt-2 mb-0">{o.summary}</p><p className="t-body-sm mt-2 mb-0 whitespace-pre-line">{o.choices}</p></div>)}</div>
        </section>
      )}
      <p className="t-body-sm text-ink-600 mt-10 max-w-measure">This plan was written with AI from Travel Notes content{plan.generatedAt ? ` on ${formatDay(plan.generatedAt)}` : ""}. Check prices, opening hours, bookings and entry rules with official sources before you travel.</p>
    </PageShell>
  );
}
