import type { Metadata } from "next";
import Link from "next/link";

import { ReplyDecisionForm } from "@/components/community/moderation-ui";
import { EmptyState, PageHeader, Pagination, UserText } from "@/components/community/ui";
import { pendingReplies } from "@/lib/community/moderation";
import { requireModeratorPage } from "@/lib/community/next/session";
import { formatAge, formatDateTime, pageOf } from "../format";

export const metadata: Metadata = { title: "Replies waiting" };

/** Replies waiting for review, oldest first, each with the post it belongs to. */
export default async function PendingRepliesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireModeratorPage();
  const params = await searchParams;
  const all = await pendingReplies(staff);
  const { items, page, totalPages } = pageOf(all, Number(params.page) || 1);
  return (
    <>
      <PageHeader title="Replies waiting for review" intro={`${all.length} ${all.length === 1 ? "reply is" : "replies are"} waiting. Oldest first. A reply is only published under a post that is itself published.`} />
      {items.length ? (
        <ol className="list-none m-0 p-0 grid gap-4" aria-label="Replies waiting">
          {items.map((r) => (
            <li key={r.id} className="border border-line-500 rounded-md p-4 bg-paper-000 min-w-0">
              <p className="t-meta text-ink-600 m-0">{r.isReplyToReply ? "Comment on an answer" : "Answer or comment"} on: <Link href={`/moderation/posts/${r.contributionId}`} className="text-marine-600">{r.contributionTitle || "(untitled post)"}</Link>{r.contributionPath && <> · <Link href={r.contributionPath} className="text-marine-600">public page</Link></>}</p>
              <p className="t-body-sm m-0 mt-1">By {r.authorId ? <Link href={`/moderation/members/${r.authorId}`} className="text-marine-600">{r.authorName}</Link> : r.authorName} · {formatDateTime(r.createdAt)} · waiting {formatAge(r.createdAt)}</p>
              <UserText text={r.body} className="t-body-sm mt-3" />
              <div className="mt-3"><ReplyDecisionForm replyId={r.id} state="pending" /></div>
            </li>
          ))}
        </ol>
      ) : <EmptyState title="No replies are waiting.">New answers and comments appear here.</EmptyState>}
      <Pagination page={page} totalPages={totalPages} href={(p) => (p > 1 ? `/moderation/replies?page=${p}` : "/moderation/replies")} />
    </>
  );
}
