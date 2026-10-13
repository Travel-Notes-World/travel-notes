import config from "@payload-config";
import type { Metadata } from "next";
import Link from "next/link";
import { getPayload } from "payload";

import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CardList } from "@/components/community/cards";
import { JsonLd, Notice, PageShell } from "@/components/community/ui";
import { PlannerForm, SavePlanForm } from "@/components/planner/planner-forms";
import { ShareButtons } from "@/components/ShareButtons";
import { UpdateItem } from "@/components/UpdateItem";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { getViewer } from "@/lib/community/next/session";
import { canViewCommunity } from "@/lib/community/settings";
import { MONTH_NAMES, type MonthRating } from "@/lib/content/destinationFacts";
import { getDestinationPage, getDestinationsWithContent } from "@/lib/content/destinations";
import { PACES, PARTIES, planDays, plannerHref, readPlannerInput, tripMonths } from "@/lib/planner/input";
import { loadPlanner, timingSummary, type PlannerPlace } from "@/lib/planner/load";
import { siteUrl } from "@/lib/site";

/**
 * The Trip Planner (/trip-planner).
 *
 * Without choices it explains the planner and shows the form. With places chosen it builds a draft
 * from content Travel Notes has already published and checked. The plan lives in the page address,
 * so it can be shared and needs no account; "Save to my trips" copies it into a private plan.
 *
 * Only the empty planner is a search-engine page. Every filled-in plan is a different address, so
 * those are noindex with the planner itself as the canonical address.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "Trip Planner: plan your trip day by day";
const DESCRIPTION = "Plan a trip day by day with checked information: the best months to go, entry and health facts from official sources, current travel updates, guides and real trip reports.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { submitted } = readPlannerInput(await searchParams);
  return {
    title: { absolute: `${TITLE} | Travel Notes` },
    description: DESCRIPTION,
    alternates: { canonical: "/trip-planner" },
    ...(submitted ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/trip-planner" },
  };
}

const crumbs = [{ label: "Home", href: "/" }, { label: "Trip Planner" }];
const RATING_TEXT: Record<MonthRating, string> = { best: "one of the best times to go", good: "a good time to go", other: "outside the months our editors rate best or good" };
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtLong = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtChecked = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "");

export default async function TripPlannerPage({ searchParams }: Props) {
  const params = await searchParams;
  const { input, errors, submitted } = readPlannerInput(params);
  const payload = await getPayload({ config });
  const { member, staff } = await getViewer();
  const community = await canViewCommunity(staff);
  const months = tripMonths(input);

  const result = input.placeIds.length ? await loadPlanner(payload, input, { pageFor: (doc) => getDestinationPage(doc), months, community }) : null;
  const places = result?.places ?? [];
  const tried = Boolean(params.go) || submitted;
  const noPlaces = tried && places.length === 0;

  if (!places.length) {
    const popular = (await getDestinationsWithContent()).slice(0, 8);
    return (
      <PageShell>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <Breadcrumbs items={crumbs} />
        <header className="mt-2 mb-8 max-w-measure">
          <p className="t-meta text-ochre-700 m-0">Trip Planner</p>
          <h1 className="t-heading-1 mt-2 m-0">Plan your trip, day by day</h1>
          <p className="t-deck mt-3 mb-0">Choose where and when you are going. The planner sets out your days and brings together what Travel Notes has checked for those places: the best months to go, entry and health facts with their official sources, current travel updates, guides and trip reports from travellers.</p>
        </header>
        {noPlaces && <div className="mb-6 max-w-measure"><Notice tone="error" title="Choose a destination">{result?.missing ? "That destination is no longer available. Choose another one." : "Add at least one place you are going to, then press Plan my trip."}</Notice></div>}
        <PlannerForm places={[]} start={input.start} month={input.month} days={input.days} party={input.party} pace={input.pace} errors={{ ...errors, to: noPlaces ? "Choose at least one destination." : errors.to }} />

        <section aria-labelledby="how-heading" className="mt-12 max-w-measure">
          <h2 id="how-heading" className="t-heading-2 m-0">How the planner works</h2>
          <ul className="t-body mt-3 mb-0 pl-6 grid gap-2">
            <li>It uses only information Travel Notes has published. When we have not checked something for a place yet, the planner says so instead of guessing.</li>
            <li>Entry rules, government advice and health facts are shown with their official source and the date our editors last checked them.</li>
            <li>You do not need an account. Your plan is saved in the page address, so you can bookmark it or share the link. Sign in to keep it in your trips and add your own stops and notes.</li>
            <li>It does not book anything. Always confirm prices, opening hours and entry rules with the official source before you travel.</li>
          </ul>
        </section>

        {popular.length > 0 && (
          <section aria-labelledby="popular-heading" className="mt-12">
            <h2 id="popular-heading" className="t-heading-2 m-0">Start with a destination we cover</h2>
            <ul className="list-none m-0 mt-4 p-0 flex flex-wrap gap-2">
              {popular.map((p) => (
                <li key={p.id}>
                  <Link href={plannerHref({ placeIds: [p.id] })} className="inline-flex items-center min-h-11 px-4 rounded-full border border-line-500 t-ui text-ink-900 no-underline hover:border-marine-600">
                    {p.parentName ? `${p.name}, ${p.parentName}` : p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageShell>
    );
  }

  const split = places.map((p) => p.days);
  const days = planDays({ start: input.start, split });
  const total = days.length;
  const names = places.map((p) => p.name);
  const heading = `${total === 1 ? "1 day" : `${total} days`} in ${joinNames(names)}`;
  const when = input.start ? `${fmtLong(input.start)} to ${fmtLong(days.at(-1)!.date!)}` : input.month ? `Planned for ${MONTH_NAMES[input.month]}` : "No dates yet";
  const party = PARTIES.find((p) => p.value === input.party)?.label;
  const pace = PACES.find((p) => p.value === input.pace)!;
  const href = plannerHref({ ...input, placeIds: places.map((p) => p.id), split, days: total });
  const query = href.split("?")[1] ?? "";
  const ranges = new Map<string, { from: number; to: number }>();
  for (const d of days) {
    const id = places[d.placeIndex].id;
    const r = ranges.get(id);
    ranges.set(id, r ? { ...r, to: d.number } : { from: d.number, to: d.number });
  }
  const dayRange = (p: PlannerPlace) => {
    const r = ranges.get(p.id);
    return !r ? "" : r.from === r.to ? `Day ${r.from}` : `Days ${r.from}–${r.to}`;
  };

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Trip Planner", href: "/trip-planner" }, { label: "Your plan" }]} />
      <header className="mt-2 mb-6 max-w-measure">
        <p className="t-meta text-ochre-700 m-0">Your draft plan</p>
        <h1 className="t-heading-1 mt-2 m-0">{heading}</h1>
        <p className="t-deck mt-3 mb-0">{when}{party ? ` · ${party}` : ""} · {pace.label} pace</p>
      </header>

      <div className="grid gap-4 mb-6 max-w-measure">
        {result!.missing > 0 && <Notice tone="info" title="A place was left out">{result!.missing === 1 ? "One of the places in this link" : `${result!.missing} places in this link`} is no longer on Travel Notes, so the days were shared between the others.</Notice>}
        {errors.split && <Notice tone="info" title="Days shared out again">{errors.split}</Notice>}
        {errors.to && <Notice tone="info" title="Too many places">{errors.to}</Notice>}
        {params.signedin && member && <Notice tone="success" title="You are signed in">Press “Save to my trips” to keep this plan.</Notice>}
      </div>

      <div className="flex flex-wrap items-start gap-4 mb-10">
        <SavePlanForm query={query} signedIn={Boolean(member)} />
        <details className="w-full sm:w-auto">
          <summary className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui cursor-pointer hover:border-ink-900">Change trip details</summary>
          <div className="mt-4 p-4 border border-paper-200 rounded-md bg-paper-000">
            <PlannerForm places={places.map((p) => ({ id: p.id, label: p.label }))} start={input.start} month={input.month} days={total} party={input.party} pace={input.pace} errors={errors} submitLabel="Update my plan" />
          </div>
        </details>
      </div>

      <section aria-labelledby="outline-heading" className="max-w-[860px]">
        <h2 id="outline-heading" className="t-heading-2 m-0">Your days</h2>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">{pace.hint} This is a suggested outline, not a tested itinerary. Save it to add your own stops, times and notes for each day.</p>
        <ol className="list-none m-0 mt-4 p-0 border-t border-paper-200">
          {days.map((d) => {
            const place = places[d.placeIndex];
            const moving = d.firstInPlace && d.placeIndex > 0;
            return (
              <li key={d.number} className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 border-b border-paper-200">
                <span className="t-ui">Day {d.number}{d.date && <span className="block t-body-sm text-ink-600 font-normal">{fmtDay(d.date)}</span>}</span>
                <span className="t-body-sm">
                  <a href={`#place-${place.id}`} className="text-ink-900 underline decoration-paper-200 underline-offset-4 hover:decoration-marine-600">{place.name}</a>
                  {moving && <span className="block text-ink-600">Travel from {places[d.placeIndex - 1].name} to {place.name}. Allow time for the journey.</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {places.length > 1 && (
          <form method="get" action="/trip-planner" className="mt-4">
            <fieldset className="border-0 p-0 m-0 min-w-0">
              <legend className="t-ui p-0">Days in each place</legend>
              {places.map((p) => <input key={p.id} type="hidden" name="to" value={p.id} />)}
              {input.start ? <input type="hidden" name="start" value={input.start} /> : input.month ? <input type="hidden" name="month" value={input.month} /> : null}
              {input.party && <input type="hidden" name="with" value={input.party} />}
              <input type="hidden" name="pace" value={input.pace} />
              <div className="mt-2 flex flex-wrap items-end gap-3">
                {places.map((p, i) => (
                  <label key={p.id} className="t-body-sm grid gap-1">
                    {p.name}
                    <input type="number" name="split" min={1} max={30} defaultValue={split[i]} inputMode="numeric" className="w-20 min-h-11 px-3 py-2 rounded-sm border border-line-500 bg-paper-000" />
                  </label>
                ))}
                <button type="submit" className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui hover:border-ink-900">Change days</button>
              </div>
            </fieldset>
          </form>
        )}
      </section>

      {places.map((p) => (
        <section key={p.id} id={`place-${p.id}`} aria-labelledby={`h-${p.id}`} className="mt-14 scroll-mt-28">
          <p className="t-meta text-ochre-700 m-0">{dayRange(p)}</p>
          <h2 id={`h-${p.id}`} className="t-heading-2 mt-1 m-0">{p.label}</h2>
          {p.summary && <p className="t-body mt-3 mb-0 max-w-measure">{p.summary}</p>}

          <div className="mt-5 grid gap-4 max-w-measure">
            {p.timing ? (
              <p className="t-body m-0">
                <strong className="font-semibold">When you are going: </strong>
                {p.timing.map((t) => MONTH_NAMES[t.month]).join(" and ")} {p.timing.length > 1 ? "are" : "is"} {RATING_TEXT[timingSummary(p.timing)]} in our editors’ rating for {p.name}.
                {p.bestRange && ` Best: ${p.bestRange}.`}
                {" "}<Link href={`/destinations/${p.path}#when-to-go`} className="text-marine-600 underline">See when to go</Link>
              </p>
            ) : months.length ? (
              <p className="t-body-sm text-ink-600 m-0">We have not rated the months for {p.name} yet, so check the season and weather with an official tourism or weather source.</p>
            ) : null}
            {p.timeNeeded && <p className="t-body m-0"><strong className="font-semibold">How long to allow: </strong>{p.timeNeeded}</p>}
            {p.goodFor && <p className="t-body m-0"><strong className="font-semibold">Good for: </strong>{p.goodFor}</p>}
            {p.timeZone && <p className="t-body-sm text-ink-600 m-0">Local time zone: {p.timeZone.name} ({p.timeZone.offset} today)</p>}
          </div>

          {p.guides.length > 0 && (
            <div className="mt-8">
              <h3 className="t-heading-3 m-0">Guides for {p.name}</h3>
              <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{p.guides.map((g) => <ArticleCard key={g.slug} article={g} />)}</div>
              {p.guideTotal > p.guides.length && <p className="t-body-sm mt-4 mb-0"><Link href={`/destinations/${p.path}`} className="text-marine-600 underline">All {p.guideTotal} guides for {p.name}</Link></p>}
            </div>
          )}

          {p.activities.length > 0 && (
            <div className="mt-8 max-w-[860px]">
              <h3 className="t-heading-3 m-0">Activities during your dates</h3>
              <p className="t-body-sm text-ink-600 mt-1 mb-3">Listed by their organisers. Check details with the organiser before you go.</p>
              <CardList cards={p.activities} label={`Activities in ${p.name} during your dates`} />
            </div>
          )}

          {p.trips.length > 0 && (
            <div className="mt-8 max-w-[860px]">
              <h3 className="t-heading-3 m-0">Trip reports from travellers</h3>
              <p className="t-body-sm text-ink-600 mt-1 mb-3">Real trips written by members. Open one to copy its days into your own plan.</p>
              <CardList cards={p.trips} label={`Trip reports for ${p.name}`} />
            </div>
          )}

          {p.questions.length > 0 && (
            <div className="mt-8 max-w-[860px]">
              <h3 className="t-heading-3 m-0">Questions travellers asked</h3>
              <CardList cards={p.questions} label={`Questions about ${p.name}`} />
            </div>
          )}

          {!p.guides.length && !p.trips.length && !p.questions.length && !p.activities.length && (
            <p className="t-body-sm text-ink-600 mt-6 mb-0 max-w-measure">We do not have guides or trip reports for {p.name} yet.{community ? <> If you have been, <Link href="/community/questions" className="text-marine-600 underline">ask or share in the community</Link>.</> : null}</p>
          )}
        </section>
      ))}

      <section aria-labelledby="before-heading" className="mt-16 max-w-measure">
        <h2 id="before-heading" className="t-heading-2 m-0">Before you go</h2>
        {result!.countries.map((c) => (
          <div key={c.id} className="mt-6">
            <h3 className="t-heading-3 m-0">{c.name}</h3>
            {c.checks.length > 0 ? (
              <ul className="list-none m-0 mt-3 p-0 grid gap-3">
                {c.checks.map((f) => (
                  <li key={f.kind + f.label} className="border-l-4 border-marine-600 pl-3">
                    <p className="t-ui m-0">{f.label}</p>
                    <p className="t-body-sm m-0 mt-1">{f.value}</p>
                    {f.source && <p className="t-body-sm text-ink-600 m-0 mt-1">Source: <a href={f.source.url} className="text-marine-600 underline" rel="noopener">{f.source.name}</a></p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body-sm text-ink-600 mt-2 mb-0">Our editors have not published checked entry or health facts for {c.name} yet.</p>
            )}
            {c.checkedAt && c.checks.length > 0 && <p className="t-body-sm text-ink-600 mt-2 mb-0">Last checked by Travel Notes on {fmtChecked(c.checkedAt)}. Rules can change: confirm with the source before you book.</p>}
            {c.isoCode !== "AU" && <p className="t-body-sm mt-2 mb-0">Australians: read the latest advice for {c.name} on <a href="https://www.smartraveller.gov.au/" className="text-marine-600 underline" rel="noopener">Smartraveller</a>, the Australian Government’s travel advice service.</p>}
            {c.handy.length > 0 && (
              <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr] t-body-sm">
                {c.handy.map((f) => (
                  <div key={f.kind + f.label} className="contents">
                    <dt className="font-semibold">{f.label}</dt>
                    <dd className="m-0">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
        {result!.updates.length > 0 && (
          <div className="mt-8">
            <h3 className="t-heading-3 m-0">Travel updates that apply now</h3>
            <div className="mt-4 grid gap-5">{result!.updates.map((u) => <UpdateItem key={u.id} update={u} headingLevel="h3" />)}</div>
          </div>
        )}
      </section>

      <ShareButtons url={`${siteUrl}${href}`} title={heading} heading="Share this plan" />

      <aside className="mt-12 max-w-measure border-t border-paper-200 pt-6">
        <h2 className="t-heading-3 m-0">About this plan</h2>
        <p className="t-body-sm text-ink-600 mt-2 mb-0">The Trip Planner arranges your days and gathers Travel Notes content for the places you chose. It does not book anything, and it has not been tested as a complete itinerary. Prices, opening hours and entry rules change: check them with the official source before you travel. Read our <Link href="/editorial-policy" className="text-marine-600 underline">editorial policy</Link>.</p>
      </aside>
    </PageShell>
  );
}
