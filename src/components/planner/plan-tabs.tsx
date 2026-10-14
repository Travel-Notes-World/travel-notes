import Link from "next/link";

export type PlanTab = { key: string; label: string };

/**
 * The plan's sections: Overview, Budget, each day, Nearby and Documents. Plain links (each one is
 * its own address), so they work without JavaScript and the back button behaves as expected.
 * On a phone the row scrolls sideways inside itself, never the page.
 */
export function PlanTabs({ id, tabs, current }: { id: string; tabs: PlanTab[]; current: string }) {
  return (
    <nav aria-label="Plan sections" className="mb-8 -mx-4 px-4 overflow-x-auto border-b border-paper-200 print:hidden">
      <ul className="list-none m-0 p-0 flex gap-1 min-w-max">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <Link
                href={`/account/trips/${id}?view=${t.key}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={`inline-flex items-center min-h-11 px-3 t-ui no-underline border-b-2 ${active ? "border-marine-600 text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
