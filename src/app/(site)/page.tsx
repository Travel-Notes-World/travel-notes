import Link from "next/link";
import type { ReactNode } from "react";

import { Placeholder } from "@/components/Placeholder";
import { SoonPill } from "@/components/SiteHeader";
import home from "@/content/data/home.json";
import { destinations, sampleImage } from "@/content/sample";
import { TRAVEL_STYLES } from "@/lib/community/constants";
import { getCommunityHighlights } from "@/lib/content/home";
import { getLatestStories, type Story } from "@/lib/content/stories";

/**
 * Homepage, built to the "Homepage 1a" design (8 Oct 2026).
 *
 * Fixed wording (headings, descriptions, link lists) lives in src/content/data/home.json. Every
 * number, title, author and post shown here comes from the CMS or the community database.
 * Sections for features that are not built yet (videos, photos, hidden gems, world map, AI trip
 * planner, business directory, newsletter sign-up) are shown with a "Coming soon" label and
 * contain no example content presented as real.
 *
 * Colours: theme tokens (paper, ink, navy-900, marine) follow the visitor's light/dark setting.
 * The brand-* colours are fixed and only used for bands that stay dark in both themes.
 */
export const revalidate = 300;

const wrap = "mx-auto max-w-wide px-4 md:px-8 xl:px-14";
const navy = "text-navy-900";
const h2 = `m-0 font-display font-medium ${navy} tracking-[-1px] text-[30px] md:text-[40px] leading-[1.1]`;
const h2small = `m-0 font-display font-medium ${navy} tracking-[-0.5px] text-[28px] md:text-[34px] leading-[1.15]`;
const chip = "inline-flex items-center text-[12.5px] font-medium text-navy-900 bg-paper-000 border border-line-400 rounded-full px-3.25 py-1.5 no-underline hover:border-marine-600 hover:text-marine-600";
const goldButton = "inline-flex items-center justify-center text-[15px] font-semibold text-brand-navy bg-ochre-500 hover:bg-ochre-600 px-6.5 py-3.25 rounded-[9px] no-underline";
const outlineButton = "inline-flex items-center justify-center text-[15px] font-semibold text-navy-900 border-[1.5px] border-navy-900 px-6.5 py-3 rounded-[9px] no-underline hover:bg-navy-900 hover:text-on-marine";
const textLink = "text-[14.5px] font-semibold text-marine-600 hover:text-navy-900 no-underline";

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(iso));

function Eyebrow({ children, tone = "teal", className = "" }: { children: ReactNode; tone?: "teal" | "gold"; className?: string }) {
  return <p className={`m-0 mb-2.5 text-[12px] font-semibold tracking-[2px] uppercase ${tone === "gold" ? "text-brand-gold" : "text-marine-600"} ${className}`}>{children}</p>;
}

function ComingSoonBadge({ onDark = false }: { onDark?: boolean }) {
  return <span className={`inline-flex items-center text-[11px] font-semibold tracking-[1.5px] uppercase rounded-full px-3 py-1.25 ${onDark ? "bg-paper-100 text-marine-600" : "bg-marine-600 text-on-marine"}`}>{home.comingSoonLabel}</span>;
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
  ...home.ways.topics,
  ...TRAVEL_STYLES.filter((s) => !home.ways.excludedTravelStyles.includes(s.value)).map((s) => ({ href: `/search?style=${s.value}`, label: s.label })),
];

function GuideMeta({ story, light = false }: { story: Story; light?: boolean }) {
  return (
    <span className={`text-[12.5px] ${light ? "text-white/85" : "text-ink-400"}`}>
      {story.author.name} · {story.readMinutes} {home.guides.minutesLabel} · {home.guides.updatedLabel} {fmt(story.updated)}
    </span>
  );
}

