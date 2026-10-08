import Link from "next/link";
import type { ReactNode } from "react";

import { Placeholder } from "@/components/Placeholder";
import { SoonPill } from "@/components/SiteHeader";
import { IMAGES, destinations } from "@/content/sample";
import { TRAVEL_STYLES } from "@/lib/community/constants";
import { getCommunityHighlights } from "@/lib/content/home";
import { getLatestStories, type Story } from "@/lib/content/stories";

/**
 * Homepage, built to the "Homepage 1a" design (8 Oct 2026).
 *
 * Every number, title, author and post shown here comes from the CMS or the community database.
 * Sections for features that are not built yet (videos, photos, hidden gems, world map, AI trip
 * planner, business directory, newsletter sign-up) are shown with a "Coming soon" label and
 * contain no example content presented as real.
 */
export const revalidate = 300;

const wrap = "mx-auto max-w-wide px-4 md:px-8 xl:px-14";
const navy = "text-navy-900";
const h2 = `m-0 font-display font-medium ${navy} tracking-[-1px] text-[30px] md:text-[40px] leading-[1.1]`;
const h2small = `m-0 font-display font-medium ${navy} tracking-[-0.5px] text-[28px] md:text-[34px] leading-[1.15]`;
const chip = "inline-flex items-center text-[12.5px] font-medium text-navy-900 bg-white border border-line-400 rounded-full px-[13px] py-[6px] no-underline hover:border-marine-600 hover:text-marine-600";
const goldButton = "inline-flex items-center justify-center text-[15px] font-semibold text-[#0b3c5d] bg-ochre-500 hover:bg-ochre-600 px-[26px] py-[13px] rounded-[9px] no-underline";
const outlineButton = "inline-flex items-center justify-center text-[15px] font-semibold text-navy-900 border-[1.5px] border-navy-900 px-[26px] py-[12px] rounded-[9px] no-underline hover:bg-navy-900 hover:text-white";
const textLink = "text-[14.5px] font-semibold text-marine-600 hover:text-navy-900 no-underline";

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(iso));

function Eyebrow({ children, tone = "teal", className = "" }: { children: ReactNode; tone?: "teal" | "gold"; className?: string }) {
  return <p className={`m-0 mb-[10px] text-[12px] font-semibold tracking-[2px] uppercase ${tone === "gold" ? "text-[#d4a017]" : "text-marine-600"} ${className}`}>{children}</p>;
}

function ComingSoonBadge({ onDark = false }: { onDark?: boolean }) {
  return <span className={`inline-flex items-center text-[11px] font-semibold tracking-[1.5px] uppercase rounded-full px-3 py-[5px] ${onDark ? "bg-paper-100 text-marine-600" : "bg-marine-600 text-white"}`}>Coming soon</span>;
}

function SectionHead({ eyebrow, title, link }: { eyebrow?: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className={h2}>{title}</h2>
      </div>
      {link && <Link href={link.href} className={textLink}>{link.label} <span aria-hidden="true">→</span></Link>}
    </div>
  );
}

const ways: { href: string; label: string }[] = [
  { href: "/topics/itineraries", label: "Itineraries" },
  { href: "/topics/tips", label: "Practical tips" },
  { href: "/topics/budget", label: "Budget travel" },
  { href: "/topics/gear", label: "Gear" },
  ...TRAVEL_STYLES.filter((s) => s.value !== "business").map((s) => ({ href: `/search?style=${s.value}`, label: s.label })),
];

const heroLinks: { href: string; label: string }[] = [
  { href: "/destinations", label: "Destinations" },
  { href: "/topics/itineraries", label: "Itineraries" },
  { href: "/topics/budget", label: "Budget travel" },
  { href: "/community/questions", label: "Traveller questions" },
  { href: "/community/trips", label: "Trip reports" },
  { href: "/activities", label: "Activities" },
];

const hubParts: [string, string][] = [
  ["Attractions", "What is genuinely worth your time, and what isn’t."],
  ["Hotels", "Where to stay by area, style and budget."],
  ["Restaurants", "Local picks, not tourist traps."],
  ["Things to Do", "Experiences recommended by travellers who have been."],
  ["Transport", "Getting there and around, step by step."],
  ["Safety & Costs", "Current prices, scams to avoid, real budgets."],
  ["Best Time to Visit", "Month-by-month weather and crowds."],
  ["FAQs", "Straight answers to the questions everyone asks."],
];

