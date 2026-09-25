import Link from "next/link";

const nav = [
  { href: "/destinations", label: "Destinations" },
  { href: "/topics/itineraries", label: "Itineraries" },
  { href: "/topics/tips", label: "Tips" },
  { href: "/topics/gear", label: "Gear" },
  { href: "/photos", label: "Photos" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-paper-000 border-b border-paper-200">
      <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4 py-3">
        <Link href="/" className="font-display font-semibold text-[26px] leading-none tracking-[-0.3px] text-ink-900 no-underline">
          Travel Notes
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex gap-6 list-none m-0 p-0">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="t-ui text-ink-600 hover:text-ink-900 no-underline py-2 border-b-2 border-transparent">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/search"
          aria-label="Search"
          className="grid place-items-center w-10 h-10 rounded-md border border-line-500 text-ink-900"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