export default async function HomePage() {
  const [stories, community] = await Promise.all([getLatestStories(4), getCommunityHighlights()]);
  const realStories = stories.filter((s) => !s.isSample);
  const latest = realStories[0];
  const [flagship, ...more] = stories;
  const { hero: heroText } = home;
  const hero = sampleImage(heroText.image);
  const tripCta = community.trip ? home.tripReports.browse : home.tripReports.create;
  const questionCta = community.question ? home.community.browse : home.community.create;

  return (
    <>
      {/* HERO */}
      <section className="bg-paper-100">
        <div className="mx-auto max-w-wide grid grid-cols-1 lg:grid-cols-[600px_1fr]">
          <div className="min-w-0 px-4 md:px-8 xl:pl-14 xl:pr-0 py-12 lg:py-18 flex flex-col justify-center gap-6.5">
            <p className="m-0 flex items-center gap-2.5 text-[12px] font-semibold tracking-[2px] uppercase text-marine-600">
              <span aria-hidden="true" className="inline-block w-7 h-px bg-marine-600" />{heroText.eyebrow}
            </p>
            <h1 className="m-0 font-display font-medium text-[42px] md:text-[62px] leading-[1.06] tracking-[-1.5px] text-navy-900 text-balance">{heroText.title}</h1>
            <p className="m-0 text-[18px] leading-[1.6] text-ink-600 max-w-120 text-pretty">{heroText.intro}</p>
            <div className="flex flex-col gap-3 max-w-130">
              <form action="/search" method="get" role="search" className="flex items-center gap-3 bg-paper-000 border border-line-400 rounded-xl py-1.5 pr-1.5 pl-4.5 shadow-[0_4px_18px_rgba(11,60,93,.07)] focus-within:border-marine-600">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-navy-900"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" /><line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <label htmlFor="home-search" className="sr-only">{heroText.search.label}</label>
                <input id="home-search" name="q" type="search" placeholder={heroText.search.placeholder} className="flex-1 min-w-0 min-h-11 bg-transparent text-[15.5px] text-ink-900 placeholder:text-ink-400 outline-none" />
                <button type="submit" className="text-[14.5px] font-semibold text-on-marine bg-marine-600 hover:bg-navy-900 px-5.5 py-2.75 rounded-[9px]">{heroText.search.button}</button>
              </form>
              <ul className="flex flex-wrap gap-2 list-none m-0 p-0" aria-label={heroText.quickLinksLabel}>
                {heroText.quickLinks.map((l) => <li key={l.href}><Link href={l.href} className={chip}>{l.label}</Link></li>)}
              </ul>
            </div>
            <div className="flex flex-wrap gap-3.5 mt-1">
              <Link href={heroText.primaryCta.href} className={goldButton}>{heroText.primaryCta.label}</Link>
              <Link href={heroText.secondaryCta.href} className={outlineButton}>{heroText.secondaryCta.label}</Link>
            </div>
          </div>
          <div className="relative mx-4 md:mx-8 mb-10 lg:mt-10 lg:ml-12 xl:mr-14">
            <figure className="m-0">
              <Placeholder image={hero} tone={heroText.imageTone} alt={hero.alt} priority className="block w-full h-[300px] md:h-105 lg:h-130 rounded-2xl" />
              <figcaption className="mt-2 text-[11.5px] text-ink-400 text-right">
                {heroText.imageCaption}. Photo: {hero.author}, via Wikimedia Commons, <a href={hero.licenseUrl} rel="license" className="text-marine-600">{hero.license}</a>
              </figcaption>
            </figure>
            {latest && (
              <Link href={`/stories/${latest.slug}`} className="hidden md:flex absolute left-4 lg:-left-7 bottom-12 bg-paper-000 rounded-xl shadow-card py-3.5 px-4.5 items-center gap-3 no-underline max-w-85">
                <span aria-hidden="true" className="w-11 h-11 rounded-[10px] shrink-0 bg-marine-100 grid place-items-center text-marine-600 font-display text-[20px]">✓</span>
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink-900 line-clamp-1">{latest.title}</span>
                  <span className="block text-[12px] text-ink-400">{heroText.latestGuideLabel} {fmt(latest.updated)}</span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* TRUST STRIP: statements that are true today, no invented totals */}
      <section aria-label={home.trust.label} className="bg-paper-000 border-b border-paper-200">
        <ul className={`${wrap} list-none m-0 py-5.5 flex flex-wrap justify-center gap-x-14 gap-y-3 text-[13.5px] text-ink-600`}>
          {realStories.length >= home.trust.guideCount.minimum && <li className="flex items-center gap-2.25"><Dot /><span><strong className="text-ink-900">{realStories.length}+</strong> {home.trust.guideCount.text}</span></li>}
          {home.trust.items.map((t) => (
            <li key={t.strong} className="flex items-center gap-2.25"><Dot /><span>{t.before}<strong className="text-ink-900">{t.strong}</strong>{t.after}</span></li>
          ))}
        </ul>
      </section>

      {/* POPULAR DESTINATIONS */}
      <section className="bg-paper-000 py-14 lg:pt-18 lg:pb-16">
        <div className={wrap}>
          <SectionHead eyebrow={home.destinations.eyebrow} title={home.destinations.title} link={home.destinations.link} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
            {destinations.map((d) => (
              <li key={d.slug}>
                <Link href={`/destinations/${d.slug}`} className="group block h-full rounded-xl overflow-hidden border border-paper-200 no-underline text-inherit hover:shadow-[0_10px_30px_rgba(11,60,93,.10)]">
                  <Placeholder image={d.image} tone={d.tone} alt={d.alt} className="block w-full h-55" />
                  <span className="block px-5 pt-4.5 pb-5">
                    <span className="block text-[11.5px] font-semibold tracking-[1.5px] uppercase text-marine-600 mb-1.5">{d.parent}</span>
                    <span className="block font-display text-[23px] font-medium text-navy-900 mb-2.5">{d.name}</span>
                    <span className="text-[13.5px] font-semibold text-marine-600 group-hover:text-navy-900">{home.destinations.explorePrefix} {d.name} <span aria-hidden="true">→</span></span>
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
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6.5">
            <h2 className={`m-0 font-display font-medium text-[32px] tracking-[-0.5px] ${navy}`}>{home.ways.title}</h2>
            <span className="text-[13.5px] text-ink-400">{ways.length} {home.ways.countSuffix}</span>
          </div>
          <ul className="flex flex-wrap gap-3 list-none m-0 p-0">
            {ways.map((w) => (
              <li key={w.href}><Link href={w.href} className="inline-flex text-[14.5px] font-medium text-navy-900 bg-paper-000 border border-line-400 rounded-[10px] px-5 py-3 no-underline hover:border-marine-600 hover:text-marine-600">{w.label}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* FEATURED GUIDES */}
      {flagship && (
        <section className="bg-paper-000 py-14 lg:py-18">
          <div className={wrap}>
            <SectionHead eyebrow={home.guides.eyebrow} title={home.guides.title} link={home.guides.link} />
            <div className={`grid gap-6 ${more.length ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
              <Link href={`/stories/${flagship.slug}`} className="relative block rounded-2xl overflow-hidden min-h-95 lg:min-h-115 no-underline">
                <Placeholder image={flagship.image} tone={flagship.heroTone} alt={flagship.heroAlt} className="absolute inset-0 w-full h-full" />
                <span className="absolute inset-x-0 bottom-0 px-7 pb-6.5 pt-30 bg-[linear-gradient(180deg,rgba(11,60,93,0)_0%,rgba(11,60,93,.88)_60%)]">
                  <span className="block text-[11.5px] font-semibold tracking-[1.5px] uppercase text-brand-gold mb-2">{flagship.type}</span>
                  <span className="block font-display text-[26px] md:text-[32px] font-medium text-white leading-[1.15] mb-2.5 text-balance">{flagship.title}</span>
                  <GuideMeta story={flagship} light />
                </span>
              </Link>
              {more.length > 0 && (
                <ul className="flex flex-col gap-6 list-none m-0 p-0">
                  {more.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/stories/${s.slug}`} className="flex gap-4 border border-paper-200 rounded-xl p-3.5 no-underline text-inherit hover:border-marine-600">
                        <Placeholder image={s.image} tone={s.heroTone} alt={s.heroAlt} className="w-27.5 sm:w-32.5 h-27.5 shrink-0 rounded-[10px]" />
                        <span className="flex flex-col gap-1.5 justify-center">
                          <span className="font-display text-[19px] font-medium text-navy-900 leading-tight">{s.title}</span>
                          <GuideMeta story={s} />
                          <span className="text-[13px] font-semibold text-marine-600">{home.guides.readLabel} <span aria-hidden="true">→</span></span>
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

      {/* VIDEO + PHOTO EXPLORER: coming soon. Brand navy in both themes. */}
      <section className="bg-brand-navy py-14 lg:py-18">
        <div className={`${wrap} grid gap-10 lg:gap-14 lg:grid-cols-2`}>
          {home.explorers.map(({ eyebrow, title, text }) => (
            <div key={title}>
              <Eyebrow tone="gold">{eyebrow}</Eyebrow>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="m-0 font-display font-medium text-[34px] tracking-[-0.5px] text-white">{title}</h2>
                <ComingSoonBadge onDark />
              </div>
              <p className="m-0 text-[16px] leading-[1.6] text-white/80 max-w-115">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DESTINATION KNOWLEDGE HUB: the planned structure of destination pages */}
      <section className="bg-paper-000 py-14 lg:py-18">
        <div className={wrap}>
          <div className="max-w-190 mb-9">
            <div className="flex flex-wrap items-center gap-3 mb-2.5"><Eyebrow className="mb-0!">{home.hub.eyebrow}</Eyebrow><ComingSoonBadge /></div>
            <h2 className={`${h2} mb-3`}>{home.hub.title}</h2>
            <p className="m-0 text-[16.5px] leading-[1.6] text-ink-600 text-pretty">{home.hub.text}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 list-none m-0 p-0">
            {home.hub.parts.map(({ title, text }) => (
              <li key={title} className="border border-paper-200 rounded-xl p-5">
                <p className="m-0 mb-1.25 text-[16px] font-semibold text-navy-900">{title}</p>
                <p className="m-0 text-[13.5px] leading-normal text-ink-400">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* HIDDEN GEMS + WORLD EXPLORER: coming soon */}
      <section className="bg-paper-100">
        <div className={`${wrap} grid gap-10 py-14 lg:py-16 lg:grid-cols-[1fr_1.2fr]`}>
          <div>
            <Eyebrow>{home.hiddenGems.eyebrow}</Eyebrow>
            <div className="flex flex-wrap items-center gap-3 mb-4"><h2 className={h2small}>{home.hiddenGems.title}</h2><ComingSoonBadge /></div>
            <p className="m-0 text-[16px] leading-[1.6] text-ink-600 max-w-115">{home.hiddenGems.text}</p>
          </div>
          <div>
            <Eyebrow>{home.worldExplorer.eyebrow}</Eyebrow>
            <div className="flex flex-wrap items-center gap-3 mb-4"><h2 className={h2small}>{home.worldExplorer.title}</h2><ComingSoonBadge /></div>
            <p className="m-0 mb-4 text-[16px] leading-[1.6] text-ink-600 max-w-130">{home.worldExplorer.text}</p>
            <Link href={home.worldExplorer.link.href} className={textLink}>{home.worldExplorer.link.label} <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {/* AI PLANNER: coming soon, with a clearly labelled example. Brand teal in both themes. */}
      <section className="bg-brand-teal py-14 lg:py-18">
        <div className={`${wrap} grid gap-10 lg:gap-14 lg:grid-cols-[1fr_480px] items-center`}>
          <div>
            <div className="mb-4.5"><ComingSoonBadge onDark /></div>
            <h2 className="m-0 mb-3.5 font-display font-medium text-[32px] md:text-[40px] tracking-[-1px] text-white text-balance">{home.planner.title}</h2>
            <p className="m-0 text-[16.5px] leading-[1.65] text-white/90 max-w-130 text-pretty">{home.planner.text}</p>
            <div className="mt-5.5"><Link href={home.planner.cta.href} className={goldButton}>{home.planner.cta.label}</Link></div>
          </div>
          <div className="bg-paper-000 rounded-2xl p-5.5 shadow-[0_20px_50px_rgba(0,0,0,.2)]" aria-label={home.planner.exampleLabel}>
            <p className="m-0 mb-3.5 text-[13px] font-semibold text-ink-400">{home.planner.exampleNote}</p>
            <ol className="flex flex-col gap-2.5 list-none m-0 p-0">
              {home.planner.exampleDays.map(({ day, text }) => (
                <li key={day} className="flex gap-3 items-center bg-paper-100 rounded-[10px] px-3.5 py-3">
                  <span className="text-[12px] font-bold text-marine-600 w-11 shrink-0">{day}</span>
                  <span className="text-[14px] text-ink-900">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* DIRECTORY + TRAVEL STORIES + COMMUNITY */}
      <section className="bg-paper-000 py-14 lg:py-18">
        <div className={`${wrap} grid gap-6 lg:grid-cols-3`}>
          <div className="border border-paper-200 rounded-2xl p-7 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2"><Eyebrow className="mb-0!">{home.directory.eyebrow}</Eyebrow><SoonPill>{home.directory.badge}</SoonPill></div>
            <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>{home.directory.title}</h3>
            <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">{home.directory.text}</p>
            <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
              {home.directory.tags.map((t) => <li key={t} className="text-[12px] font-medium text-navy-900 bg-paper-100 rounded-full px-3 py-1.25">{t}</li>)}
            </ul>
          </div>

          <div className="border border-paper-200 rounded-2xl p-7 flex flex-col gap-3">
            <Eyebrow className="mb-0!">{home.tripReports.eyebrow}</Eyebrow>
            <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>{home.tripReports.title}</h3>
            {community.trip ? (
              <Link href={community.trip.path} className="block border-l-2 border-ochre-500 pl-3.5 no-underline text-inherit">
                <span className="block font-display italic text-[16.5px] leading-[1.55] text-ink-900 mb-2">{community.trip.title}</span>
                <span className="block text-[12.5px] text-ink-400">{community.trip.author.displayName}{community.trip.destinations[0] ? ` · ${community.trip.destinations[0].name}` : ""}</span>
              </Link>
            ) : (
              <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">{home.tripReports.emptyText}</p>
            )}
            <Link href={tripCta.href} className={`mt-auto ${textLink} text-[14px]`}>{tripCta.label} <span aria-hidden="true">→</span></Link>
          </div>

          <div className="border border-paper-200 rounded-2xl p-7 flex flex-col gap-3 bg-paper-100">
            <div className="flex flex-wrap items-center gap-2"><Eyebrow className="mb-0!">{home.community.eyebrow}</Eyebrow>{!community.open && <SoonPill>{home.community.closedBadge}</SoonPill>}</div>
            <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>{home.community.title}</h3>
            <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">{home.community.text}</p>
            {community.question && (
              <Link href={community.question.path} className="block bg-paper-000 rounded-[10px] px-3.5 py-3 border border-line-400 no-underline text-inherit hover:border-marine-600">
                <span className="block text-[13.5px] font-semibold text-ink-900 mb-0.75">{community.question.title}</span>
                <span className="block text-[12px] text-ink-400">{community.question.replyCount === 1 ? home.community.answerOne : `${community.question.replyCount} ${home.community.answerMany}`}</span>
              </Link>
            )}
            {community.open && <Link href={questionCta.href} className={`mt-auto ${textLink} text-[14px]`}>{questionCta.label} <span aria-hidden="true">→</span></Link>}
          </div>
        </div>
      </section>

      {/* NEWSLETTER: sign-up opens once sending email is set up */}
      <section id="newsletter" className="bg-paper-100 py-16 scroll-mt-20">
        <div className="max-w-170 mx-auto px-4 text-center flex flex-col gap-4 items-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <h2 className={`m-0 font-display font-medium text-[30px] md:text-[36px] tracking-[-0.5px] ${navy}`}>{home.newsletter.title}</h2>
          </div>
          <p className="m-0 text-[16px] leading-[1.6] text-ink-600 text-pretty">{home.newsletter.text}</p>
          <form className="flex flex-wrap gap-2.5 w-full max-w-115" aria-describedby="newsletter-note">
            <label htmlFor="newsletter-email" className="sr-only">{home.newsletter.emailLabel}</label>
            <input id="newsletter-email" type="email" autoComplete="email" placeholder={home.newsletter.placeholder} disabled className="flex-1 basis-55 min-h-11 text-[14.5px] bg-paper-000 border border-line-400 rounded-[9px] px-4 text-ink-900 placeholder:text-ink-400 disabled:cursor-not-allowed" />
            <button type="button" disabled className="text-[14.5px] font-semibold text-brand-navy bg-ochre-500 rounded-[9px] px-6 min-h-11 opacity-60 cursor-not-allowed">{home.newsletter.button}</button>
          </form>
          <p id="newsletter-note" className="m-0 text-[12.5px] text-ink-400"><SoonPill>{home.newsletter.badge}</SoonPill> {home.newsletter.note} · <Link href={home.newsletter.privacy.href} className="text-marine-600">{home.newsletter.privacy.label}</Link></p>
        </div>
      </section>

      {/* OUR COMMITMENTS */}
      <section className="bg-paper-000 border-t border-paper-200 py-16">
        <div className={`${wrap} grid gap-10 lg:gap-14 lg:grid-cols-[300px_1fr]`}>
          <div>
            <h2 className={`m-0 mb-3 font-display font-medium text-[30px] tracking-[-0.5px] ${navy}`}>{home.commitments.title}</h2>
            <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">{home.commitments.text}</p>
          </div>
          <ul className="grid gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
            {home.commitments.items.map(({ href, title, text }) => (
              <li key={href}>
                <Link href={href} className="block no-underline text-inherit group">
                  <span className="block text-[15px] font-semibold text-navy-900 mb-1 group-hover:text-marine-600">{title}</span>
                  <span className="block text-[13px] leading-normal text-ink-400">{text}</span>
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
