import type { Metadata } from "next";
import Link from "next/link";

import { AccountNav } from "@/components/community/account-nav";
import { ContributionCard } from "@/components/community/cards";
import { BookmarkButton, FollowButton } from "@/components/community/post-actions";
import { EmptyState, PageHeader, PageShell } from "@/components/community/ui";
import { listBookmarks, listFollows } from "@/lib/community/engagement";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };

const RETURN = "/account/saved";

export default async function SavedPage() {
  const member = await requireMemberPage(RETURN);
  const [bookmarks, follows, unread] = await Promise.all([listBookmarks(member), listFollows(member), unreadCount(member.id)]);
  return (
    <PageShell>
      <PageHeader eyebrow="Your account" title="Saved" intro="Posts and guides you bookmarked, and destinations you follow. Only you can see this list." />
      <AccountNav current="saved" unread={unread} />

      <section aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="t-heading-2 m-0">Community posts <span className="text-ink-600 font-normal">({bookmarks.posts.length})</span></h2>
        {bookmarks.posts.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No saved posts">Press Save on a question, trip report or activity to keep it here. Posts that are no longer public drop off this list.</EmptyState>
          </div>
        ) : (
          <ul className="list-none m-0 p-0 mt-4 grid gap-6 max-w-[860px]">
            {bookmarks.posts.map((card) => (
              <li key={card.id}>
                <ContributionCard card={card} />
                <div className="mt-2"><BookmarkButton targetType="contribution" targetId={card.id} on returnTo={RETURN} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="guides-heading" className="mt-12">
        <h2 id="guides-heading" className="t-heading-2 m-0">Travel guides <span className="text-ink-600 font-normal">({bookmarks.guides.length})</span></h2>
        {bookmarks.guides.length === 0 ? (
          <p className="t-body-sm text-ink-600 mt-2">No saved guides. Browse the <Link href="/stories" className="text-marine-600">Travel Notes guides</Link>.</p>
        ) : (
          <ul className="list-none m-0 p-0 mt-4 grid gap-6 max-w-[860px]">
            {bookmarks.guides.map((g) => (
              <li key={g.id} className="border-t border-paper-200 pt-4">
                <p className="t-meta text-ochre-700 m-0">Travel Notes guide</p>
                <h3 className="t-card-title m-0 mt-1"><Link href={g.path} className="text-ink-900 no-underline hover:underline underline-offset-4">{g.title}</Link></h3>
                {g.excerpt && <p className="t-body-sm text-ink-600 m-0 mt-1">{g.excerpt}</p>}
                <div className="mt-2"><BookmarkButton targetType="article" targetId={g.id} on returnTo={RETURN} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="follows-heading" className="mt-12">
        <h2 id="follows-heading" className="t-heading-2 m-0">Destinations you follow <span className="text-ink-600 font-normal">({follows.length})</span></h2>
        <p className="t-body-sm text-ink-600 mt-2 max-w-measure">New posts about these places can come in your destination digest email, if you switch it on in <Link href="/account/settings#email" className="text-marine-600">settings</Link>.</p>
        {follows.length === 0 ? (
          <p className="t-body-sm text-ink-600">You do not follow any destinations yet. Use the Follow button on a <Link href="/destinations" className="text-marine-600">destination page</Link>.</p>
        ) : (
          <ul className="list-none m-0 p-0 mt-4 grid gap-4 max-w-[860px]">
            {follows.map((d) => (
              <li key={d.id} className="border-t border-paper-200 pt-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={`/destinations/${d.path}`} className="t-ui text-ink-900 underline-offset-4 hover:underline">{d.label}</Link>
                <FollowButton destinationId={d.id} name={d.name} on returnTo={RETURN} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
