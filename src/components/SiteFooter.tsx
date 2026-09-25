import Link from "next/link";

const links = [
  ["/about", "About"], ["/contact", "Contact"], ["/editorial-policy", "Editorial policy"],
  ["/corrections", "Corrections"], ["/affiliate-disclosure", "Affiliate disclosure"],
  ["/advertise", "Advertise"], ["/write-for-us", "Write for us"],
  ["/privacy", "Privacy"], ["/terms", "Terms"], ["/cookie-policy", "Cookie policy"],
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-paper-200 bg-paper-100">
      <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 py-12 grid gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="font-display font-semibold text-[22px] leading-tight m-0">Travel Notes</p>
          <p className="t-body-sm text-ink-600 mt-2 max-w-[36ch]">
            Destination guides, itineraries and honest gear reviews.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 list-none m-0 p-0">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="t-body-sm text-ink-600 hover:text-marine-600 no-underline">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
