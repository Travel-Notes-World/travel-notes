import Link from "next/link";

/**
 * Marks a route that exists so navigation never 404s, but whose feature is NOT built yet.
 * Do not count pages using this as completed features.
 */
export function ComingSoon({ area, title, summary, needs }: { area: string; title: string; summary: string; needs: string[] }) {
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12">
      <p className="t-meta text-ink-400 m-0">{area}</p>
      <h1 className="t-heading-1 mt-2 m-0">{title}</h1>
      <p className="t-deck mt-3 max-w-measure">{summary}</p>
      <div role="status" className="mt-6 max-w-measure border border-ochre-500 bg-ochre-100 rounded-md p-4">
        <p className="t-meta text-ochre-700 m-0">Coming soon</p>
        <p className="t-body-sm mt-1 m-0">This page is a placeholder. It is not live yet because it depends on:</p>
        <ul className="t-body-sm mt-2 mb-0 pl-6">{needs.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
      <p className="mt-8"><Link href="/" className="t-ui text-marine-600">Back to the homepage</Link></p>
    </div>
  );
}
