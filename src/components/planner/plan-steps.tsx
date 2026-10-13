import Link from "next/link";

export type PlanStep = { label: string; hint: string; done: boolean; href: string };

/**
 * Where the member is in their plan: three steps, the current one highlighted, finished ones
 * ticked. Each step links to its part of the page.
 */
export function PlanSteps({ steps }: { steps: PlanStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <nav aria-label="Your plan, step by step" className="mb-8 max-w-[860px]">
      <ol className="list-none m-0 p-0 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const active = i === current;
          return (
            <li key={s.label}>
              <Link
                href={s.href}
                aria-current={active ? "step" : undefined}
                className={`flex h-full items-start gap-3 rounded-md border-2 p-3 no-underline ${active ? "border-marine-600 bg-marine-100" : "border-paper-200 bg-paper-000"} hover:border-marine-600`}
              >
                <span aria-hidden="true" className={`grid place-items-center w-7 h-7 shrink-0 rounded-full t-ui ${s.done ? "bg-marine-600 text-on-marine" : active ? "bg-navy-900 text-on-marine" : "bg-paper-200 text-ink-600"}`}>{s.done ? "✓" : i + 1}</span>
                <span>
                  <span className="t-ui text-ink-900 block">{s.label}<span className="sr-only">{s.done ? " (done)" : active ? " (next step)" : ""}</span></span>
                  <span className="t-body-sm text-ink-600">{s.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
