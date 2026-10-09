import Link from "next/link";
import type { ReactNode } from "react";

import { Placeholder } from "@/components/Placeholder";
import home from "@/content/data/home.json";
import { sampleImage } from "@/content/sample";
import { TRAVEL_STYLES } from "@/lib/community/constants";
import { getCommunityHighlights, getFeaturedDestinations, getHomeTopics } from "@/lib/content/home";
import { getLatestStories, type Story } from "@/lib/content/stories";

/**
 * Homepage, built to the "Homepage 1a" design (8 Oct 2026).
 *
 * Fixed wording (headings, descriptions, link lists) lives in src/content/data/home.json. Every
 * destination, topic, guide and post shown here is published content from the CMS or the
 * community database. A section with nothing published is left out entirely: the homepage never
 * shows sample content or "Coming soon" mock-ups.
 *
 * Colours: theme tokens (paper, ink, navy-900, marine) follow the visitor's light/dark setting.
 * The brand-* colours are fixed and only used for bands that stay dark in both themes.
 */
export const revalidate = 300;

const wrap = "mx-auto max-w-wide px-4 md:px-8 xl:px-14";
const navy = "text-navy-900";
const h2 = `m-0 font-display font-medium ${navy} tracking-[-1px] text-[30px] md:text-[40px] leading-[1.1]`;
const chip = "inline-flex items-center text-[12.5px] font-medium text-navy-900 bg-paper-000 border border-line-400 rounded-full px-3.25 py-1.5 no-underline hover:border-marine-600 hover:text-marine-600";
const goldButton = "inline-flex items-center justify-center text-[15px] font-semibold text-brand-navy bg-ochre-500 hover:bg-ochre-600 px-6.5 py-3.25 rounded-[9px] no-underline";
const outlineButton = "inline-flex items-center justify-center text-[15px] font-semibold text-navy-900 border-[1.5px] border-navy-900 px-6.5 py-3 rounded-[9px] no-underline hover:bg-navy-900 hover:text-on-marine";
const textLink = "text-[14.5px] font-semibold text-marine-600 hover:text-navy-900 no-underline";

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(iso));

