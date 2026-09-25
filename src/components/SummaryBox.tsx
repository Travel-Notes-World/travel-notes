export function SummaryBox({ takeaways, sections }: { takeaways: string[]; sections: { id: string; title: string }[] }) {
  return (
    <aside aria-labelledby="summary-heading" className="bg-marine-100 rounded-md p-6 max-w-measure">
      <h2 id="summary-heading" className="t-meta text-marine-700 m-0 mb-3">In short</h2>
      <ul className="m-0 mb-4 pl-6 t-body-sm text-ink-900 space-y-1">
        {takeaways.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      <details className="lg:open" open>
        <summary className="t-ui text-marine-700 cursor-pointer">Jump to a section</summary>
        <ol className="mt-2 mb-0 pl-6 t-body-sm">
          {sections.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} className="text-marine-700">{s.title}</a></li>
          ))}
        </ol>
      </details>
    </aside>
  );
}
