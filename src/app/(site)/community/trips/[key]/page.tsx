import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SignInTo } from "@/components/community/post-actions";
import { PostMeta, PostToolbar, RelatedGuides, RepliesSection } from "@/components/community/post-parts";
import { CommunityClosed, CommunityLabel, JsonLd, Notice, PageShell, UserText, secondaryButtonClass, styleLabel } from "@/components/community/ui";
import { copyItineraryAction } from "@/lib/community/actions/engagement";
import { COST_BASES, COST_CATEGORIES, COST_SCOPES, labelOf, PARTY_TYPES } from "@/lib/community/constants";
import { formatMoney, perPerson } from "@/lib/community/money";
import { loadPostPage, postMetadata } from "@/lib/community/next/pages";
import { guidesForDestination, type Detail } from "@/lib/community/queries";
import { breadcrumbJsonLd, tripJsonLd } from "@/lib/community/seo";
import { formatDate, formatYearMonth } from "@/lib/community/time";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> };
type TripDetail = NonNullable<Detail["tripDetail"]>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postMetadata("trip", (await params).key, "Trip report");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function whenText(trip: Detail["trip"]): string | null {
  if (!trip) return null;
  if (trip.startDate && trip.endDate) return trip.startDate === trip.endDate ? formatDate(trip.startDate) : `${formatDate(trip.startDate)} to ${formatDate(trip.endDate)}`;
  if (trip.startDate) return `From ${formatDate(trip.startDate)}`;
  return trip.travelMonth ? formatYearMonth(trip.travelMonth) : null;
}

