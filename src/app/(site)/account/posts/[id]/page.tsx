import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AccountNav } from "@/components/community/account-nav";
import { EventStatusForm, RemovePublishedForm } from "@/components/community/account-forms";
import { ActivityForm } from "@/components/community/activity-form";
import { QuestionForm } from "@/components/community/contribution-form";
import { TripForm } from "@/components/community/trip-form";
import { Notice, PageHeader, PageShell, secondaryButtonClass, StatusBadge, UserText } from "@/components/community/ui";
import { deleteDraftAction, withdrawAction } from "@/lib/community/actions/contributions";
import { getOwn, type OwnEditable } from "@/lib/community/contributions";
import { isCommunityError } from "@/lib/community/errors";
import { formInitial, topicOptions } from "@/lib/community/next/form-initial";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";

export const dynamic = "force-dynamic";
// The title stays generic: a private draft's title is not put into the page metadata.
export const metadata: Metadata = { title: "Your post", robots: { index: false, follow: false } };

const TYPE_LABEL = { question: "Question", trip: "Trip report", activity: "Activity" } as const;

const dangerSummary = "t-ui text-signal-error cursor-pointer min-h-11 inline-flex items-center";

export default async function OwnPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const member = await requireMemberPage(`/account/posts/${encodeURIComponent(id)}`);
  let post: OwnEditable;
  try {
    post = await getOwn(member, id);
  } catch (error) {
    // Someone else's post answers exactly like one that does not exist.
    if (isCommunityError(error) && error.code === "not_found") notFound();
    throw error;
  }
  const [initial, topics, unread] = await Promise.all([formInitial(post.content), topicOptions(), unreadCount(member.id)]);
  const published = post.state === "published";
  const formProps = { id: post.id, initial, published, topics };
  const title = post.content.title || "Untitled draft";
  const canWithdraw = post.state === "pending" || (published && post.editPending);
  const canDelete = ["draft", "changes_requested", "rejected"].includes(post.state);
  const canRemove = published || post.state === "hidden";

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Your account", href: "/account" }, { label: TYPE_LABEL[post.type] }]} />
      <PageHeader eyebrow={TYPE_LABEL[post.type]} title={title} />
      <AccountNav current="dashboard" unread={unread} />

      <div className="grid gap-4 mb-8 max-w-measure">
        {query.sent === "new" && <Notice tone="success" title="Sent for review">Thank you. A moderator will check your post. You will get a notification when they decide.</Notice>}
        {query.sent === "edit" && <Notice tone="success" title="Changes sent for review">The public version stays as it is until a moderator approves your changes.</Notice>}
        {query.saved && <Notice tone="success" title="Draft saved">Only you can see it. Come back to it any time from your account.</Notice>}

        <p className="t-body-sm m-0 flex flex-wrap items-center gap-3">
          <span>Status:</span> <StatusBadge state={post.state} />
          {post.publicPath && <Link href={post.publicPath} className="text-marine-600 underline">See the public page</Link>}
        </p>

        {post.note && ["changes_requested", "rejected", "hidden"].includes(post.state) && (
          <Notice tone={post.state === "changes_requested" ? "warning" : "info"} title={post.state === "changes_requested" ? "The moderator asked for changes" : "Note from the moderator"}>
            <UserText text={post.note} />
          </Notice>
        )}
        {post.state === "pending" && <Notice tone="info" title="Waiting for review">A moderator will check it soon. To change something first, withdraw it: it goes back to your drafts.</Notice>}
        {published && post.editPending && <Notice tone="info" title="Your edit is waiting for review">The form below shows your edited version. The public page still shows the approved version until a moderator approves the edit.</Notice>}
        {post.state === "rejected" && <Notice tone="info" title="Not accepted">This post was not published. You can delete it, or write a new post that follows the <Link href="/community/guidelines" className="text-marine-600 underline">community rules</Link>.</Notice>}
        {post.state === "hidden" && <Notice tone="warning" title="Hidden by a moderator">This post is not public at the moment. Contact us through the <Link href="/contact" className="text-marine-600 underline">contact page</Link> if you think this is a mistake.</Notice>}
        {post.state === "removed" && <Notice tone="info" title="Removed">This post is no longer public.</Notice>}
      </div>

      {post.canEdit ? (
        post.type === "question" ? <QuestionForm {...formProps} /> : post.type === "trip" ? <TripForm {...formProps} /> : <ActivityForm {...formProps} />
      ) : (
        <section aria-labelledby="content-heading" className="max-w-measure">
          <h2 id="content-heading" className="t-heading-3 m-0">What you sent</h2>
          <UserText text={post.content.body} className="mt-3" />
        </section>
      )}

      {(canWithdraw || canDelete || canRemove || (post.type === "activity" && published && post.eventStatus !== "cancelled")) && (
        <section aria-labelledby="manage-heading" className="mt-12 border-t border-paper-200 pt-6 max-w-[760px]">
          <h2 id="manage-heading" className="t-heading-3 m-0">Manage this post</h2>

          {canWithdraw && (
            <form action={withdrawAction} className="mt-4">
              <input type="hidden" name="id" value={post.id} />
              <p className="t-body-sm text-ink-600 mt-0">{post.state === "pending" ? "Take it back from review. It becomes a draft again and you can edit it." : "Cancel your edit. The public version stays as it is."}</p>
              <button type="submit" className={secondaryButtonClass}>{post.state === "pending" ? "Withdraw from review" : "Withdraw my edit"}</button>
            </form>
          )}

          {post.type === "activity" && published && post.eventStatus !== "cancelled" && (
            <details className="mt-6">
              <summary className="t-ui text-marine-600 cursor-pointer min-h-11 inline-flex items-center">Cancel or postpone this activity</summary>
              <EventStatusForm id={post.id} />
            </details>
          )}

          {canDelete && (
            <details className="mt-6">
              <summary className={dangerSummary}>Delete this {post.state === "rejected" ? "post" : "draft"}</summary>
              <form action={deleteDraftAction} className="mt-3">
                <input type="hidden" name="id" value={post.id} />
                <p className="t-body-sm mt-0">This deletes it and any photos you added to it. It cannot be undone.</p>
                <button type="submit" className="inline-flex items-center justify-center min-h-11 px-5 rounded-md border-2 border-signal-error bg-paper-000 text-signal-error t-ui hover:bg-paper-100">Yes, delete it</button>
              </form>
            </details>
          )}

          {canRemove && (
            <details className="mt-6">
              <summary className={dangerSummary}>Remove this post from the site</summary>
              <p className="t-body-sm mt-3 mb-0">The post, its photos and its answers stop being public. Moderators keep a record that it existed.</p>
              <RemovePublishedForm id={post.id} />
            </details>
          )}
        </section>
      )}
    </PageShell>
  );
}
