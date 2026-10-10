import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CardList } from "@/components/community/cards";
import { FollowButton } from "@/components/community/post-actions";
import { CommunityClosed, EmptyState, JsonLd, PageShell, buttonClass, secondaryButtonClass } from "@/components/community/ui";
import { destinationsWithContent, getDestinationByPath } from "@/lib/community/destinations";
import { isFollowing } from "@/lib/community/engagement";
import { getViewer } from "@/lib/community/next/session";
import { countsForDestination, guidesForDestination, listPublished } from "@/lib/community/queries";
import { breadcrumbJsonLd, hubIndexing, robotsFor } from "@/lib/community/seo";
import { canViewCommunity } from "@/lib/community/settings";

/**
 * Destination hubs: /community/thailand, /community/thailand/bangkok.
 *
 * Static siblings (/community/questions, /community/trips, /community/topics, /community/guidelines)
 * always win over this catch-all in Next.js routing, so they are never shadowed. A deeper address
 * under one of them that matches nothing (for example /community/questions/a/b) falls through to
 * here and gets a 404, because no destination path starts with those words.
 */
type Props = { params: Promise<{ path: string[] }> };

const RESERVED = new Set(["questions", "trips", "topics", "guidelines", "new"]);

const loadHub = cache(async (segments: string[]) => {
  const path = segments.map((s) => decodeURIComponent(s)).join("/");
  if (!segments.length || segments.length > 4 || RESERVED.has(segments[0])) return null;
  const hub = await getDestinationByPath(path.toLowerCase());
  if (!hub) return null;
  const counts = await countsForDestination(hub.id);
  return { hub, counts, decision: hubIndexing(hub, counts), requestedPath: path };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return { title: "Community", robots: { index: false, follow: false } };
  const loaded = await loadHub((await params).path);
  if (!loaded) return {};
  const { hub, decision } = loaded;
  const description = hub.summary || `Questions, trip reports and activities about ${hub.label} from the Travel Notes community.`;
  return {
    title: `${hub.name} travel community`,
    description,
    alternates: { canonical: `/community/${hub.path}` },
    robots: robotsFor(decision),
    openGraph: { title: `${hub.label}: traveller questions and trip reports`, description, url: `/community/${hub.path}` },
  };
}

export default async function HubPage({ params }: Props) {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  const loaded = await loadHub((await params).path);
  if (!loaded) notFound();
  const { hub, counts } = loaded;
  // One address per hub: "/community/Thailand" goes to "/community/thailand".
  if (loaded.requestedPath !== hub.path) permanentRedirect(`/community/${hub.path}`);

  const segments = hub.path.split("/");
  const ancestorPaths = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join("/"));
  const [ancestors, questions, trips, activities, children, guides, following] = await Promise.all([
    Promise.all(ancestorPaths.map((p) => getDestinationByPath(p))),
    listPublished({ type: "question", destinationId: hub.id, pageSize: 5 }),
    listPublished({ type: "trip", destinationId: hub.id, pageSize: 5 }),
    listPublished({ type: "activity", destinationId: hub.id, pageSize: 5 }),
    destinationsWithContent({ parentId: hub.id, max: 60 }),
    guidesForDestination(hub.id, 4),
    viewer.member ? isFollowing(viewer.member, hub.id) : Promise.resolve(false),
  ]);

  const crumbs = [
    { label: "Community", href: "/community" },
    ...ancestors.filter((a): a is NonNullable<typeof a> => Boolean(a)).map((a) => ({ label: a.name, href: `/community/${a.path}` })),
    { label: hub.name },
  ];
  const returnTo = `/community/${hub.path}`;
  const dest = `?destination=${encodeURIComponent(hub.id)}`;
  const total = counts.questions + counts.trips + counts.activities;

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([...crumbs.slice(0, -1), { label: hub.name, href: returnTo }])} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 mb-8">
        <p className="t-meta text-ink-400 m-0">Community{hub.parentName ? ` · ${hub.parentName}` : ""}</p>
        <h1 className="t-heading-1 mt-2 mb-0">{hub.name}</h1>
        {hub.summary && <p className="t-deck mt-3 mb-0 max-w-measure">{hub.summary}</p>}
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 t-body-sm text-ink-600 m-0">
          <div className="flex gap-1"><dt>Questions:</dt><dd className="m-0 text-ink-900">{counts.questions}</dd></div>
          <div className="flex gap-1"><dt>Trip reports:</dt><dd className="m-0 text-ink-900">{counts.trips}</dd></div>
          <div className="flex gap-1"><dt>Upcoming activities:</dt><dd className="m-0 text-ink-900">{counts.activities}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`/community/questions/new${dest}`} className={buttonClass}>Ask about {hub.name}</Link>
          <Link href={`/community/trips/new${dest}`} className={secondaryButtonClass}>Share a trip</Link>
          <Link href={`/activities/new${dest}`} className={secondaryButtonClass}>Submit an activity</Link>
          {viewer.member ? (
            <FollowButton destinationId={hub.id} name={hub.name} on={following} returnTo={returnTo} />
          ) : (
            <Link href={`/account/sign-in?next=${encodeURIComponent(returnTo)}`} className="t-ui text-marine-600 underline underline-offset-4 min-h-11 inline-flex items-center">Sign in to follow {hub.name}</Link>
          )}
        </div>
      </header>

      {total === 0 && (
        <div className="mb-10">
          <EmptyState title={`No approved posts about ${hub.name} yet.`} action={<Link href={`/community/questions/new${dest}`} className={buttonClass}>Ask the first question</Link>}>
            Been there? A question, a short trip report or a local event helps the next traveller. Every post is checked by a moderator before it appears.
          </EmptyState>
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-12 content-start">
          <HubSection id="questions" title="Latest questions" count={counts.questions} more={`/search?type=question&destination=${hub.id}`} moreLabel={`All questions about ${hub.name}`}>
            {questions.items.length ? <CardList cards={questions.items} label={`Questions about ${hub.name}`} /> : <p className="t-body-sm text-ink-600 m-0">No questions yet.</p>}
          </HubSection>
          <HubSection id="trips" title="Latest trip reports" count={counts.trips} more={`/search?type=trip&destination=${hub.id}`} moreLabel={`All trip reports for ${hub.name}`}>
            {trips.items.length ? <CardList cards={trips.items} label={`Trip reports for ${hub.name}`} /> : <p className="t-body-sm text-ink-600 m-0">No trip reports yet.</p>}
          </HubSection>
          <HubSection id="activities" title="Upcoming activities" count={counts.activities} more={`/search?type=activity&destination=${hub.id}`} moreLabel={`All upcoming activities in ${hub.name}`}>
            {activities.items.length ? <CardList cards={activities.items} label={`Upcoming activities in ${hub.name}`} /> : <p className="t-body-sm text-ink-600 m-0">No upcoming activities listed.</p>}
          </HubSection>
        </div>

        <aside className="grid gap-10 content-start" aria-label={`More about ${hub.name}`}>
          {guides.length > 0 && (
            <section aria-labelledby="guides-heading">
              <h2 id="guides-heading" className="t-heading-3 m-0">Travel Notes guides</h2>
              <p className="t-body-sm text-ink-600 mt-1 mb-3">Written by our editorial team.</p>
              <ul className="list-none m-0 p-0 grid gap-4">
                {guides.map((g) => (
                  <li key={g.path}>
                    <Link href={g.path} className="t-ui text-ink-900 underline-offset-4 hover:underline">{g.title}</Link>
                    {g.excerpt && <p className="t-body-sm text-ink-600 mt-1 mb-0">{g.excerpt}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {children.length > 0 && (
            <section aria-labelledby="places-heading">
              <h2 id="places-heading" className="t-heading-3 m-0 mb-3">Places in {hub.name}</h2>
              <ul className="list-none m-0 p-0 grid gap-1">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/community/${c.path}`} className="inline-flex min-h-11 items-center gap-2 t-body-sm text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">
                      {c.name}
                      <span className="t-meta text-ink-400 normal-case tracking-normal">{c.posts === 1 ? "1 post" : `${c.posts} posts`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="t-body-sm text-ink-600 m-0">
            Posts here are written by members, not by Travel Notes. <Link href="/community/guidelines" className="text-marine-600 underline">How community posts work</Link>
          </p>
        </aside>
      </div>
    </PageShell>
  );
}

function HubSection({ id, title, count, more, moreLabel, children }: { id: string; title: string; count: number; more: string; moreLabel: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="t-heading-2 m-0 mb-6">{title}</h2>
      {children}
      {count > 5 && (
        <p className="mt-6 mb-0">
          <Link href={more} className="t-ui text-marine-600 underline underline-offset-4 min-h-11 inline-flex items-center">{moreLabel} ({count})</Link>
        </p>
      )}
    </section>
  );
}
