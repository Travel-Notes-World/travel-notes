import Link from "next/link";

import type { PostPage } from "@/lib/community/next/pages";
import type { GuideLink } from "@/lib/community/queries";
import { AcceptButton, BookmarkButton, HelpfulButton, RemoveReplyButton, ReplyForm, ReportButton, SignInTo } from "./post-actions";
import { AuthorName, formatDay, Notice, Pagination, UserText } from "./ui";

/** Save and report controls under a post. */
export function PostToolbar({ page }: { page: PostPage }) {
  const { post, state, viewer, returnTo } = page;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      {viewer.member && state ? <BookmarkButton targetType="contribution" targetId={post.id} on={state.bookmarked} returnTo={returnTo} /> : null}
      {viewer.member && state && !state.isAuthor ? <ReportButton targetType="contribution" targetId={post.id} label="Report this post" /> : null}
      {viewer.member && state?.isAuthor ? <Link href={`/account/posts/${post.id}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Edit or manage your post</Link> : null}
      {!viewer.member && !viewer.staff ? <SignInTo action="save or report this post" returnTo={returnTo} /> : null}
      {viewer.staff?.canModerate ? <Link href={`/moderation/posts/${post.id}`} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Open in moderation</Link> : null}
    </div>
  );
}

/**
 * Approved replies, with the accepted answer first. Answers to a question can be marked helpful,
 * and the person who asked can accept one. Acceptance says "this helped me", not "this is correct".
 */
export function RepliesSection({ page, answersPage, kind }: { page: PostPage; answersPage: number; kind: "answer" | "comment" }) {
  const { post, replies, state, viewer, ownPending, returnTo } = page;
  const isQuestion = post.type === "question";
  const noun = kind === "answer" ? "answer" : "reply";
  const heading = kind === "answer" ? (replies.total === 1 ? "1 answer" : `${replies.total} answers`) : replies.total === 1 ? "1 reply" : `${replies.total} replies`;
  const isAsker = Boolean(state?.isAuthor) && isQuestion;
  return (
    <section className="mt-12 max-w-measure" aria-labelledby="replies-heading">
      <h2 id="replies-heading" className="t-heading-2 m-0">{heading}</h2>
      {replies.total === 0 && <p className="t-body-sm text-ink-600 mt-2">{kind === "answer" ? "No answers yet. If you have been there, your experience could help." : "No replies yet."}</p>}
      <ol className="list-none m-0 p-0 mt-4 grid gap-6">
        {replies.items.map((r) => (
          <li key={r.id} id={`reply-${r.id}`} className={`border-t pt-4 ${r.accepted ? "border-signal-success border-t-2" : "border-paper-200"}`}>
            {r.accepted && <p className="t-ui text-signal-success m-0 mb-2"><span aria-hidden="true">✓ </span>Accepted by the person who asked. This means it helped them; it is not a check of the facts.</p>}
            <UserText text={r.body} />
            <p className="t-meta text-ink-400 mt-2 mb-0 normal-case tracking-normal">By <AuthorName author={r.author} /> · {formatDay(r.publishedAt)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {viewer.member && state ? <HelpfulButton targetType="reply" targetId={r.id} on={state.votedReplies.includes(r.id)} count={r.helpfulCount} returnTo={returnTo} own={r.authorId === viewer.member.id} /> : r.helpfulCount > 0 ? <span className="t-body-sm text-ink-600">{r.helpfulCount} found this helpful</span> : null}
              {isAsker && <AcceptButton contributionId={post.id} replyId={r.id} accepted={r.accepted} returnTo={returnTo} />}
              {viewer.member && r.authorId === viewer.member.id && <RemoveReplyButton replyId={r.id} returnTo={returnTo} />}
              {viewer.member && r.authorId !== viewer.member.id && <ReportButton targetType="reply" targetId={r.id} />}
            </div>
            {r.children.length > 0 && (
              <ol className="list-none m-0 mt-4 ml-4 md:ml-8 pl-4 border-l-2 border-paper-200 grid gap-4" aria-label="Replies to this answer">
                {r.children.map((c) => (
                  <li key={c.id} id={`reply-${c.id}`}>
                    <UserText text={c.body} className="[&_p]:text-[16px]" />
                    <p className="t-meta text-ink-400 mt-1 mb-0 normal-case tracking-normal">By <AuthorName author={c.author} /> · {formatDay(c.publishedAt)}</p>
                    {viewer.member && c.authorId === viewer.member.id ? <RemoveReplyButton replyId={c.id} returnTo={returnTo} /> : viewer.member ? <ReportButton targetType="reply" targetId={c.id} /> : null}
                  </li>
                ))}
              </ol>
            )}
            {viewer.member && kind === "answer" && (
              <details className="mt-2">
                <summary className="t-body-sm text-marine-600 underline underline-offset-4 cursor-pointer min-h-11 inline-flex items-center">Reply to this answer</summary>
                <ReplyForm contributionId={post.id} parentId={r.id} returnTo={returnTo} label="Your reply" buttonText="Send reply" />
              </details>
            )}
          </li>
        ))}
      </ol>
      <Pagination page={replies.page} totalPages={replies.totalPages} href={(p) => (p === 1 ? post.path : `${post.path}?answers=${p}`)} />
      {answersPage > 1 && <p className="t-body-sm mt-4"><Link href={post.path} className="text-marine-600 underline">Back to the first page of {noun}s</Link></p>}

      {ownPending.length > 0 && (
        <div className="mt-8 grid gap-3">
          {ownPending.map((p) => (
            <Notice key={p.id} tone={p.state === "rejected" ? "error" : "info"} title={p.state === "rejected" ? `Your ${noun} was not accepted` : `Your ${noun} is waiting for review`}>
              <p>{p.body.length > 160 ? `${p.body.slice(0, 157)}…` : p.body}</p>
              {p.note && <p>Moderator’s note: {p.note}</p>}
            </Notice>
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-paper-200 pt-6">
        <h2 className="t-heading-3 m-0">{kind === "answer" ? "Your answer" : "Add a reply"}</h2>
        {viewer.member ? (
          <ReplyForm contributionId={post.id} returnTo={returnTo} label={kind === "answer" ? "Your answer" : "Your reply"} buttonText={kind === "answer" ? "Send answer for review" : "Send reply for review"} />
        ) : (
          <div className="mt-3"><SignInTo action={kind === "answer" ? "answer" : "reply"} returnTo={returnTo} /></div>
        )}
        <p className="t-body-sm text-ink-600 mt-3">New {noun === "reply" ? "replies" : `${noun}s`} are checked by a moderator before they appear. Please follow the <Link href="/community/guidelines" className="text-marine-600 underline">community rules</Link>.</p>
      </div>
    </section>
  );
}

export function RelatedGuides({ guides }: { guides: GuideLink[] }) {
  if (!guides.length) return null;
  return (
    <aside className="mt-12 max-w-measure bg-paper-100 rounded-md p-5" aria-labelledby="guides-heading">
      <h2 id="guides-heading" className="t-heading-3 m-0">Travel Notes guides</h2>
      <p className="t-body-sm text-ink-600 mt-1">Written and checked by our editorial team.</p>
      <ul className="list-none m-0 p-0 mt-3 grid gap-3">
        {guides.map((g) => <li key={g.path}><Link href={g.path} className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">{g.title}</Link><p className="t-body-sm text-ink-600 m-0">{g.excerpt}</p></li>)}
      </ul>
    </aside>
  );
}

export function PostMeta({ page }: { page: PostPage }) {
  const { post } = page;
  return (
    <p className="t-body-sm text-ink-600 mt-4 mb-0">
      By <AuthorName author={post.author} />
      {post.author.experience ? <span> · {post.author.experience} <span className="text-ink-400">(self-described)</span></span> : null}
      {post.publishedAt && <> · Published {formatDay(post.publishedAt)}</>}
      {post.updatedAt && post.publishedAt && post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10) && <> · Updated {formatDay(post.updatedAt)}</>}
    </p>
  );
}