function Eyebrow({ children, tone = "teal", className = "" }: { children: ReactNode; tone?: "teal" | "gold"; className?: string }) {
  return <p className={`m-0 mb-2.5 text-[12px] font-semibold tracking-[2px] uppercase ${tone === "gold" ? "text-brand-gold" : "text-marine-600"} ${className}`}>{children}</p>;
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

const travelStyles = TRAVEL_STYLES.filter((s) => !home.ways.excludedTravelStyles.includes(s.value)).map((s) => ({ href: `/search?style=${s.value}`, label: s.label }));

/** Topic pages are not on the CMS yet, so a topic links to a guide search for its name. */
const topicHref = (name: string) => `/search?${new URLSearchParams({ q: name, type: "guide" })}`;

function GuideMeta({ story, light = false }: { story: Story; light?: boolean }) {
  return (
    <span className={`text-[12.5px] ${light ? "text-white/85" : "text-ink-400"}`}>
      {story.author.name} · {story.readMinutes} {home.guides.minutesLabel} · {home.guides.updatedLabel} {fmt(story.updated)}
    </span>
  );
}

export default async function HomePage() {
  const [stories, destinations, topics, community] = await Promise.all([
    getLatestStories(4),
    getFeaturedDestinations(),
    getHomeTopics(),
    getCommunityHighlights(),
  ]);
  // Sample articles fill listings only while the CMS has none; the homepage never shows them.
  const realStories = stories.filter((s) => !s.isSample);
  const latest = realStories[0];
  const [flagship, ...more] = realStories;
  const ways = [...topics.map((t) => ({ href: topicHref(t.name), label: t.name })), ...travelStyles];
  const { hero: heroText } = home;
  const hero = sampleImage(heroText.image);

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
              <Placeholder image={hero} tone={heroText.imageTone} alt={hero.alt} priority sizes="(min-width: 1024px) 50vw, 100vw" className="block w-full h-[300px] md:h-105 lg:h-130 rounded-2xl" />
              <figcaption className="mt-2 text-[11.5px] text-ink-400 text-right">
                {heroText.imageCaption}. Photo: {hero.author}, via Wikimedia Commons, <a href={hero.licenseUrl} rel="license" className="text-marine-600 underline">{hero.license}</a>
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

      {/* POPULAR DESTINATIONS: published destinations with published guides. Links go to the
          destination's community hub until destination pages are served from the CMS. */}
      {destinations.length > 0 && (
        <section className="bg-paper-000 py-14 lg:pt-18 lg:pb-16">
          <div className={wrap}>
            <SectionHead eyebrow={home.destinations.eyebrow} title={home.destinations.title} />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
              {destinations.map((d) => (
                <li key={d.path}>
                  <Link href={`/community/${d.path}`} className="group flex flex-col h-full rounded-xl overflow-hidden border border-paper-200 no-underline text-inherit hover:shadow-[0_10px_30px_rgba(11,60,93,.10)]">
                    <span aria-hidden="true" className="block h-1.5 bg-marine-600" style={d.accent ? { background: d.accent } : undefined} />
                    <span className="flex flex-col flex-1 px-5 pt-4.5 pb-5">
                      {d.parentName && <span className="block text-[11.5px] font-semibold tracking-[1.5px] uppercase text-marine-600 mb-1.5">{d.parentName}</span>}
                      <span className="block font-display text-[23px] font-medium text-navy-900 mb-2">{d.name}</span>
                      <span className="block text-[14px] leading-normal text-ink-600 mb-3 line-clamp-3">{d.summary}</span>
                      <span className="block text-[12.5px] text-ink-400 mb-2.5">{d.guides === 1 ? home.destinations.guideOne : `${d.guides} ${home.destinations.guideMany}`}</span>
                      <span className="mt-auto text-[13.5px] font-semibold text-marine-600 group-hover:text-navy-900">{home.destinations.explorePrefix} {d.name} <span aria-hidden="true">→</span></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* TRAVEL YOUR WAY: published CMS topics and travel-style searches */}
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
                        <Placeholder image={s.image} tone={s.heroTone} alt={s.heroAlt} sizes="130px" className="w-27.5 sm:w-32.5 h-27.5 shrink-0 rounded-[10px]" />
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

      {/* TRIP REPORTS + COMMUNITY: only posts that are published and visible to everyone */}
      {(community.trip || community.question) && (
        <section className="bg-paper-000 py-14 lg:py-18">
          <div className={`${wrap} grid gap-6 lg:grid-cols-2`}>
            {community.trip && (
              <div className="border border-paper-200 rounded-2xl p-7 flex flex-col gap-3">
                <Eyebrow className="mb-0!">{home.tripReports.eyebrow}</Eyebrow>
                <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>{home.tripReports.title}</h3>
                <Link href={community.trip.path} className="block border-l-2 border-ochre-500 pl-3.5 no-underline text-inherit">
                  <span className="block font-display italic text-[16.5px] leading-[1.55] text-ink-900 mb-2">{community.trip.title}</span>
                  <span className="block text-[12.5px] text-ink-400">{community.trip.author.displayName}{community.trip.destinations[0] ? ` · ${community.trip.destinations[0].name}` : ""}</span>
                </Link>
                <Link href={home.tripReports.browse.href} className={`mt-auto ${textLink} text-[14px]`}>{home.tripReports.browse.label} <span aria-hidden="true">→</span></Link>
              </div>
            )}

            {community.question && (
              <div className="border border-paper-200 rounded-2xl p-7 flex flex-col gap-3 bg-paper-100">
                <Eyebrow className="mb-0!">{home.community.eyebrow}</Eyebrow>
                <h3 className={`m-0 font-display font-medium text-[26px] ${navy}`}>{home.community.title}</h3>
                <p className="m-0 text-[14.5px] leading-[1.6] text-ink-600">{home.community.text}</p>
                <Link href={community.question.path} className="block bg-paper-000 rounded-[10px] px-3.5 py-3 border border-line-400 no-underline text-inherit hover:border-marine-600">
                  <span className="block text-[13.5px] font-semibold text-ink-900 mb-0.75">{community.question.title}</span>
                  <span className="block text-[12px] text-ink-400">{community.question.replyCount === 1 ? home.community.answerOne : `${community.question.replyCount} ${home.community.answerMany}`}</span>
                </Link>
                <Link href={home.community.browse.href} className={`mt-auto ${textLink} text-[14px]`}>{home.community.browse.label} <span aria-hidden="true">→</span></Link>
              </div>
            )}
          </div>
        </section>
      )}

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