const commitments: [string, string, string][] = [
  ["/editorial-policy", "Editorial standards", "How we choose, write and check what we publish."],
  ["/corrections", "Corrections", "How to report an error, and how fixes are recorded."],
  ["/about", "Who we are", "Who publishes Travel Notes, and how to reach us."],
  ["/guides", "Dated guides", "Every guide shows when it was published and last updated."],
  ["/affiliate-disclosure", "Affiliate disclosure", "Which links earn a commission, and how they are labelled."],
  ["/privacy", "Privacy", "What data we collect, why, and your choices."],
];

function GuideMeta({ story, light = false }: { story: Story; light?: boolean }) {
  return (
    <span className={`text-[12.5px] ${light ? "text-white/85" : "text-ink-400"}`}>
      {story.author.name} · {story.readMinutes} min · Updated {fmt(story.updated)}
    </span>
  );
}

export default async function HomePage() {
  const [stories, community] = await Promise.all([getLatestStories(4), getCommunityHighlights()]);
  const realStories = stories.filter((s) => !s.isSample);
  const latest = realStories[0];
  const [flagship, ...more] = stories;
  const hero = IMAGES.tasmania;

  return (
    <>
      {/* HERO */}
      <section className="bg-paper-100">
        <div className="mx-auto max-w-wide grid grid-cols-1 lg:grid-cols-[600px_1fr]">
          <div className="min-w-0 px-4 md:px-8 xl:pl-14 xl:pr-0 py-12 lg:py-[72px] flex flex-col justify-center gap-[26px]">
            <p className="m-0 flex items-center gap-[10px] text-[12px] font-semibold tracking-[2px] uppercase text-marine-600">
              <span aria-hidden="true" className="inline-block w-7 h-px bg-marine-600" />Plan with confidence
            </p>
            <h1 className="m-0 font-display font-medium text-[42px] md:text-[62px] leading-[1.06] tracking-[-1.5px] text-navy-900 [text-wrap:balance]">Travel knowledge you can actually trust.</h1>
            <p className="m-0 text-[18px] leading-[1.6] text-ink-600 max-w-[480px] [text-wrap:pretty]">
              Expert-written guides and real traveller knowledge for trips anywhere in the world, with every guide dated so you know how current it is. AI trip planning is coming soon.
            </p>
            <div className="flex flex-col gap-3 max-w-[520px]">
              <form action="/search" method="get" role="search" className="flex items-center gap-3 bg-white border border-line-400 rounded-[12px] py-[6px] pr-[6px] pl-[18px] shadow-[0_4px_18px_rgba(11,60,93,.07)] focus-within:border-marine-600">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0"><circle cx="8" cy="8" r="6" stroke="#0B3C5D" strokeWidth="1.8" /><line x1="12.5" y1="12.5" x2="17" y2="17" stroke="#0B3C5D" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <label htmlFor="home-search" className="sr-only">Search Travel Notes</label>
                <input id="home-search" name="q" type="search" placeholder="Search countries, cities, things to do…" className="flex-1 min-w-0 min-h-11 bg-transparent text-[15.5px] text-ink-900 placeholder:text-ink-400 outline-none" />
                <button type="submit" className="text-[14.5px] font-semibold text-white bg-marine-600 hover:bg-navy-900 px-[22px] py-[11px] rounded-[9px]">Search</button>
              </form>
              <ul className="flex flex-wrap gap-2 list-none m-0 p-0" aria-label="Popular starting points">
                {heroLinks.map((l) => <li key={l.href}><Link href={l.href} className={chip}>{l.label}</Link></li>)}
              </ul>
            </div>
            <div className="flex flex-wrap gap-[14px] mt-1">
              <Link href="/destinations" className={goldButton}>Explore Destinations</Link>
              <Link href="/account/trips" className={outlineButton}>Plan My Trip</Link>
            </div>
          </div>
          <div className="relative mx-4 md:mx-8 mb-10 lg:mt-10 lg:ml-12 xl:mr-14">
            <figure className="m-0">
              <Placeholder image={hero} tone="#c9d8de" alt={hero.alt} priority className="block w-full h-[300px] md:h-[420px] lg:h-[520px] rounded-[16px]" />
              <figcaption className="mt-2 text-[11.5px] text-ink-400 text-right">
                Cradle Mountain, Tasmania. Photo: {hero.author}, via Wikimedia Commons, <a href={hero.licenseUrl} rel="license" className="text-marine-600">{hero.license}</a>
              </figcaption>
            </figure>
            {latest && (
              <Link href={`/stories/${latest.slug}`} className="hidden md:flex absolute left-4 lg:-left-7 bottom-12 bg-white rounded-[12px] shadow-[0_10px_30px_rgba(11,60,93,.15)] py-[14px] px-[18px] items-center gap-3 no-underline max-w-[340px]">
                <span aria-hidden="true" className="w-11 h-11 rounded-[10px] shrink-0 bg-marine-100 grid place-items-center text-marine-600 font-display text-[20px]">✓</span>
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink-900 line-clamp-1">{latest.title}</span>
                  <span className="block text-[12px] text-ink-400">Latest guide · updated {fmt(latest.updated)}</span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* TRUST STRIP: statements that are true today, no invented totals */}
      <section aria-label="How Travel Notes works" className="bg-white border-b border-[#e8e4d8]">
        <ul className={`${wrap} list-none m-0 py-[22px] flex flex-wrap justify-center gap-x-14 gap-y-3 text-[13.5px] text-ink-600`}>
          {realStories.length >= 10 && <li className="flex items-center gap-[9px]"><Dot /><span><strong className="text-ink-900">{realStories.length}+</strong> expert-written guides</span></li>}
          <li className="flex items-center gap-[9px]"><Dot /><span>Every guide <strong className="text-ink-900">dated</strong> and kept current</span></li>
          <li className="flex items-center gap-[9px]"><Dot /><span>Traveller posts <strong className="text-ink-900">checked by a moderator</strong></span></li>
          <li className="flex items-center gap-[9px]"><Dot /><span><strong className="text-ink-900">Independent</strong> — affiliate links disclosed</span></li>
        </ul>
      </section>

      {/* POPULAR DESTINATIONS */}
      <section className="bg-white py-14 lg:pt-[72px] lg:pb-16">
        <div className={wrap}>
          <SectionHead eyebrow="Where next" title="Popular destinations" link={{ href: "/destinations", label: "All destinations" }} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
            {destinations.map((d) => (
              <li key={d.slug}>
                <Link href={`/destinations/${d.slug}`} className="group block h-full rounded-[14px] overflow-hidden border border-paper-200 no-underline text-inherit hover:shadow-[0_10px_30px_rgba(11,60,93,.10)]">
                  <Placeholder image={d.image} tone={d.tone} alt={d.alt} className="block w-full h-[220px]" />
                  <span className="block px-5 pt-[18px] pb-5">
                    <span className="block text-[11.5px] font-semibold tracking-[1.5px] uppercase text-marine-600 mb-[6px]">{d.parent}</span>
                    <span className="block font-display text-[23px] font-medium text-navy-900 mb-[10px]">{d.name}</span>
                    <span className="text-[13.5px] font-semibold text-marine-600 group-hover:text-navy-900">Explore {d.name} <span aria-hidden="true">→</span></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TRAVEL YOUR WAY: real topic pages and travel-style searches */}
      <section className="bg-paper-100 py-14">
        <div className={wrap}>
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-[26px]">
            <h2 className={`m-0 font-display font-medium text-[32px] tracking-[-0.5px] ${navy}`}>Travel your way</h2>
            <span className="text-[13.5px] text-ink-400">{ways.length} ways to explore</span>
          </div>
          <ul className="flex flex-wrap gap-3 list-none m-0 p-0">
            {ways.map((w) => (
              <li key={w.href}><Link href={w.href} className="inline-flex text-[14.5px] font-medium text-navy-900 bg-white border border-line-400 rounded-[10px] px-5 py-3 no-underline hover:border-marine-600 hover:text-marine-600">{w.label}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* FEATURED GUIDES */}
      {flagship && (
        <section className="bg-white py-14 lg:py-[72px]">
          <div className={wrap}>
            <SectionHead eyebrow="From the editors" title="Featured travel guides" link={{ href: "/guides", label: "All guides" }} />
            <div className={`grid gap-6 ${more.length ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
              <Link href={`/stories/${flagship.slug}`} className="relative block rounded-[16px] overflow-hidden min-h-[380px] lg:min-h-[460px] no-underline">
                <Placeholder image={flagship.image} tone={flagship.heroTone} alt={flagship.heroAlt} className="absolute inset-0 w-full h-full" />
                <span className="absolute inset-x-0 bottom-0 px-7 pb-[26px] pt-[120px] bg-[linear-gradient(180deg,rgba(11,60,93,0)_0%,rgba(11,60,93,.88)_60%)]">
                  <span className="block text-[11.5px] font-semibold tracking-[1.5px] uppercase text-[#d4a017] mb-2">{flagship.type}</span>
                  <span className="block font-display text-[26px] md:text-[32px] font-medium text-white leading-[1.15] mb-[10px] [text-wrap:balance]">{flagship.title}</span>
                  <GuideMeta story={flagship} light />
                </span>
              </Link>
              {more.length > 0 && (
                <ul className="flex flex-col gap-6 list-none m-0 p-0">
                  {more.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/stories/${s.slug}`} className="flex gap-4 border border-paper-200 rounded-[14px] p-[14px] no-underline text-inherit hover:border-marine-600">
                        <Placeholder image={s.image} tone={s.heroTone} alt={s.heroAlt} className="w-[110px] sm:w-[130px] h-[110px] shrink-0 rounded-[10px]" />
                        <span className="flex flex-col gap-[6px] justify-center">
                          <span className="font-display text-[19px] font-medium text-navy-900 leading-[1.25]">{s.title}</span>
                          <GuideMeta story={s} />
                          <span className="text-[13px] font-semibold text-marine-600">Read guide <span aria-hidden="true">→</span></span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* VIDEO + PHOTO EXPLORER: coming soon */}
      <section className="bg-[#0b3c5d] py-14 lg:py-[72px]">
        <div className={`${wrap} grid gap-10 lg:gap-14 lg:grid-cols-2`}>
          {[
            ["Watch", "Video explorer", "Short destination films from our own trips, linked to the guides they belong to."],
            ["See", "Photo explorer", "Photo essays and galleries with original photography, credited and described for everyone."],
          ].map(([eyebrow, title, text]) => (
            <div key={title}>
              <Eyebrow tone="gold">{eyebrow}</Eyebrow>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="m-0 font-display font-medium text-[34px] tracking-[-0.5px] text-white">{title}</h2>
                <ComingSoonBadge onDark />
              </div>
              <p className="m-0 text-[16px] leading-[1.6] text-white/80 max-w-[460px]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DESTINATION KNOWLEDGE HUB: the planned structure of destination pages */}
      <section className="bg-white py-14 lg:py-[72px]">
        <div className={wrap}>
          <div className="max-w-[760px] mb-9">
            <div className="flex flex-wrap items-center gap-3 mb-[10px]"><Eyebrow className="!mb-0">Destination knowledge hub</Eyebrow><ComingSoonBadge /></div>
            <h2 className={`${h2} mb-3`}>Everything about a place, in one page</h2>
            <p className="m-0 text-[16.5px] leading-[1.6] text-ink-600 [text-wrap:pretty]">Destination pages are growing to answer the questions travellers actually ask, structured so you (and search engines) find answers fast.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 list-none m-0 p-0">
            {hubParts.map(([title, text]) => (
              <li key={title} className="border border-paper-200 rounded-[12px] p-5">
                <p className="m-0 mb-[5px] text-[16px] font-semibold text-navy-900">{title}</p>
                <p className="m-0 text-[13.5px] leading-[1.5] text-ink-400">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* HIDDEN GEMS + WORLD EXPLORER: coming soon */}
      <section className="bg-paper-100">
        <div className={`${wrap} grid gap-10 py-14 lg:py-16 lg:grid-cols-[1fr_1.2fr]`}>
          <div>
            <Eyebrow>Editor curated</Eyebrow>
            <div className="flex flex-wrap items-center gap-3 mb-4"><h2 className={h2small}>Hidden gems</h2><ComingSoonBadge /></div>
            <p className="m-0 text-[16px] leading-[1.6] text-ink-600 max-w-[460px]">Lesser-known places our editors think deserve the trip, each with an honest guide to getting there.</p>
          </div>
          <div>
            <Eyebrow>Interactive world explorer</Eyebrow>
            <div className="flex flex-wrap items-center gap-3 mb-4"><h2 className={h2small}>Pick a continent, go deep</h2><ComingSoonBadge /></div>
            <p className="m-0 mb-4 text-[16px] leading-[1.6] text-ink-600 max-w-[520px]">A clickable world map for browsing guides and traveller posts by region. Until then, start from the destinations page.</p>
            <Link href="/destinations" className={textLink}>Browse destinations <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {/* AI PLANNER: coming soon, with a clearly labelled example */}
      <section className="bg-marine-600 py-14 lg:py-[72px]">
        <div className={`${wrap} grid gap-10 lg:gap-14 lg:grid-cols-[1fr_480px] items-center`}>
          <div>
            <div className="mb-[18px]"><ComingSoonBadge onDark /></div>
            <h2 className="m-0 mb-[14px] font-display font-medium text-[32px] md:text-[40px] tracking-[-1px] text-white [text-wrap:balance]">AI trip planning, grounded in real knowledge</h2>
            <p className="m-0 text-[16.5px] leading-[1.65] text-white/90 max-w-[520px] [text-wrap:pretty]">Tell us where, when and how you like to travel. The planner will draft an itinerary from our guides and real traveller knowledge, not generic AI guesses. Until it arrives, you can save and plan trips in My trips.</p>
            <div className="mt-[22px]"><Link href="/account/trips" className={goldButton}>Open My trips</Link></div>
          </div>
          <div className="bg-white rounded-[16px] p-[22px] shadow-[0_20px_50px_rgba(0,0,0,.2)]" aria-label="Example of a planned itinerary">
            <p className="m-0 mb-[14px] text-[13px] font-semibold text-ink-400">Example only · what a planned itinerary could look like</p>
            <ol className="flex flex-col gap-[10px] list-none m-0 p-0">
              {[
                ["Day 1", "Arrive Lisbon · Alfama walking route · sunset at a miradouro"],
                ["Day 2", "Day trip to Sintra, starting early to beat the crowds"],
                ["Day 3", "Belém pastries · LX Factory · fado in Bairro Alto"],
              ].map(([day, text]) => (
                <li key={day} className="flex gap-3 items-center bg-paper-100 rounded-[10px] px-[14px] py-3">
                  <span className="text-[12px] font-bold text-marine-600 w-11 shrink-0">{day}</span>
                  <span className="text-[14px] text-ink-900">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* DIRECTORY + TRAVEL STORIES + COMMUNITY */}
      <section className="bg-white py-14 lg:py-[72px]">
        <div className={`${wrap} grid gap-6 lg:grid-cols-3`}>
          <div className="border border-paper-200 rounded-[16px] p-7 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2"><Eyebrow className="!mb-0">Business directory</Eyebrow><SoonPill>Later</SoonPill></div>
            <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>Places to stay, eat &amp; book</h3>
            <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">Local travel, holiday and activity businesses, reviewed before they are listed. Planned for when Travel Notes is larger.</p>
            <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
              {["Hotels", "Restaurants", "Tours", "Experiences"].map((t) => <li key={t} className="text-[12px] font-medium text-navy-900 bg-paper-100 rounded-full px-3 py-[5px]">{t}</li>)}
            </ul>
          </div>

          <div className="border border-paper-200 rounded-[16px] p-7 flex flex-col gap-3">
            <Eyebrow className="!mb-0">Trip reports</Eyebrow>
            <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>Real journeys, told well</h3>
            {community.trip ? (
              <Link href={community.trip.path} className="block border-l-2 border-ochre-500 pl-[14px] no-underline text-inherit">
                <span className="block font-display italic text-[16.5px] leading-[1.55] text-ink-900 mb-2">{community.trip.title}</span>
                <span className="block text-[12.5px] text-ink-400">{community.trip.author.displayName}{community.trip.destinations[0] ? ` · ${community.trip.destinations[0].name}` : ""}</span>
              </Link>
            ) : (
              <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">First-hand trip reports from members, with real costs and day-by-day plans.</p>
            )}
            <Link href={community.trip ? "/community/trips" : "/community/trips/new"} className={`mt-auto ${textLink} text-[14px]`}>{community.trip ? "Read trip reports" : "Share your trip"} <span aria-hidden="true">→</span></Link>
          </div>

          <div className="border border-paper-200 rounded-[16px] p-7 flex flex-col gap-3 bg-paper-100">
            <div className="flex flex-wrap items-center gap-2"><Eyebrow className="!mb-0">Community</Eyebrow>{!community.open && <SoonPill>Opening soon</SoonPill>}</div>
            <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>Ask people who’ve been</h3>
            <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">Travel questions answered by travellers and locals, checked by a moderator before they appear.</p>
            {community.question && (
              <Link href={community.question.path} className="block bg-white rounded-[10px] px-[14px] py-3 border border-line-400 no-underline text-inherit hover:border-marine-600">
                <span className="block text-[13.5px] font-semibold text-ink-900 mb-[3px]">{community.question.title}</span>
                <span className="block text-[12px] text-ink-400">{community.question.replyCount === 1 ? "1 answer" : `${community.question.replyCount} answers`}</span>
              </Link>
            )}
            {community.open && <Link href={community.question ? "/community/questions" : "/community/questions/new"} className={`mt-auto ${textLink} text-[14px]`}>{community.question ? "Browse questions" : "Ask the first question"} <span aria-hidden="true">→</span></Link>}
          </div>
        </div>
      </section>

      {/* NEWSLETTER: sign-up opens once sending email is set up */}
      <section id="newsletter" className="bg-paper-100 py-16 scroll-mt-20">
        <div className="max-w-[680px] mx-auto px-4 text-center flex flex-col gap-4 items-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <h2 className={`m-0 font-display font-medium text-[30px] md:text-[36px] tracking-[-0.5px] ${navy}`}>The Field Notes newsletter</h2>
          </div>
          <p className="m-0 text-[16px] leading-[1.6] text-ink-600 [text-wrap:pretty]">One email a week: a destination worth knowing, a guide worth reading, and one hidden gem. No noise, unsubscribe anytime.</p>
          <form className="flex flex-wrap gap-[10px] w-full max-w-[460px]" aria-describedby="newsletter-note">
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input id="newsletter-email" type="email" autoComplete="email" placeholder="you@example.com" disabled className="flex-1 basis-[220px] min-h-11 text-[14.5px] bg-white border border-line-400 rounded-[9px] px-4 text-ink-900 placeholder:text-ink-400 disabled:cursor-not-allowed" />
            <button type="button" disabled className="text-[14.5px] font-semibold text-[#0b3c5d] bg-ochre-500 rounded-[9px] px-6 min-h-11 opacity-60 cursor-not-allowed">Subscribe</button>
          </form>
          <p id="newsletter-note" className="m-0 text-[12.5px] text-ink-400"><SoonPill>Soon</SoonPill> Sign-ups open shortly · <Link href="/privacy" className="text-marine-600">Privacy</Link></p>
        </div>
      </section>

      {/* OUR COMMITMENTS */}
      <section className="bg-white border-t border-paper-200 py-16">
        <div className={`${wrap} grid gap-10 lg:gap-14 lg:grid-cols-[300px_1fr]`}>
          <div>
            <h2 className={`m-0 mb-3 font-display font-medium text-[30px] tracking-[-0.5px] ${navy}`}>Why trust Travel Notes</h2>
            <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">How we keep our knowledge accurate, current and independent.</p>
          </div>
          <ul className="grid gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
            {commitments.map(([href, title, text]) => (
              <li key={href}>
                <Link href={href} className="block no-underline text-inherit group">
                  <span className="block text-[15px] font-semibold text-navy-900 mb-1 group-hover:text-marine-600">{title}</span>
                  <span className="block text-[13px] leading-[1.5] text-ink-400">{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function Dot() {
  return <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-marine-600" />;
}

