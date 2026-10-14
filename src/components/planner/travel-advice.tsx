import type { AdviceView } from "@/lib/planner/advice";
import { SMARTRAVELLER } from "@/lib/planner/advice";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });
const TONE = { 1: "border-paper-200", 2: "border-ochre-700", 3: "border-signal-error", 4: "border-signal-error" } as const;

/**
 * Australian Government travel advice for each overseas country on the trip. Always shown first,
 * always with a link to the current advice on Smartraveller.
 */
export function TravelAdvice({ advice }: { advice: AdviceView[] }) {
  if (!advice.length) return null;
  const top = advice.reduce((m, a) => Math.max(m, a.level ?? 0), 0);
  return (
    <section aria-labelledby="advice-heading" className={`mb-8 max-w-[860px] rounded-md border-2 p-4 ${top >= 3 ? "border-signal-error" : "border-paper-200"}`} role={top >= 3 ? "alert" : undefined}>
      <h2 id="advice-heading" className="t-heading-3 m-0">{top >= 4 ? "Warning: the government advises do not travel" : top === 3 ? "Warning: reconsider your need to travel" : "Travel advice and safety"}</h2>
      <ul className="list-none m-0 mt-3 p-0 grid gap-3">
        {advice.map((a) => (
          <li key={a.countryId} className={`border-l-4 pl-3 ${a.level ? TONE[a.level] : "border-paper-200"}`}>
            <p className="t-ui m-0">{a.countryName}{a.level ? `: Level ${a.level} of 4, ${a.label}` : ""}</p>
            {a.note && <p className="t-body-sm mt-1 mb-0">{a.note}</p>}
            <p className="t-body-sm mt-1 mb-0">
              {a.checkedAt ? `Checked by Travel Notes on ${fmt(a.checkedAt)}. ` : "Travel Notes has not recorded the advice level for this country. "}
              {a.stale ? <strong>This check may be out of date. </strong> : null}
              <a href={a.url} className="text-marine-600 underline" rel="noopener noreferrer" target="_blank">Read the current advice on Smartraveller</a>
            </p>
          </li>
        ))}
      </ul>
      <p className="t-body-sm text-ink-600 mt-3 mb-0">
        Advice can change quickly, including for natural disasters, weather and unrest. Check <a href={SMARTRAVELLER} className="text-marine-600 underline" rel="noopener noreferrer" target="_blank">Smartraveller</a> before you book and again before you leave, and follow local authorities while you travel.
      </p>
    </section>
  );
}
