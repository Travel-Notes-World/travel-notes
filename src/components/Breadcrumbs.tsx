import Link from "next/link";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap gap-2 list-none m-0 p-0 t-meta text-ink-400">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            {i > 0 && <span aria-hidden="true" className="text-paper-200">/</span>}
            {it.href ? (
              <Link href={it.href} className="text-ink-400 no-underline hover:text-marine-600 hover:underline">{it.label}</Link>
            ) : (
              <span aria-current="page" className="text-ink-600">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
