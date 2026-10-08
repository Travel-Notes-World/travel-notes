import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Attendees, EventFacts, EventStatusBanner, OrganiserStatusForm, RsvpControl } from "@/components/community/event-parts";
import { PostMeta, PostToolbar, RelatedGuides, RepliesSection } from "@/components/community/post-parts";
import { CommunityClosed, CommunityLabel, JsonLd, PageShell, StatusBadge, UserText } from "@/components/community/ui";
import { publicAttendees } from "@/lib/community/engagement";
import { loadPostPage, postMetadata } from "@/lib/community/next/pages";
import { guidesForDestination } from "@/lib/community/queries";
import { activityCategoryLabel, breadcrumbJsonLd, eventJsonLd } from "@/lib/community/seo";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postMetadata("activity", (await params).key, "Activity");
}

/** Short result codes from the RSVP and organiser forms. Anything unexpected is ignored. */
const flashCode = (value: string | undefined) => (value && /^[a-z_-]{1,40}$/.test(value) ? value : undefined);

export default async function ActivityPage({ params, searchParams }: Props) {
  const { key } = await params;
  const query = await searchParams;
  const answersPage = Math.max(1, Number(query.answers) || 1);
  const page = await loadPostPage("activity", key, answersPage);
  if ("closed" in page) return <CommunityClosed />;
  const { post, state, viewer } = page;
  const a = post.activity!;
  const place = post.destinations[0];
  const crumbs = [{ label: "Activities", href: "/activities" }, ...(place ? [{ label: place.name, href: `/activities?in=${encodeURIComponent(place.path)}` }] : []), { label: post.title }];
  const [people, guides] = await Promise.all([publicAttendees(post.id), place ? guidesForDestination(place.id) : Promise.resolve([])]);
  return (
    <PageShell>
      <JsonLd data={[eventJsonLd(post), breadcrumbJsonLd(crumbs)].filter(Boolean)} />
      <Breadcrumbs items={crumbs} />
      <article className="mt-6 max-w-measure">
        <p className="t-meta text-ink-400 m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-ochre-700">{activityCategoryLabel(a.category)}</span>
          <StatusBadge state={a.status} kind="event" />
          {post.destinations.map((d) => <Link key={d.id} href={`/community/${d.path}`} className="text-ink-400 hover:text-marine-600">{d.label}</Link>)}
        </p>
        <h1 className="t-heading-1 mt-2 mb-0">{post.title}</h1>
        <PostMeta page={page} />
        <div className="mt-3"><CommunityLabel /></div>
        {a.status !== "scheduled" && <div className="mt-6"><EventStatusBanner activity={a} /></div>}
        <EventFacts activity={a} path={post.path} />
        <p className="t-body-sm text-ink-600 mt-3 mb-0">
          {a.category === "community_gathering"
            ? "Organised by a member, not by Travel Notes."
            : "Run by a third party. Travel Notes does not organise, sell or endorse it."}{" "}
          A moderator checked this listing for completeness and relevance; that is not a guarantee of safety or accuracy. Check the latest details with the organiser before you go.
        </p>
        <UserText text={post.body} className="mt-6" sponsored={a.category === "commercial_activity" || a.disclosure === "affiliate" || a.disclosure === "sponsored"} />
        {post.photos.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 list-none m-0 p-0" aria-label="Photos">
            {post.photos.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- approved member photos are served from the CMS at their stored sizes */}
                <img src={p.cardUrl} alt={p.alt} width={p.width ?? undefined} height={p.height ?? undefined} loading="lazy" decoding="async" className="w-full h-auto rounded-md" />
              </li>
            ))}
          </ul>
        )}
        <RsvpControl activityId={post.id} activity={a} signedIn={Boolean(viewer.member)} current={state?.rsvp ?? null} returnTo={page.returnTo} flash={flashCode(query.rsvp)} />
        <Attendees activity={a} people={people} />
        {state?.isAuthor && <OrganiserStatusForm postId={post.id} status={a.status} returnTo={page.returnTo} flash={flashCode(query.status)} />}
        <PostToolbar page={page} />
      </article>
      <RepliesSection page={page} answersPage={answersPage} kind="comment" />
      <RelatedGuides guides={guides} />
    </PageShell>
  );
}
