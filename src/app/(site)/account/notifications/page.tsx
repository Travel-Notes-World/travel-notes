import type { Metadata } from "next";
import Link from "next/link";

import { AccountNav } from "@/components/community/account-nav";
import { EmptyState, formatDay, linkButtonClass, PageHeader, PageShell, Pagination, secondaryButtonClass } from "@/components/community/ui";
import { markAllReadAction, markNotificationReadAction } from "@/lib/community/actions/account";
import { requireMemberPage } from "@/lib/community/next/session";
import { listNotifications } from "@/lib/community/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

const TYPE_LABEL: Record<string, string> = {
  reply_published: "Reply",
  answer_accepted: "Accepted answer",
  moderation_decision: "Moderation",
  event_changed: "Activity update",
  account_notice: "Account",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const requested = Math.max(1, Math.floor(Number(params.page) || 1));
  const here = requested > 1 ? `/account/notifications?page=${requested}` : "/account/notifications";
  const member = await requireMemberPage(here);
  const list = await listNotifications(member, requested);

  return (
    <PageShell>
      <PageHeader eyebrow="Your account" title="Notifications" intro={list.unread ? (list.unread === 1 ? "You have 1 unread notification." : `You have ${list.unread} unread notifications.`) : "You have read everything."} />
      <AccountNav current="notifications" unread={list.unread} />

      {list.unread > 0 && (
        <form action={markAllReadAction} className="mb-6">
          <button type="submit" className={secondaryButtonClass}>Mark all as read</button>
        </form>
      )}

      {list.items.length === 0 ? (
        <EmptyState title={requested > 1 ? "No notifications on this page" : "No notifications yet"}>
          You will see a notification here when someone answers your post, when a moderator decides on something you sent, and when an activity you responded to changes. Choose which of these also come by email in <Link href="/account/settings#email" className="text-marine-600 underline">settings</Link>.
        </EmptyState>
      ) : (
        <ul className="list-none m-0 p-0 grid gap-0 max-w-[860px]" aria-label="Notifications, newest first">
          {list.items.map((n) => {
            const unread = !n.readAt;
            return (
              <li key={n.id} className={`border-t border-paper-200 py-4 pl-3 border-l-4 ${unread ? "border-l-marine-600 bg-paper-100" : "border-l-transparent"}`}>
                <p className="t-meta text-ink-400 m-0 flex flex-wrap gap-x-3">
                  <span className={unread ? "text-ink-900 font-medium" : ""}>{unread ? "● Unread" : "Read"}</span>
                  <span>{TYPE_LABEL[n.type] ?? "Notice"}</span>
                  <time dateTime={n.createdAt}>{formatDay(n.createdAt)}</time>
                </p>
                <p className={`t-body-sm m-0 mt-1 ${unread ? "text-ink-900" : "text-ink-600"}`}>{n.message}</p>
                <div className="mt-1 flex flex-wrap gap-x-5">
                  {/* Opening marks it read, then goes to the page it is about. */}
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="path" value={n.path} />
                    <button type="submit" className={linkButtonClass}>Open<span className="sr-only">: {n.message}</span></button>
                  </form>
                  {unread && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="path" value={here} />
                      <button type="submit" className={linkButtonClass}>Mark as read<span className="sr-only">: {n.message}</span></button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={list.page} totalPages={list.totalPages} href={(p) => (p > 1 ? `/account/notifications?page=${p}` : "/account/notifications")} />
    </PageShell>
  );
}
