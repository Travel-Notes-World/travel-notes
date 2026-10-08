import type { Metadata } from "next";

import { EmptyState, Notice, PageHeader, Pagination } from "@/components/community/ui";
import { capturedEmails } from "@/lib/community/moderation-extra";
import { requireModeratorPage } from "@/lib/community/next/session";
import { formatDateTime } from "../format";

export const metadata: Metadata = { title: "Test inbox" };

/**
 * Email the site would have sent, kept in the queue instead. Only on a non-production deployment
 * with EMAIL_TRANSPORT=capture: nothing here was delivered to anyone.
 */
export default async function TestInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireModeratorPage();
  const params = await searchParams;
  if (!staff.isAdministrator) {
    return (
      <>
        <PageHeader title="Test inbox" />
        <Notice tone="info" title="Administrators only">
          <p>Captured emails contain working confirmation and password links, so only administrators can open them.</p>
        </Notice>
      </>
    );
  }
  const inbox = await capturedEmails(staff, Number(params.page) || 1);
  if (!inbox.available) {
    return (
      <>
        <PageHeader title="Test inbox" />
        <Notice tone="info" title="The test inbox is not available here">
          <p>It only works on a development or preview deployment with EMAIL_TRANSPORT set to “capture”. It is never available on the production site, where email is really sent or switched off.</p>
        </Notice>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Test inbox" intro="Email captured instead of sent. Nothing on this page reached anyone. Links in these emails work on this deployment." />
      <Notice tone="warning" title="Contains sign-in and reset links">Captured verification and password-reset emails include working links. Do not share this page.</Notice>
      <div className="mt-6">
        {inbox.items.length ? (
          <ol className="list-none m-0 p-0 grid gap-4" aria-label="Captured emails, newest first">
            {inbox.items.map((e) => (
              <li key={e.id} className="border border-line-500 rounded-md p-4 bg-paper-000 min-w-0">
                <p className="t-ui m-0 break-words">{e.subject}</p>
                <p className="t-body-sm text-ink-600 m-0 mt-1 break-words">To {e.to} · {e.template} · {e.status} · queued {formatDateTime(e.createdAt)}</p>
                {e.lastError && <p className="t-body-sm m-0 mt-1">Last error: {e.lastError}</p>}
                <details className="mt-2">
                  <summary className="t-body-sm underline underline-offset-4 cursor-pointer min-h-11 inline-flex items-center">Show the email text</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words t-body-sm bg-paper-100 p-3 rounded-sm">{e.text}</pre>
                </details>
              </li>
            ))}
          </ol>
        ) : <EmptyState title="No email has been captured yet." />}
      </div>
      <Pagination page={inbox.page} totalPages={inbox.totalPages} href={(p) => (p > 1 ? `/moderation/inbox?page=${p}` : "/moderation/inbox")} />
    </>
  );
}
