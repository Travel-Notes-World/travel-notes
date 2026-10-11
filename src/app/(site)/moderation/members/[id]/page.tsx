import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberSignInHelp, Panel, RestrictForm, TrustedForm } from "@/components/community/moderation-ui";
import { Notice, PageHeader, StatusBadge } from "@/components/community/ui";
import { getMemberOverview, type MemberOverview } from "@/lib/community/moderation";
import { requireModeratorPage } from "@/lib/community/next/session";
import { actionLabel, formatDateTime, isNotFound, memberStatusLabel, typeLabel } from "../../format";

export const metadata: Metadata = { title: "Member" };

/** One member as moderators see them: account, record, posts and earlier decisions. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireModeratorPage();
  const { id } = await params;
  let m: MemberOverview;
  try {
    m = await getMemberOverview(staff, id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
  return (
    <>
      <PageHeader eyebrow="Member" title={m.displayName} intro={<span className="t-body-sm">@{m.handle} · {m.email} · joined {formatDateTime(m.createdAt)}</span>} />
      {m.status === "suspended" && (
        <Notice tone="warning" title="This account is suspended">
          <p>{m.suspendedUntil ? `Until ${formatDateTime(m.suspendedUntil)}.` : "No end date."}</p>
          {m.statusReason && <p>Reason: {m.statusReason}</p>}
        </Notice>
      )}
      <Panel title="Account">
        <dl className="m-0 grid gap-2 t-body-sm sm:grid-cols-2">
          <div><dt className="t-ui">Status</dt><dd className="m-0">{memberStatusLabel(m.status)}</dd></div>
          <div><dt className="t-ui">Email confirmed</dt><dd className="m-0">{m.verified ? "Yes" : "No"}</dd></div>
          <div><dt className="t-ui">Published posts</dt><dd className="m-0">{m.counts.published}</dd></div>
          <div><dt className="t-ui">Waiting for review</dt><dd className="m-0">{m.counts.pending}</dd></div>
          <div><dt className="t-ui">Not accepted</dt><dd className="m-0">{m.counts.rejected}</dd></div>
          <div><dt className="t-ui">Published replies</dt><dd className="m-0">{m.counts.replies}</dd></div>
          <div><dt className="t-ui">Reports about this member</dt><dd className="m-0">{m.counts.reportsAgainst}</dd></div>
        </dl>
        {m.status !== "deleted" && m.counts.published > 0 && <p className="t-body-sm mt-3 mb-0"><Link href={`/travellers/${m.handle}`} className="text-marine-600">Public profile</Link></p>}
      </Panel>
      {m.status !== "deleted" && (
        <Panel title="Sign-in help">
          <MemberSignInHelp memberId={m.id} verified={m.verified} />
        </Panel>
      )}
      <Panel title={m.status === "suspended" ? "Lift the suspension" : "Suspend this account"}>
        <RestrictForm memberId={m.id} status={m.status} />
      </Panel>
      <Panel title="Trusted member">
        <p className="t-body-sm text-ink-600 mt-0">Trust is a person’s decision, never earned by posting volume. It only has an effect when the review settings use it.</p>
        <TrustedForm memberId={m.id} trusted={m.trusted} />
      </Panel>
      <Panel title="Posts">
        {m.posts.length ? (
          <ul className="list-none m-0 p-0 grid gap-2">
            {m.posts.map((p) => (
              <li key={p.id} className="t-body-sm flex flex-wrap items-center gap-2 min-w-0">
                <StatusBadge state={p.state} />
                <span className="text-ink-600">{typeLabel(p.type)}</span>
                <Link href={`/moderation/posts/${p.id}`} className="text-marine-600 break-words">{p.title || "(no title)"}</Link>
                <span className="text-ink-600">updated {formatDateTime(p.updatedAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="t-body-sm m-0">No posts.</p>}
      </Panel>
      <Panel title="Account decisions">
        {m.actions.length ? (
          <ol className="list-none m-0 p-0 grid gap-2 t-body-sm">
            {m.actions.map((a, i) => <li key={i}>{formatDateTime(a.at)} · {actionLabel(a.action)}{a.reason && <span className="block text-ink-600">Reason: {a.reason}</span>}</li>)}
          </ol>
        ) : <p className="t-body-sm m-0">None recorded.</p>}
      </Panel>
    </>
  );
}