/** Costs grouped by what they were for, with one total per currency. Currencies are never added together. */
function CostsSection({ detail, partySize }: { detail: TripDetail; partySize: number | null }) {
  const { costs, totals } = detail;
  const hasFacts = costs.length > 0 || detail.costNotes;
  if (!hasFacts) return null;
  const groups = COST_CATEGORIES.map((c) => ({ ...c, lines: costs.filter((l) => l.category === c.value) })).filter((g) => g.lines.length);
  const scope = labelOf(COST_SCOPES, detail.costScope);
  const perParty = detail.costScope === "per_party" && partySize && partySize > 1;
  return (
    <section className="mt-10" aria-labelledby="costs-heading">
      <h2 id="costs-heading" className="t-heading-2 m-0">What it cost</h2>
      <ul className="mt-3 flex flex-wrap gap-2 list-none m-0 p-0" aria-label="About these costs">
        {scope && <li className="t-body-sm bg-paper-100 rounded-sm px-3 py-1">{scope}{detail.costScope === "per_party" && partySize ? ` (${plural(partySize, "person", "people")})` : ""}</li>}
        <li className="t-body-sm bg-paper-100 rounded-sm px-3 py-1">{detail.flightsIncluded ? "Flights included" : "Flights not included"}</li>
        {detail.nights !== null && <li className="t-body-sm bg-paper-100 rounded-sm px-3 py-1">{plural(detail.nights, "night", "nights")}</li>}
        {detail.hasEstimates && <li className="t-body-sm bg-paper-100 rounded-sm px-3 py-1">Includes estimates</li>}
      </ul>
      {costs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse t-body-sm">
            <caption className="sr-only">Costs reported by the traveller, grouped by category</caption>
            <thead>
              <tr className="border-b-2 border-line-500 text-left">
                <th scope="col" className="py-2 pr-3 t-ui">Item</th>
                <th scope="col" className="py-2 pr-3 t-ui">Amount</th>
                <th scope="col" className="py-2 pr-3 t-ui">Type</th>
                <th scope="col" className="py-2 t-ui text-right">Line total</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.value}>
                <tr><th scope="rowgroup" colSpan={4} className="pt-4 pb-1 text-left t-ui text-ink-600">{g.label}</th></tr>
                {g.lines.map((l, i) => {
                  const basis = l.basis !== "total" ? ` ${labelOf(COST_BASES, l.basis).toLowerCase()}` : "";
                  return (
                    <tr key={i} className="border-b border-paper-200 align-top">
                      <td className="py-2 pr-3">{l.note || g.label}{l.date ? <span className="block text-ink-600">{formatDate(l.date)}</span> : null}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatMoney(l.amountMinor, l.currency)}{basis}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</td>
                      <td className="py-2 pr-3">{l.kind === "estimate" ? "Estimate" : "Actual spend"}</td>
                      <td className="py-2 text-right whitespace-nowrap">{formatMoney(l.amountMinor * l.quantity, l.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
            <tfoot>
              {totals.map((t, i) => (
                <tr key={t.currency} className={i === 0 ? "border-t-2 border-line-500" : ""}>
                  <th scope="row" colSpan={3} className="py-2 pr-3 text-left t-ui">Total in {t.currency}{scope ? ` (${scope.toLowerCase()})` : ""}</th>
                  <td className="py-2 text-right t-ui whitespace-nowrap">{formatMoney(t.totalMinor, t.currency)}</td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}
      {perParty && totals.length > 0 && (
        <p className="t-body-sm text-ink-600 mt-3 mb-0">About {totals.map((t) => formatMoney(perPerson(t.totalMinor, partySize), t.currency)).join(" and ")} per person.</p>
      )}
      {totals.length > 1 && <p className="t-body-sm text-ink-600 mt-2 mb-0">Each currency is totalled separately. Amounts are shown as the traveller entered them and are not converted.</p>}
      {detail.costNotes && (
        <div className="mt-4">
          <h3 className="t-heading-3 m-0">Included and left out</h3>
          <UserText text={detail.costNotes} className="mt-2" />
        </div>
      )}
    </section>
  );
}

function ItinerarySection({ detail }: { detail: TripDetail }) {
  if (!detail.days.length) return null;
  return (
    <section className="mt-10" aria-labelledby="itinerary-heading">
      <h2 id="itinerary-heading" className="t-heading-2 m-0">Day by day</h2>
      <p className="t-body-sm text-ink-600 mt-1">What the traveller did on their trip. Times and prices may have changed since.</p>
      <ol className="list-none m-0 p-0 mt-4 grid gap-8">
        {detail.days.map((day, d) => (
          <li key={d} className="border-t border-paper-200 pt-4">
            <h3 className="t-heading-3 m-0">
              Day {d + 1}{day.title ? `: ${day.title}` : ""}
              {day.date && <span className="block t-body-sm text-ink-600 font-normal mt-1">{formatDate(day.date)}</span>}
            </h3>
            {day.stops.length > 0 && (
              <ol className="mt-3 pl-5 grid gap-4">
                {day.stops.map((s, i) => (
                  <li key={i}>
                    <p className="t-ui m-0">{s.title}</p>
                    {(s.destination || s.place) && (
                      <p className="t-body-sm text-ink-600 m-0 mt-1">
                        {s.place}{s.place && s.destination ? ", " : ""}
                        {s.destination && <Link href={`/community/${s.destination.path}`} className="text-marine-600 underline">{s.destination.label}</Link>}
                      </p>
                    )}
                    {s.timeNote && <p className="t-body-sm m-0 mt-1"><span className="text-ink-600">Getting there and timing:</span> {s.timeNote}</p>}
                    {s.costMinor !== null && s.costCurrency && <p className="t-body-sm m-0 mt-1"><span className="text-ink-600">Cost:</span> {formatMoney(s.costMinor, s.costCurrency)}</p>}
                    {s.description && <UserText text={s.description} className="mt-2" />}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PhotoGallery({ post }: { post: Detail }) {
  if (!post.photos.length) return null;
  return (
    <section className="mt-10" aria-labelledby="photos-heading">
      <h2 id="photos-heading" className="t-heading-2 m-0">Photos</h2>
      <ul className="list-none m-0 p-0 mt-4 grid gap-6 sm:grid-cols-2">
        {post.photos.map((p, i) => (
          <li key={p.id}>
            <figure className="m-0">
              <a href={p.url} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- member photo with its own resized variants from the CMS */}
                <img
                  src={p.cardUrl}
                  srcSet={`${p.thumbUrl} 480w, ${p.cardUrl} 960w`}
                  sizes="(min-width: 640px) 380px, 100vw"
                  alt={p.alt}
                  width={p.width ?? undefined}
                  height={p.height ?? undefined}
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="w-full h-auto rounded-sm bg-paper-100"
                />
              </a>
              <figcaption className="t-meta text-ink-400 mt-2 normal-case tracking-normal">Photo: {post.author.displayName}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function TripPage({ params, searchParams }: Props) {
  const { key } = await params;
  const query = await searchParams;
  const repliesPage = Math.max(1, Number(query.answers) || 1);
  const page = await loadPostPage("trip", key, repliesPage);
  if ("closed" in page) return <CommunityClosed />;
  const { post, viewer, returnTo } = page;
  const detail = post.tripDetail!;
  const trip = post.trip;
  const place = post.destinations[0];
  const crumbs = [{ label: "Community", href: "/community" }, ...(place ? [{ label: place.name, href: `/community/${place.path}` }] : []), { label: "Trip reports", href: "/community/trips" }, { label: post.title }];
  const context = [
    whenText(trip),
    trip?.durationDays && plural(trip.durationDays, "day", "days"),
    trip?.partySize && plural(trip.partySize, "traveller", "travellers"),
    detail.partyType && labelOf(PARTY_TYPES, detail.partyType),
    post.style && styleLabel(post.style),
  ].filter(Boolean) as string[];
  const guides = place ? await guidesForDestination(place.id) : [];
  // The message in the address is not shown as it is, so nobody can put their own words on this page.
  const copyError = Boolean(query.copyError);
  return (
    <PageShell>
      <JsonLd data={[tripJsonLd(post, page.replies.items), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <article className="mt-6 max-w-measure">
        <p className="t-meta text-ink-400 m-0 flex flex-wrap gap-x-3">
          <span className="text-ochre-700">Trip report</span>
          {post.destinations.map((d) => <Link key={d.id} href={`/community/${d.path}`} className="text-ink-400 hover:text-marine-600">{d.label}</Link>)}
        </p>
        <h1 className="t-heading-1 mt-2 mb-0">{post.title}</h1>
        <PostMeta page={page} />
        <div className="mt-3"><CommunityLabel /></div>
        {context.length > 0 && <ul className="mt-6 flex flex-wrap gap-2 list-none m-0 p-0" aria-label="Trip details">{context.map((c) => <li key={c} className="t-body-sm bg-paper-100 rounded-sm px-3 py-1">{c}</li>)}</ul>}
        <UserText text={post.body} className="mt-6" />

        <CostsSection detail={detail} partySize={trip?.partySize ?? null} />
        <ItinerarySection detail={detail} />

        {detail.days.length > 0 && (
          <div className="mt-6 bg-paper-100 rounded-md p-4">
            {copyError && <div className="mb-3"><Notice tone="error" title="The itinerary was not copied">Please try again. If it still does not work, you may already have the most trip plans an account can keep; remove one from <Link href="/account/trips" className="text-marine-600 underline">your trips</Link> first.</Notice></div>}
            {viewer.member ? (
              <form action={copyItineraryAction}>
                <input type="hidden" name="contributionId" value={post.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className={secondaryButtonClass}>Copy this itinerary to my trips</button>
                <p className="t-body-sm text-ink-600 mt-2 mb-0">You get your own private copy to change as you like. It links back to this report, and the original stays as it is.</p>
              </form>
            ) : (
              <SignInTo action="copy this itinerary to your own private trip plan" returnTo={returnTo} />
            )}
          </div>
        )}

        {detail.transport && <section className="mt-10" aria-labelledby="transport-heading"><h2 id="transport-heading" className="t-heading-2 m-0">Getting around</h2><UserText text={detail.transport} className="mt-3" /></section>}
        {detail.recommendations && <section className="mt-10" aria-labelledby="recommend-heading"><h2 id="recommend-heading" className="t-heading-2 m-0">Recommendations</h2><UserText text={detail.recommendations} className="mt-3" /></section>}
        {detail.mistakes && <section className="mt-10" aria-labelledby="mistakes-heading"><h2 id="mistakes-heading" className="t-heading-2 m-0">What they would do differently</h2><UserText text={detail.mistakes} className="mt-3" /></section>}

        <PhotoGallery post={post} />
        <PostToolbar page={page} />
      </article>
      <RepliesSection page={page} answersPage={repliesPage} kind="comment" />
      <RelatedGuides guides={guides} />
    </PageShell>
  );
}
