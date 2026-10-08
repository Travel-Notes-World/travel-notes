import Link from "next/link";

import navigation from "@/content/data/navigation.json";

import { HeaderAccount } from "./HeaderAccount";

/**
 * Main navigation, following the "Homepage 1a" design. Labels and links live in
 * src/content/data/navigation.json. Only pages that exist are links; items with a null href are
 * features that are not built yet and are shown with a "Soon" label instead.
 */
const { header } = navigation;

export function Logo({ onDark = false, size = 26 }: { onDark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-baseline gap-[2px] leading-none" style={{ fontSize: size }}>
      <span className={`font-display font-semibold tracking-[-0.5px] ${onDark ? "text-white" : "text-navy-900"}`}>Travel</span>
      <span className={`font-display italic font-normal ${onDark ? "text-brand-mint" : "text-marine-600"}`}>Notes</span>
    </span>
  );
}

export function SoonPill({ children = "Soon" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-marine-600 text-on-marine text-[10px] font-semibold tracking-[0.5px] uppercase px-[6px] py-[2px] leading-tight">{children}</span>;
}

const linkClass = "text-[14.5px] font-medium text-ink-900 hover:text-marine-600 no-underline whitespace-nowrap";
const subscribeClass = "items-center text-[14px] font-semibold text-on-marine bg-navy-900 hover:bg-marine-600 px-5 py-[10px] rounded-md no-underline";

function NavItems({ vertical = false }: { vertical?: boolean }) {
  return (
    <ul className={`list-none m-0 p-0 ${vertical ? "flex flex-col gap-1" : "flex items-center gap-7"}`}>
      {header.nav.map((n) => (
        <li key={n.label} className={vertical ? "py-2" : ""}>
          {n.href ? (
            <Link href={n.href} className={linkClass}>{n.label}</Link>
          ) : (
            <span className="inline-flex items-center gap-[6px] text-[14.5px] font-medium text-navy-900 whitespace-nowrap">
              <SoonPill />{n.label}<span className="sr-only"> (coming soon)</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-paper-000 border-b border-paper-200">
      <div className="mx-auto max-w-wide px-4 md:px-8 xl:px-14 h-[64px] xl:h-[76px] flex items-center gap-6 min-[1400px]:gap-9">
        <Link href="/" className="no-underline" aria-label={header.homeLabel}><Logo /></Link>
        <nav aria-label="Primary" className="hidden min-[1400px]:block">
          <NavItems />
        </nav>
        <div className="ml-auto flex items-center gap-3 xl:gap-[18px]">
          <Link href={header.businessLink.href} className={`${linkClass} hidden min-[1400px]:inline text-[14px]`}>{header.businessLink.label}</Link>
          <HeaderAccount />
          <Link href="/search" aria-label={header.searchLabel} className="grid place-items-center w-10 h-10 rounded-md border border-paper-200 text-navy-900 hover:border-marine-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" /><line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href={header.subscribe.href} className={`hidden sm:inline-flex ${subscribeClass}`}>{header.subscribe.label}</Link>
          {/* Small screens: the menu opens in place and works without JavaScript. */}
          <details className="min-[1400px]:hidden relative group">
            <summary className="list-none [&::-webkit-details-marker]:hidden grid place-items-center w-10 h-10 rounded-md border border-paper-200 text-navy-900 cursor-pointer" aria-label={header.menuLabel}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path className="group-open:hidden" d="M4 7h16M4 12h16M4 17h16" /><path className="hidden group-open:block" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </summary>
            <div className="absolute right-0 top-12 w-[min(88vw,320px)] bg-paper-000 border border-paper-200 rounded-lg shadow-[var(--shadow-card)] p-5">
              <nav aria-label="Primary">
                <NavItems vertical />
              </nav>
              <div className="mt-3 pt-3 border-t border-paper-200 flex flex-col gap-3">
                <Link href={header.businessLink.href} className={linkClass}>{header.businessLink.label}</Link>
                <Link href={header.subscribe.href} className={`sm:hidden inline-flex justify-center ${subscribeClass}`}>{header.subscribe.label}</Link>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
