import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CardList } from "@/components/community/cards";
import { ReportButton } from "@/components/community/post-actions";
import { CommunityClosed, EmptyState, JsonLd, PageShell, Pagination, UserText, formatDay } from "@/components/community/ui";
import { getPublicProfile } from "@/lib/community/members";
import { getViewer } from "@/lib/community/next/session";
import { listPublished } from "@/lib/community/queries";
import { profileIndexing, profileJsonLd, robotsFor } from "@/lib/community/seo";
import { canViewCommunity, getSettings } from "@/lib/community/settings";
import { HANDLE_PATTERN, excerpt } from "@/lib/community/text";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const pageOf = (value: string | string[] | undefined) => Math.max(1, Math.floor(Number(Array.isArray(value) ? value[0] : value) || 1));

/** Suspended, deleted and unverified accounts have no public profile, so they answer "not found". */
const loadProfile = cache(async (raw: string) => {
  const handle = decodeURIComponent(raw);
  if (!HANDLE_PATTERN.test(handle.toLowerCase())) return null;
  const profile = await getPublicProfile(handle);
  return profile ? { profile, requested: handle } : null;
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return { title: "Community", robots: { index: false, follow: false } };
  const loaded = await loadProfile((await params).handle);
  if (!loaded) return {};
  const { profile } = loaded;
  const page = pageOf((await searchParams).page);
  const base = `/travellers/${profile.handle}`;
  const description = profile.bio ? excerpt(profile.bio, 155) : `${profile.displayName}’s questions, answers and trip reports on Travel Notes.`;
  const decision = profileIndexing(profile, await getSettings());
  return {
    title: page > 1 ? `${profile.displayName} (@${profile.handle}) – page ${page}` : `${profile.displayName} (@${profile.handle})`,
    description,
    alternates: { canonical: page > 1 ? `${base}?page=${page}` : base },
    robots: robotsFor(decision),
    openGraph: { type: "profile", title: profile.displayName, description, url: base },
  };
}

export default async function TravellerPage({ params, searchParams }: Props) {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  const loaded = await loadProfile((await params).handle);
  if (!loaded) notFound();
  const { profile } = loaded;
  const base = `/travellers/${profile.handle}`;
  if (loaded.requested !== profile.handle) permanentRedirect(base);
  const page = pageOf((await searchParams).page);
  const posts = await listPublished({ authorId: profile.id, page, pageSize: 10 });
  if (page > 1 && page > posts.totalPages) notFound();
  const isSelf = viewer.member?.id === profile.id;

  return (
    <PageShell>
      <JsonLd data={profileJsonLd(profile)} />
      <Breadcrumbs items={[{ label: "Community", href: "/community" }, { label: profile.displayName }]} />
      <header className="mt-4 mb-8">
        <p className="t-meta text-ink-400 m-0">Community member</p>
        <h1 className="t-heading-1 mt-2 mb-0">{profile.displayName}</h1>
        <p className="t-body-sm text-ink-600 mt-1 mb-0">@{profile.handle}</p>
        {profile.experience && <p className="t-body-sm text-ink-900 mt-3 mb-0">{profile.experience}</p>}
        {profile.bio && <UserText text={profile.bio} className="t-body mt-3 max-w-measure" />}
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 t-body-sm text-ink-600 m-0">
          <div className="flex gap-1"><dt>Joined:</dt><dd className="m-0 text-ink-900">{formatDay(profile.memberSince)}</dd></div>
          <div className="flex gap-1"><dt>Published posts:</dt><dd className="m-0 text-ink-900">{profile.publishedCount}</dd></div>
          <div className="flex gap-1"><dt>Published answers and comments:</dt><dd className="m-0 text-ink-900">{profile.answerCount}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-4 items-center">
          {isSelf ? (
            <Link href="/account/settings#profile" className="t-ui text-marine-600 underline underline-offset-4 min-h-11 inline-flex items-center">Edit your profile</Link>
          ) : (
            viewer.member && <ReportButton targetType="member" targetId={profile.id} label="Report this profile" />
          )}
        </div>
      </header>

      <section aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="t-heading-2 m-0 mb-6">Posts by {profile.displayName}</h2>
        {posts.items.length ? (
          <CardList cards={posts.items} label={`Posts by ${profile.displayName}`} />
        ) : (
          <EmptyState title="No published posts yet.">{isSelf ? "Your questions, trip reports and activities appear here after a moderator approves them." : "Questions, trip reports and activities appear here after a moderator approves them."}</EmptyState>
        )}
        <Pagination page={posts.page} totalPages={posts.totalPages} href={(p) => (p > 1 ? `${base}?page=${p}` : base)} />
      </section>
      <p className="t-body-sm text-ink-600 mt-10 mb-0">
        Profiles are written by members themselves, not by the Travel Notes editorial team. <Link href="/community/guidelines" className="text-marine-600 underline">Community guidelines</Link>
      </p>
    </PageShell>
  );
}
