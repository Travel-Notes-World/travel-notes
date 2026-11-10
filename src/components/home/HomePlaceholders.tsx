import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { NewsletterForm } from "@/components/NewsletterForm";
import p from "@/content/data/home-placeholders.json";

/**
 * Homepage placeholder sections from the "Homepage 1a" design (owner's decision, 10 Nov 2026).
 *
 * The owner asked for every section of the design to be back on the homepage so each one can be
 * worked on in turn. They use the design's sample wording, kept in src/content/data/home-placeholders.json,
 * and each section carries a visible "Placeholder P#" tag so it is never mistaken for finished work.
 * Image boxes are striped blocks with a description of the photo that belongs there.
 *
 * Retire a section by replacing it with real content and deleting its block here and in the JSON file.
 */

const wrap = "mx-auto max-w-wide px-4 md:px-8 xl:px-14";
const h2 = "m-0 font-display font-medium text-navy-900 tracking-[-1px] text-[30px] md:text-[40px] leading-[1.1]";
const h2Small = "m-0 font-display font-medium text-navy-900 tracking-[-0.5px] text-[30px] md:text-[34px] leading-[1.15]";
const textLink = "text-[14.5px] font-semibold text-marine-600 hover:text-navy-900 no-underline";
const goldButton = "inline-flex items-center justify-center text-[15px] font-semibold text-brand-navy bg-brand-gold hover:opacity-90 px-6.5 py-3.25 rounded-[9px] no-underline";

const tones: Record<string, [string, string]> = {
  blue: ["#c9d8de", "#d8e3e8"],
  green: ["#d9e5d9", "#e5eee5"],
  sand: ["#e3dcc9", "#ece7d8"],
  deep: ["#b7c9d1", "#c8d6dc"],
  night: ["#123f5e", "#1a4a6b"],
  sea: ["#144a52", "#1c5a63"],
};

function stripes(tone = "blue", step = 14): CSSProperties {
  const [a, b] = tones[tone] ?? tones.blue;
  return { background: `repeating-linear-gradient(45deg,${a} 0,${a} ${step}px,${b} ${step}px,${b} ${step * 2}px)` };
}

/** A striped box standing in for a photo, with a note of what the photo should show. */
function ImageSlot({ label, tone = "blue", className = "", dark = false }: { label?: string; tone?: string; className?: string; dark?: boolean }) {
  return (
    <span aria-hidden="true" className={`flex items-center justify-center ${className}`} style={stripes(tone)}>
      {label && <span className={`font-mono text-[11px] px-2.5 py-1.25 rounded-[5px] ${dark ? "text-white/80 bg-brand-navy/70" : "text-brand-navy bg-white/85"}`}>[ {label} ]</span>}
    </span>
  );
}

/** The visible marker on every placeholder section. */
function Tag({ id, title, dark = false }: { id: string; title: string; dark?: boolean }) {
  return (
    <p className={`m-0 mb-4 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[1px] uppercase rounded-full px-3 py-1 border border-dashed ${dark ? "text-brand-gold border-brand-gold/60" : "text-ochre-700 border-ochre-600 bg-ochre-100"}`}>
      {p.tagLabel} {id} · {title}
    </p>
  );
}

