import type { DocModel } from "@/lib/planner/document";

/** The document as it will appear in the PDF, for checking before downloading. */
export function DocumentPreview({ doc }: { doc: DocModel }) {
  return (
    <article className="max-w-[794px] bg-paper-000 border border-paper-200 rounded-md p-6 md:p-10 shadow-[var(--shadow-card)]" aria-label="Document preview">
      <p className="t-meta text-marine-600 m-0">Travel Notes · Trip Planner</p>
      <h2 className="t-heading-2 mt-2 mb-0">{doc.title}</h2>
      <p className="t-body-sm text-ink-600 mt-1 mb-0">{doc.subtitle}</p>
      <dl className="mt-5 grid sm:grid-cols-[14rem_1fr] gap-x-4 t-body-sm border-t border-paper-200">
        {doc.facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="font-semibold py-2 border-b border-paper-200">{f.label}</dt>
            <dd className="m-0 py-2 border-b border-paper-200 whitespace-pre-line">{f.value}</dd>
          </div>
        ))}
      </dl>
      {doc.layout === "visa" ? (
        <>
          <h3 className="t-heading-3 mt-6 mb-2">Daily itinerary</h3>
          <div className="overflow-x-auto">
            <table className="w-full t-body-sm border-collapse min-w-[560px]">
              <thead><tr className="bg-paper-100 text-left">{["Date", "City / overnight", "Planned activities", "Arrangement"].map((h) => <th key={h} scope="col" className="p-2 border border-paper-200">{h}</th>)}</tr></thead>
              <tbody>
                {doc.days.map((d) => (
                  <tr key={d.number}>
                    <td className="p-2 border border-paper-200">{d.dateLabel || `Day ${d.number}`}</td>
                    <td className="p-2 border border-paper-200">{d.overnight || d.title || "—"}</td>
                    <td className="p-2 border border-paper-200">{d.stops.map((s) => s.title).join("; ") || "—"}</td>
                    <td className="p-2 border border-paper-200">{d.overnightStatus === "confirmed" ? "Confirmed (provided by the traveller)" : "Proposed – to be confirmed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {doc.advice.length > 0 && <><h3 className="t-heading-3 mt-6 mb-2">Australian Government travel advice (Smartraveller)</h3><ul className="t-body-sm m-0 pl-5">{doc.advice.map((c) => <li key={c} className="break-words">{c}</li>)}</ul></>}
          {doc.summary.map((t, i) => <p key={i} className="t-body-sm mt-5 mb-0">{t}</p>)}
          {doc.checks.length > 0 && <><h3 className="t-heading-3 mt-6 mb-2">Check before you go</h3><ul className="t-body-sm m-0 pl-5">{doc.checks.map((c) => <li key={c}>{c}</li>)}</ul></>}
          {doc.legs.length > 0 && <><h3 className="t-heading-3 mt-6 mb-2">Distances between places</h3><ul className="t-body-sm m-0 pl-5">{doc.legs.map((c) => <li key={c}>{c}</li>)}</ul></>}
          <h3 className="t-heading-3 mt-6 mb-0">Day by day</h3>
          {doc.days.map((d) => (
            <section key={d.number} className="mt-4 pt-3 border-t border-paper-200">
              <h4 className="t-ui m-0">Day {d.number}{d.dateLabel ? ` · ${d.dateLabel}` : ""}{d.title ? ` · ${d.title}` : ""}</h4>
              {d.overnight && <p className="t-body-sm text-ink-600 m-0">Overnight: {d.overnight} ({d.overnightStatus === "confirmed" ? "booked by you" : "proposed"})</p>}
              {d.transport && <p className="t-body-sm text-ink-600 m-0">Getting around: {d.transport}</p>}
              <ul className="list-none m-0 mt-2 p-0 grid gap-2">
                {d.stops.map((s, i) => (
                  <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-2 t-body-sm">
                    <span className="text-ink-600">{s.time}</span>
                    <span><strong>{s.title}</strong>{s.place ? ` · ${s.place}` : ""}{s.notes ? <><br />{s.notes}</> : null}{s.label ? <><br /><span className={s.label.startsWith("AI") ? "text-ochre-700" : "text-marine-600"}>{s.label}</span></> : null}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {doc.options.length > 0 && (
            <>
              <h3 className="t-heading-3 mt-6 mb-2">Three ways to do this trip</h3>
              {doc.options.map((o) => <div key={o.label} className="mt-3"><p className="t-ui m-0">{o.label}</p><p className="t-body-sm m-0">{o.summary}</p><ul className="t-body-sm m-0 pl-5">{o.choices.map((c) => <li key={c}>{c}</li>)}</ul></div>)}
            </>
          )}
          {doc.budget.length > 0 && <><h3 className="t-heading-3 mt-6 mb-2">Budget</h3>{doc.budget.map((t) => <p key={t} className="t-body-sm m-0">{t}</p>)}</>}
          {doc.sources.length > 0 && <><h3 className="t-heading-3 mt-6 mb-2">Where the prices come from</h3><ul className="t-body-sm m-0 pl-5">{doc.sources.map((c) => <li key={c} className="break-words">{c}</li>)}</ul></>}
        </>
      )}
      <p className="t-body-sm text-ink-600 mt-6 mb-0 border border-paper-200 rounded-sm p-3">{doc.disclaimer}</p>
      <p className="t-meta text-ink-400 mt-4 mb-0">Made on {doc.generatedOn} · {doc.site} · page numbers are added in the PDF</p>
    </article>
  );
}
