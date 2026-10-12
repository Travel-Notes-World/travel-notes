/**
 * The steps to list a business activity, shown on the "List your activity" page, the form and the
 * payment page, so people always know where they are and what comes next.
 */
export const LISTING_STEPS = [
  { title: "Create a free account", text: "Sign up with your email and confirm it." },
  { title: "Describe your activity", text: "What it is, who it suits and the places it is in." },
  { title: "Add date, place and price", text: "In the event’s local time, with a booking link." },
  { title: "Pay the listing fee", text: "On Stripe’s secure page. Refunded if not approved." },
  { title: "We check it and publish it", text: "A person reviews every listing before it goes live." },
] as const;

export function ListingSteps({ current, compact = false }: { current?: number; compact?: boolean }) {
  return (
    <nav aria-label="Steps to list an activity" className={compact ? "mb-6" : "mb-8"}>
      <ol className="list-none m-0 p-0 grid gap-2 sm:grid-cols-5">
        {LISTING_STEPS.map((step, i) => {
          const n = i + 1;
          const state = current === undefined ? "todo" : n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li
              key={step.title}
              aria-current={state === "current" ? "step" : undefined}
              className={`rounded-md border p-3 ${state === "current" ? "border-marine-600 bg-paper-100" : "border-paper-200 bg-paper-000"}`}
            >
              <p className="t-meta m-0 text-ink-600">
                <span aria-hidden="true">{state === "done" ? "✓ " : ""}</span>Step {n}
                <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (you are here)" : ""}</span>
              </p>
              <p className="t-ui m-0 mt-1">{step.title}</p>
              {!compact && <p className="t-body-sm text-ink-600 m-0 mt-1">{step.text}</p>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