function Eyebrow({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return <p className={`m-0 mb-2.5 text-[12px] font-semibold tracking-[2px] uppercase ${gold ? "text-brand-gold" : "text-marine-600"}`}>{children}</p>;
}

function Head({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={h2}>{title}</h2>
      </div>
      {link && <Link href={link.href} className={textLink}>{link.label} <span aria-hidden="true">→</span></Link>}
    </div>
  );
}

/** P1 · Popular destinations (shown only while no real destinations are published). */
export function PlaceholderDestinations() {
  const s = p.destinations;
  return (
    <section className="bg-paper-000 py-14 lg:pt-18 lg:pb-16">
      <div className={wrap}>
        <Tag id={s.id} title={s.title} />
        <Head eyebrow={s.eyebrow} title={s.title} link={s.link} />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
          {s.items.map((d) => (
            <li key={d.name} className="flex flex-col rounded-[14px] overflow-hidden border border-paper-200">
              <ImageSlot label={d.image} tone={d.tone} className="h-55" />
              <div className="px-5 pt-4.5 pb-5">
                <p className="m-0 mb-1.5 text-[11.5px] font-semibold tracking-[1.5px] uppercase text-marine-600">{d.country}</p>
                <h3 className="m-0 mb-1.5 font-display text-[23px] font-medium text-navy-900">{d.name}</h3>
                <p className="m-0 mb-3 text-[14px] leading-[1.55] text-ink-600">{d.text}</p>
                <span className="text-[13.5px] font-semibold text-marine-600">Explore {d.name} <span aria-hidden="true">→</span></span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** P2 · Featured travel guides (shown only while no real guides are published). */
export function PlaceholderGuides() {
  const s = p.guides;
  return (
    <section className="bg-paper-000 py-14 lg:py-18">
      <div className={wrap}>
        <Tag id={s.id} title={s.title} />
        <Head eyebrow={s.eyebrow} title={s.title} link={s.link} />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative rounded-2xl overflow-hidden min-h-95 lg:min-h-115">
            <ImageSlot label={s.flagship.image} tone="deep" className="absolute inset-0 items-start! justify-end! p-4" />
            <div className="absolute inset-x-0 bottom-0 px-7 pb-6.5 pt-30 bg-[linear-gradient(180deg,rgba(11,60,93,0)_0%,rgba(11,60,93,.85)_70%)]">
              <p className="m-0 mb-2 text-[11.5px] font-semibold tracking-[1.5px] uppercase text-brand-gold">{s.flagship.label}</p>
              <h3 className="m-0 mb-2.5 font-display text-[26px] md:text-[32px] font-medium text-white leading-[1.15] text-balance">{s.flagship.title}</h3>
              <p className="m-0 text-[13px] text-white/85">{s.flagship.meta}</p>
            </div>
          </div>
          <ul className="flex flex-col gap-6 list-none m-0 p-0">
            {s.items.map((g) => (
              <li key={g.title} className="flex gap-4 border border-paper-200 rounded-[14px] p-3.5">
                <ImageSlot label={g.image} tone={g.tone} className="w-27.5 sm:w-32.5 h-27.5 shrink-0 rounded-[10px] text-center" />
                <div className="flex flex-col gap-1.5 justify-center">
                  <h3 className="m-0 font-display text-[19px] font-medium text-navy-900 leading-tight">{g.title}</h3>
                  <p className="m-0 text-[12.5px] text-ink-400">{g.meta}</p>
                  <span className="text-[13px] font-semibold text-marine-600">{s.readLabel} <span aria-hidden="true">→</span></span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** P3 · Video explorer and P4 · Photo explorer (one dark band, as in the design). */
export function PlaceholderMedia() {
  const v = p.video;
  const ph = p.photo;
  return (
    <section className="bg-brand-navy py-14 lg:py-18">
      <div className={`${wrap} grid gap-14 lg:grid-cols-2`}>
        <div>
          <Tag id={v.id} title={v.title} dark />
          <Eyebrow gold>{v.eyebrow}</Eyebrow>
          <h2 className="m-0 mb-5.5 font-display font-medium text-[30px] md:text-[34px] tracking-[-0.5px] text-white">{v.title}</h2>
          <div className="relative rounded-[14px] overflow-hidden h-60 mb-4">
            <ImageSlot label={v.main.image} tone="night" dark className="absolute inset-0" />
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14.5 h-14.5 rounded-full bg-white/90 grid place-items-center">
              <span className="ml-1 w-0 h-0 border-l-[16px] border-l-brand-navy border-y-[10px] border-y-transparent" />
            </span>
            <span className="absolute left-3.5 bottom-3 text-[13px] font-semibold text-white bg-brand-navy/70 px-3 py-1.5 rounded-[7px]">{v.main.label}</span>
          </div>
          <ul className="grid grid-cols-2 gap-3.5 list-none m-0 p-0">
            {v.items.map((i) => (
              <li key={i.label} className="relative rounded-[10px] overflow-hidden h-24">
                <ImageSlot tone="night" className="absolute inset-0" />
                <span className="absolute left-2.5 bottom-2 text-[12px] text-white bg-brand-navy/70 px-2.25 py-1 rounded-md">{i.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Tag id={ph.id} title={ph.title} dark />
          <Eyebrow gold>{ph.eyebrow}</Eyebrow>
          <h2 className="m-0 mb-5.5 font-display font-medium text-[30px] md:text-[34px] tracking-[-0.5px] text-white">{ph.title}</h2>
          <ul className="grid grid-cols-3 auto-rows-[114px] gap-3 list-none m-0 p-0">
            {ph.items.map((i, n) => (
              <li key={i.image} className={`rounded-[10px] overflow-hidden flex items-end p-2.5 ${i.size === "tall" ? "row-span-2" : ""} ${i.size === "wide" ? "col-span-2" : ""}`} style={stripes(n % 2 ? "sea" : "night", 12)}>
                <span className="font-mono text-[10px] text-white/80">[ {i.image} ]</span>
              </li>
            ))}
          </ul>
          <Link href={ph.link.href} className="inline-block mt-4.5 text-[14px] font-semibold text-white border-[1.5px] border-white/40 hover:border-white px-5 py-2.5 rounded-[9px] no-underline">{ph.link.label} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  );
}

/** P5 · Destination knowledge hub */
export function PlaceholderKnowledgeHub() {
  const s = p.knowledge;
  return (
    <section className="bg-paper-000 py-14 lg:py-18">
      <div className={wrap}>
        <Tag id={s.id} title={s.title} />
        <div className="max-w-190 mb-9">
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h2 className={`${h2} mb-3!`}>{s.title}</h2>
          <p className="m-0 text-[16.5px] leading-[1.6] text-ink-600 text-pretty">{s.text}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 list-none m-0 p-0">
          {s.items.map((i) => (
            <li key={i.title}>
              <Link href={s.href} className="block h-full border border-paper-200 rounded-xl p-5 no-underline text-inherit hover:border-marine-600">
                <span className="block text-[16px] font-semibold text-navy-900 mb-1.25">{i.title}</span>
                <span className="block text-[13.5px] leading-normal text-ink-400">{i.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** P6 · Hidden gems and P7 · Interactive world map */
export function PlaceholderGemsAndMap() {
  const g = p.gems;
  const m = p.map;
  return (
    <section className="bg-paper-100">
      <div className="mx-auto max-w-wide grid lg:grid-cols-[1fr_1.2fr]">
        <div className="px-4 md:px-8 xl:pl-14 lg:pr-10 py-14 lg:py-16">
          <Tag id={g.id} title={g.title} />
          <Eyebrow>{g.eyebrow}</Eyebrow>
          <h2 className={`${h2Small} mb-5!`}>{g.title}</h2>
          <ul className="flex flex-col gap-3.5 list-none m-0 p-0">
            {g.items.map((i) => (
              <li key={i.name} className="flex gap-3.5 items-center bg-paper-000 border border-line-400 rounded-xl p-3">
                <ImageSlot tone={i.tone} className="w-18.5 h-16 shrink-0 rounded-[9px]" />
                <div>
                  <h3 className="m-0 text-[15.5px] font-semibold text-navy-900">{i.name}</h3>
                  <p className="m-0 text-[13px] text-ink-400">{i.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href={g.link.href} className={`inline-block mt-5 ${textLink} text-[14px]`}>{g.link.label} <span aria-hidden="true">→</span></Link>
        </div>
        <div className="px-4 md:px-8 xl:pr-14 lg:pl-6 py-14 lg:py-16 flex flex-col">
          <Tag id={m.id} title={m.title} />
          <Eyebrow>{m.eyebrow}</Eyebrow>
          <h2 className={`${h2Small} mb-5!`}>{m.title}</h2>
          <div className="relative flex-1 min-h-75 rounded-[14px]">
            <ImageSlot label={m.image} tone="blue" className="absolute inset-0 rounded-[14px]" />
            <span aria-hidden="true" className="absolute left-[22%] top-[30%] w-3 h-3 rounded-full bg-brand-gold border-[2.5px] border-white" />
            <span aria-hidden="true" className="absolute left-[48%] top-[26%] w-3 h-3 rounded-full bg-brand-teal border-[2.5px] border-white" />
            <span aria-hidden="true" className="absolute left-[70%] top-[55%] w-3 h-3 rounded-full bg-brand-navy border-[2.5px] border-white" />
          </div>
          <ul className="flex flex-wrap gap-2.5 mt-4 list-none m-0 p-0">
            {m.continents.map((c) => (
              <li key={c}><Link href={m.href} className="inline-flex min-h-11 items-center text-[13px] font-medium text-navy-900 bg-paper-000 border border-line-400 rounded-full px-3.75 no-underline hover:border-marine-600">{c}</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** P8 · AI Trip Planner preview */
export function PlaceholderPlanner() {
  const s = p.planner;
  return (
    <section className="bg-brand-teal py-14 lg:py-18">
      <div className={`${wrap} grid gap-14 items-center lg:grid-cols-[1fr_480px]`}>
        <div>
          <Tag id={s.id} title="AI Trip Planner" dark />
          <p className="m-0 mb-4.5 inline-flex text-[12px] font-semibold tracking-[1.5px] uppercase text-brand-teal bg-[#F5F1E8] px-3 py-1.5 rounded-full">{s.badge}</p>
          <h2 className="m-0 mb-3.5 font-display font-medium text-[30px] md:text-[40px] tracking-[-1px] text-white text-balance">{s.title}</h2>
          <p className="m-0 mb-5.5 text-[16.5px] leading-[1.65] text-white/90 max-w-130 text-pretty">{s.text}</p>
          <div className="flex flex-wrap gap-3.5">
            <Link href={s.primary.href} className={goldButton}>{s.primary.label}</Link>
            <Link href={s.secondary.href} className="inline-flex items-center text-[15px] font-semibold text-white border-[1.5px] border-white/45 hover:border-white px-6.5 py-3 rounded-[9px] no-underline">{s.secondary.label}</Link>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5.5 shadow-[0_20px_50px_rgba(0,0,0,.2)]">
          <p className="m-0 mb-3.5 text-[13px] font-semibold text-[#6B7280]">{s.previewLabel}</p>
          <ul className="flex flex-col gap-2.5 list-none m-0 p-0">
            {s.days.map((d) => (
              <li key={d.day} className="flex gap-3 items-center bg-[#F5F1E8] rounded-[10px] px-3.5 py-3">
                <span className="w-11 shrink-0 text-[12px] font-bold text-brand-teal">{d.day}</span>
                <span className="text-[14px] text-[#1F2937]">{d.text}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2.5 flex items-center gap-2 text-[12.5px] text-[#6B7280]"><span aria-hidden="true" className="w-1.75 h-1.75 rounded-full bg-brand-teal" />{s.footnote}</p>
        </div>
      </div>
    </section>
  );
}

/** P9 · Travel stories (shown only while no real trip report is published). */
export function PlaceholderStory() {
  const s = p.stories;
  return (
    <div className="border border-paper-200 rounded-2xl p-7 flex flex-col gap-3">
      <Tag id={s.id} title={s.eyebrow} />
      <Eyebrow>{s.eyebrow}</Eyebrow>
      <h3 className="m-0 font-display font-medium text-[26px] text-navy-900">{s.title}</h3>
      <div className="border-l-2 border-ochre-500 pl-3.5">
        <p className="m-0 mb-2 font-display italic text-[16.5px] leading-[1.55] text-ink-900">{s.quote}</p>
        <p className="m-0 flex items-center gap-2.25 text-[12.5px] text-ink-400"><span aria-hidden="true" className="w-6 h-6 rounded-full" style={stripes("blue", 6)} />{s.byline}</p>
      </div>
      <Link href={s.link.href} className={`mt-auto ${textLink} text-[14px]`}>{s.link.label} <span aria-hidden="true">→</span></Link>
    </div>
  );
}

/** P10 · Newsletter. The design's wording, with the site's working sign-up form. */
export function PlaceholderNewsletter() {
  const s = p.newsletter;
  return (
    <section className="bg-paper-100 py-14 lg:py-16">
      <div className={`${wrap} flex flex-col items-center text-center`}>
        <Tag id={s.id} title="Newsletter" />
        <h2 className={`${h2Small} mb-4!`}>{s.title}</h2>
        <p className="m-0 mb-6 max-w-170 text-[16px] leading-[1.6] text-ink-600 text-pretty">{s.text}</p>
        <div className="w-full max-w-130 text-left"><NewsletterForm source="/" /></div>
        <p className="m-0 mt-4 text-[12.5px] text-ink-400">{s.footnote}</p>
      </div>
    </section>
  );
}
