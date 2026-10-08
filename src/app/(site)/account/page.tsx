import type { Metadata } from "next";
import Link from "next/link";

import { AccountNav } from "@/components/community/account-nav";
import { buttonClass, EmptyState, formatDay, Notice, PageHeader, PageShell, secondaryButtonClass, StatusBadge, UserText } from "@/components/community/ui";
import { getOwnAccount } from "@/lib/community/account-view";
import type { ContributionState } from "@/lib/community/constants";
import { listOwn, type OwnItem } from "@/lib/community/contributions";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";
import { listPlans } from "@/lib/community/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

const TYPE_LABEL = { question: "Question", trip: "Trip report", activity: "Activity" } as const;

/** The order and wording of the groups. Every state a post can be in has a group, so nothing goes missing. */
const GROUPS: { title: string; states: ContributionState[]; help?: string }[] = [
  { title: "Changes requested", states: ["changes_requested"], help: "A moderator asked for changes. Read the note, edit the post and send it again." },
  { title: "Drafts", states: ["draft"], help: "Only you can see drafts." },
  { title: "Waiting for review", states: ["pending"], help: "A moderator will check these. You get a notification when they decide." },
  { title: "Published", states: ["published"] },
  { title: "Not accepted", states: ["rejected"], help: "These were not published. The moderator’s note says why. You can delete them." },
  { title: "Hidden or removed", states: ["hidden", "removed"], help: "These are not public any more." },
];

function PostRow({ item }: { item: OwnItem }) {
  const showNote = item.note && (item.state === "changes_requested" || item.state === "rejected" || item.state === "hidden");
  return (
    <li className="border-t border-paper-200 pt-4">
      <p className="t-meta text-ink-400 m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ochre-700">{TYPE_LABEL[item.type]}</span>
        <StatusBadge state={item.state} />
        {item.editPending && <span className="t-meta text-ink-600">Edit waiting for review</span>}
        <span>Updated {formatDay(item.updatedAt)}</span>
      </p>
      <h3 className="t-card-title m-0 mt-1">
        <Link href={`/account/posts/${item.id}`} className="text-ink-900 no-underline hover:underline underline-offset-4">{item.title || "Untitled draft"}</Link>
      </h3>
      {showNote && (
        <div className="mt-2 bg-paper-100 rounded-sm p-3 max-w-measure">
          <p className="t-ui m-0">Note from the moderator</p>
          <UserText text={item.note} className="t-body-sm" />
        </div>
      )}
      <p className="t-body-sm m-0 mt-2 flex flex-wrap gap-x-4">
        <Link href={`/account/posts/${item.id}`} className="text-marine-600">{["draft", "changes_requested", "published"].includes(item.state) ? "Edit" : "View"}<span className="sr-only">: {item.title || "untitled draft"}</span></Link>
        {item.path && <Link href={item.path} className="text-marine-600">See the public page<span className="sr-only">: {item.title}</span></Link>}
        {item.state === "published" && item.type === "question" && <span className="text-ink-600">{item.replyCount === 1 ? "1 answer" : `${item.replyCount} answers`}</span>}
      </p>
    </li>
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const member = await requireMemberPage("/account");
  const params = await searchParams;
  const [posts, unread, plans, account] = await Promise.all([listOwn(member), unreadCount(member.id), listPlans(member), getOwnAccount(member)]);
  const suspended = account.suspendedNow;

  return (
    <PageShell>
      <PageHeader eyebrow="Your account" title={`Hello, ${member.displayName}`} />
      <AccountNav current="dashboard" unread={unread} />

      {params.deleted && <div className="mb-6"><Notice tone="success" title="Deleted">The draft is deleted.</Notice></div>}
      {params.removed && <div className="mb-6"><Notice tone="success" title="Removed">The post is no longer public.</Notice></div>}
      {suspended && (
        <div className="mb-6">
          <Notice tone="warning" title="Your account is suspended">
            <p>You cannot post, reply, vote or report{account.suspendedUntil ? ` until ${formatDay(account.suspendedUntil)}` : " until a moderator lifts the suspension"}. You can still read, keep your drafts and change your settings.</p>
            {account.statusReason && <p>Reason: {account.statusReason}</p>}
          </Notice>
        </div>
      )}

      <section aria-labelledby="start-heading" className="mb-10">
        <h2 id="start-heading" className="sr-only">Start something new</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/community/questions/new" className={buttonClass}>Ask a question</Link>
          <Link href="/community/trips/new" className={secondaryButtonClass}>Write a trip report</Link>
          <Link href="/activities/new" className={secondaryButtonClass}>Add an activity</Link>
        </div>
        <p className="t-body-sm text-ink-600 mt-4 mb-0">
          {unread > 0 ? <Link href="/account/notifications" className="text-marine-600">{unread === 1 ? "1 unread notification" : `${unread} unread notifications`}</Link> : "No unread notifications."}
        </p>
      </section>

      <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="posts-heading">
          <h2 id="posts-heading" className="t-heading-2 m-0">Your posts</h2>
          {posts.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="You have not posted yet">
                Ask something you want to know before a trip, or share what you learned on one. A moderator checks every post before it appears.
              </EmptyState>
            </div>
          ) : (
            GROUPS.map((group) => {
              const items = posts.filter((p) => group.states.includes(p.state));
              if (!items.length) return null;
              const id = `group-${group.states[0]}`;
              return (
                <section key={id} aria-labelledby={id} className="mt-8">
                  <h3 id={id} className="t-heading-3 m-0">{group.title} <span className="text-ink-600 font-normal">({items.length})</span></h3>
                  {group.help && <p className="t-body-sm text-ink-600 mt-1 mb-0">{group.help}</p>}
                  <ul className="list-none m-0 p-0 mt-3 grid gap-4">
                    {items.map((item) => <PostRow key={item.id} item={item} />)}
                  </ul>
                </section>
              );
            })
          )}
        </section>

        <aside aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="t-heading-2 m-0">Your trip plans</h2>
          <p className="t-body-sm text-ink-600 mt-1">Private: only you can see them.</p>
          {plans.length === 0 ? (
            <p className="t-body-sm">No plans yet. <Link href="/account/trips" className="text-marine-600">Start a plan</Link>, or copy the itinerary from a trip report you like.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3">
              {plans.slice(0, 5).map((plan) => (
                <li key={plan.id} className="border-t border-paper-200 pt-3">
                  <Link href={`/account/trips/${plan.id}`} className="t-ui text-ink-900 underline-offset-4 hover:underline">{plan.title}</Link>
                  <p className="t-body-sm text-ink-600 m-0">{[plan.startDate ? formatDay(plan.startDate) : null, plan.days === 1 ? "1 day" : `${plan.days} days`].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
          {plans.length > 0 && <p className="t-body-sm mt-4"><Link href="/account/trips" className="text-marine-600">All plans{plans.length > 5 ? ` (${plans.length})` : ""}</Link></p>}
          <h2 className="t-heading-3 mt-10 mb-0">More</h2>
          <ul className="t-body-sm mt-2 pl-5">
            <li><Link href="/account/saved" className="text-marine-600">Saved posts and followed destinations</Link></li>
            <li><Link href="/account/suggest-destination" className="text-marine-600">Suggest a destination</Link></li>
            <li><Link href={`/travellers/${member.handle}`} className="text-marine-600">Your public profile</Link></li>
            <li><Link href="/community/guidelines" className="text-marine-600">Community rules</Link></li>
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}
