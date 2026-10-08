import Link from "next/link";

import { HeaderAccount } from "./HeaderAccount";

/** Main navigation. "Work with us" stays in the footer; the community brief (7 Oct 2026) puts Activities and My trips here. */
const nav = [
  { href: "/destinations", label: "Travel guides" },
  { href: "/community", label: "Community" },
  { href: "/activities", label: "Activities" },
  { href: "/account/trips", label: "My trips" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-paper-000 border-b border-paper-200">
      <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4 py-3">
        <Link href="/" className="font-display font-semibold text-[26px] leading-none tracking-[-0.3px] text-ink-900 no-underline">
          Travel Notes
        </Link>
        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 md:gap-6 list-none m-0 p-0">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="t-ui text-ink-600 hover:text-ink-900 no-underline py-2 border-b-2 border-transparent">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
        <HeaderAccount />
        <Link href="/search" aria-label="Search" className="grid place-items-center w-10 h-10 rounded-md border border-line-500 text-ink-900">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
        </div>
      </div>
    </header>
  );
}
