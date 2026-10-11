import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState, Notice, PageHeader } from "@/components/community/ui";
import { getDashboard } from "@/lib/community/dashboard";
import { requireModeratorPage } from "@/lib/community/next/session";
import { formatDateTime, formatHours } from "./format";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, note, href }: { label: string; value: ReactNode; note?: ReactNode; href?: string }) {
  const body = (
    <>
      <dt className="t-body-sm text-ink-600">{label}</dt>
      <dd className="m-0 mt-1 t-heading-2">{value}</dd>
      {note && <dd className="m-0 mt-1 t-body-sm text-ink-600">{note}</dd>}
    </>
  );
  return (
    <div className="border border-line-500 rounded-md p-4 bg-paper-000 min-w-0">
      {href ? <Link href={href} className="no-underline text-ink-900 block">{body}</Link> : body}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="t-heading-2 mt-0 mb-4">{title}</h2>
      {children}
    </section>
  );
}

const EMAIL_MODE: Record<string, string> = { resend: "Sending through Resend", capture: "Capture mode: kept in the test inbox, not sent", off: "Off: no email is sent" };

/**
 * Owner dashboard. Every number is counted from real rows when the page opens. Where there is not
 * enough data for an honest figure the page says so instead of showing a number or a chart.
 */
export default async function ModerationDashboard() {
  const staff = await requireModeratorPage();
  const d = await getDashboard(staff);
  const waiting = d.backlog.submissions + d.backlog.edits + d.backlog.replies + d.backlog.reports + d.backlog.suggestions;
  const events = Object.entries(d.events30d).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const publishedTotal = d.content.published.question + d.content.published.trip + d.content.published.activity;

  return (
    <>
      <PageHeader title="Community dashboard" intro="What is waiting for review, what is published and whether email and scheduled jobs are working." />

      {!d.settings.publicAccess && <Notice tone="info" title="The community is closed to the public">Only signed-in staff can see community pages. Open it in the CMS under Community settings when you are ready.</Notice>}

      <Section title="Waiting for a decision">
        {waiting === 0 ? (
          <EmptyState title="Nothing is waiting.">New submissions, edits, replies, reports and destination suggestions appear here.</EmptyState>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 m-0">
            <Stat label="New submissions" value={d.backlog.submissions} href="/moderation/queue?kind=new" />
            <Stat label="Edits to published posts" value={d.backlog.edits} href="/moderation/queue?kind=edit" />
            <Stat label="Replies" value={d.backlog.replies} href="/moderation/replies" />
            <Stat label="Open reports" value={d.backlog.reports} href="/moderation/reports" />
            <Stat label="Destination suggestions" value={d.backlog.suggestions} href="/moderation/suggestions" />
            <Stat label="Oldest item waiting" value={d.backlog.oldestWaitingHours === null ? "–" : formatHours(d.backlog.oldestWaitingHours)} note="Across posts, replies and reports." />
          </dl>
        )}
      </Section>

      <Section title="Published community content">
        {publishedTotal === 0 && d.content.members === 0 ? (
          <EmptyState title="No published content or verified members yet.">Counts appear here once the first posts are approved.</EmptyState>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 m-0">
            <Stat label="Questions" value={d.content.published.question} note={`${d.content.unansweredQuestions} without an approved answer`} />
            <Stat label="Trip reports" value={d.content.published.trip} />
            <Stat label="Activities" value={d.content.published.activity} />
            <Stat label="Verified active members" value={d.content.members} note={d.content.suspended ? `${d.content.suspended} suspended` : undefined} />
            <Stat label="Active contributors (30 days)" value={d.activeContributors30d} note="Members with an approved post or reply." />
            <Stat label="Accepted answers (30 days)" value={d.acceptedAnswers30d} note="Answers the asker marked as helpful. Not the same as all replies." />
          </dl>
        )}
        <div className="mt-4 max-w-measure">
          <h3 className="t-heading-3 mb-1">Time to first approved answer</h3>
          {d.medianHoursToFirstAnswer === null ? (
            <p className="t-body-sm text-ink-600 m-0">Not enough data yet. This needs at least 5 questions from the last 90 days with an approved answer; there {d.answersMeasured === 1 ? "is 1" : `are ${d.answersMeasured}`} so far.</p>
          ) : (
            <p className="t-body-sm m-0">Median <strong>{formatHours(d.medianHoursToFirstAnswer)}</strong>, from {d.answersMeasured} questions approved in the last 90 days.</p>
          )}
        </div>
      </Section>

      <Section title="Published posts by destination">
        {d.topDestinations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full max-w-measure t-body-sm border-collapse">
              <thead><tr className="text-left border-b border-line-500"><th scope="col" className="py-2 pr-4">Destination</th><th scope="col" className="py-2 text-right">Posts</th></tr></thead>
              <tbody>{d.topDestinations.map((t) => <tr key={t.name} className="border-b border-paper-200"><td className="py-2 pr-4">{t.name}</td><td className="py-2 text-right">{t.posts}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="t-body-sm text-ink-600">No published posts are linked to a destination yet.</p>}
      </Section>

      <Section title="Email">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 m-0">
          <Stat label="Mode" value={<span className="t-ui">{EMAIL_MODE[d.email.mode] ?? d.email.mode}</span>} note={d.email.mode === "capture" ? <Link href="/moderation/inbox" className="text-marine-600 underline">Open the test inbox</Link> : undefined} />
          <Stat label="Waiting to send" value={d.email.pending} note={d.email.oldestPendingMinutes !== null ? `Oldest waiting ${formatHours(d.email.oldestPendingMinutes / 60)}` : undefined} />
          <Stat label="Failed after all retries" value={d.email.failed} note={d.email.failed ? "Check the email provider and the job log." : undefined} />
        </dl>
        {d.email.problem && <div className="mt-4"><Notice tone="warning" title="Email is not working">{d.email.problem}</Notice></div>}
        {!d.uploads && <div className="mt-4"><Notice tone="warning" title="Photo uploads are off">Photo storage is not configured, so members cannot add photos.</Notice></div>}
      </Section>

      <Section title="Scheduled jobs">
        {!d.cronConfigured && <div className="mb-4"><Notice tone="warning" title="Scheduled jobs are not configured">CRON_SECRET is not set, so the daily jobs (email retries, ending past activities, photo clean-up, digests) cannot be called.</Notice></div>}
        {d.jobs.length ? (
          <ul className="list-none m-0 p-0 grid gap-2 max-w-measure">
            {d.jobs.map((j, i) => (
              <li key={`${j.job}-${j.at}-${i}`} className="border border-line-500 rounded-md p-3 bg-paper-000 t-body-sm">
                <span className="t-ui">{j.ok ? "✓ Succeeded" : "● Failed"}</span> · {j.job} · {formatDateTime(j.at)}
                {j.summary && <span className="block text-ink-600 mt-1 break-words">{j.summary}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="t-body-sm text-ink-600">No job has run yet.</p>}
      </Section>

      <Section title="Community events (last 30 days)">
        {events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full max-w-measure t-body-sm border-collapse">
              <thead><tr className="text-left border-b border-line-500"><th scope="col" className="py-2 pr-4">Event</th><th scope="col" className="py-2 text-right">Count</th></tr></thead>
              <tbody>{events.map(([name, n]) => <tr key={name} className="border-b border-paper-200"><td className="py-2 pr-4"><code>{name}</code></td><td className="py-2 text-right">{n}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="t-body-sm text-ink-600">No events recorded in the last 30 days.</p>}
        <p className="t-body-sm text-ink-600 mt-4 max-w-measure">These are first-party counts only; moderation previews are not counted. For search clicks, indexed pages and return visits use Google Search Console and the site analytics. This page does not estimate or copy external SEO figures.</p>
      </Section>

      <Section title="Current settings">
        <ul className="t-body-sm max-w-measure">
          <li>Community open to the public: {d.settings.publicAccess ? "yes" : "no"}</li>
          <li>Sign-ups open: {d.settings.signupsOpen ? "yes" : "no"}</li>
          <li>Submissions open: {d.settings.submissionsOpen ? "yes" : "no"}</li>
          <li>Most posts one member can have waiting: {d.settings.maxPendingPerMember}</li>
          <li>Replies from trusted members published without review: {d.settings.autoApproveTrustedReplies ? "yes" : "no"}</li>
        </ul>
        <p className="t-body-sm"><Link href="/admin/globals/community-settings" className="text-marine-600 underline">Change settings in the CMS</Link></p>
      </Section>
    </>
  );
}
