import Link from "next/link";

import { Logo } from "./SiteHeader";

/** Links without an address are features that are not built yet; they are shown as "Soon", not as links. */
const groups: { title: string; links: [string | null, string][] }[] = [
  { title: "Explore", links: [["/destinations", "Destinations"], ["/guides", "Travel Guides"], ["/topics/itineraries", "Itineraries"], ["/topics/tips", "Practical tips"], [null, "Photography"], [null, "Videos"], [null, "Hidden Gems"]] },
  { title: "Community", links: [["/community/questions", "Ask Travellers"], ["/community/trips", "Trip Reports"], ["/activities", "Activities"], ["/community/guidelines", "Community guidelines"], ["/write-for-us", "Write for Us"]] },
  { title: "Business", links: [["/advertise", "Advertise"], [null, "Business Directory"]] },
  { title: "Company", links: [["/about", "About"], ["/editorial-policy", "Editorial Standards"], ["/corrections", "Corrections"], ["/contact", "Contact"]] },
];

const legal: [string, string][] = [["/privacy", "Privacy"], ["/terms", "Terms"], ["/cookie-policy", "Cookies"], ["/affiliate-disclosure", "Affiliate Disclosure"]];

export function SiteFooter() {
  return (
    <footer className="bg-[#0b3c5d] text-white">
      <div className="mx-auto max-w-wide px-4 md:px-8 xl:px-14 pt-14 pb-8">
        <div className="grid gap-9 grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] mb-10">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="mb-3"><Logo onDark size={24} /></div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-white/70 max-w-[260px]">The travel knowledge platform. Expert guides, real traveller insight and, soon, AI trip planning.</p>
          </div>
          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title} className="flex flex-col gap-[9px] text-[13.5px]">
              <p className="m-0 mb-1 text-[12px] font-semibold tracking-[1.5px] uppercase text-[#d4a017]">{g.title}</p>
              {g.links.map(([href, label]) =>
                href ? (
                  <Link key={label} href={href} className="text-white/80 hover:text-white no-underline">{label}</Link>
                ) : (
                  <span key={label} className="text-white/55">{label} <span className="text-[10px] font-semibold tracking-[0.5px] uppercase text-white/70 border border-white/30 rounded-full px-[6px] py-[1px] ml-1">Soon</span></span>
                ),
              )}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 justify-between items-center pt-[22px] border-t border-white/15 text-[12.5px] text-white/60">
          <span>© {new Date().getFullYear()} Travel Notes. All rights reserved.</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-5">
            {legal.map(([href, label]) => <Link key={href} href={href} className="text-white/60 hover:text-white no-underline">{label}</Link>)}
          </nav>
        </div>
      </div>
    </footer>
  );
}
