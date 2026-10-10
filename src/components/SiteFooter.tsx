import Link from "next/link";

import navigation from "@/content/data/navigation.json";
import { getPublishedTopicSlugs } from "@/lib/content/topics";

import { Logo } from "./SiteHeader";

/**
 * Labels and links live in src/content/data/navigation.json. Links with a null href are features
 * that are not built yet; they are shown as "Soon", not as links. The footer stays brand navy in
 * both themes, so its white text never depends on the colour scheme. A link to a topic page
 * (/topics/…) is shown only while that topic is published, so the footer never leads to a 404.
 */
const { footer } = navigation;

export async function SiteFooter() {
  const topics = await getPublishedTopicSlugs();
  const shown = (href: string | null) => !href?.startsWith("/topics/") || topics.has(href.slice("/topics/".length));
  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto max-w-wide px-4 md:px-8 xl:px-14 pt-14 pb-8">
        <div className="grid gap-9 grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] mb-10">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="mb-3"><Logo onDark size={24} /></div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-white/70 max-w-[260px]">{footer.tagline}</p>
          </div>
          {footer.groups.map((g) => (
            <nav key={g.title} aria-label={g.title} className="flex flex-col gap-[9px] text-[13.5px]">
              <p className="m-0 mb-1 text-[12px] font-semibold tracking-[1.5px] uppercase text-brand-gold">{g.title}</p>
              {g.links.filter(({ href }) => shown(href)).map(({ href, label }) =>
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
          <span>© {new Date().getFullYear()} {footer.copyright}</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-5">
            {footer.legal.map(({ href, label }) => <Link key={href} href={href} className="text-white/60 hover:text-white no-underline">{label}</Link>)}
          </nav>
        </div>
      </div>
    </footer>
  );
}
