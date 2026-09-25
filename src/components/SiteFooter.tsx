import Link from "next/link";

const groups: { title: string; links: [string, string][] }[] = [
  { title: "Travel guides", links: [["/destinations", "Destinations"], ["/topics/itineraries", "Itineraries"], ["/topics/tips", "Practical tips"], ["/topics/gear", "Gear reviews"]] },
  { title: "Community", links: [["/community", "Discussion groups"], ["/community/guidelines", "Community guidelines"], ["/corrections", "Corrections"]] },
  { title: "Work with us", links: [["/advertise", "Advertise"], ["/write-for-us", "Write for us"], ["/affiliate-disclosure", "Affiliate disclosure"], ["/editorial-policy", "Editorial policy"]] },
  { title: "About", links: [["/about", "About Travel Notes"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/cookie-policy", "Cookie policy"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-paper-200 bg-paper-100">
      <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 py-12 grid gap-8 md:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="font-display font-semibold text-[22px] leading-tight m-0">Travel Notes</p>
          <p className="t-body-sm text-ink-600 mt-2 max-w-[36ch]">Destination guides, itineraries and honest gear reviews, with a community of travellers comparing notes.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="t-ui text-ink-900 m-0 mb-2">{g.title}</p>
              <ul className="list-none m-0 p-0 space-y-1">
                {g.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="t-body-sm text-ink-600 hover:text-marine-600 no-underline">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
