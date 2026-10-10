import type { Metadata } from "next";
import Link from "next/link";

import { QuestionForm } from "@/components/community/contribution-form";
import { CommunityClosed, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { destinationsByIds } from "@/lib/community/destinations";
import { formInitial, topicOptions } from "@/lib/community/next/form-initial";
import { getViewer, requireMemberPage } from "@/lib/community/next/session";
import { canViewCommunity, getSettings } from "@/lib/community/settings";

export const metadata: Metadata = { title: "Ask a question", robots: { index: false, follow: false } };

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { destination } = await searchParams;
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  await requireMemberPage("/community/questions/new");
  const settings = await getSettings();
  const initial = await formInitial(null);
  // Arriving from a destination page pre-selects it; the member can remove it.
  if (destination) initial.destinations = (await destinationsByIds([destination])).map((d) => ({ id: d.id, label: d.label }));
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community" title="Ask a question" intro="Travellers who have been there answer. Questions and answers are checked by a moderator before they appear." />
      {!settings.submissionsOpen ? (
        <Notice tone="warning" title="Posting is paused">Please try again later.</Notice>
      ) : (
        <>
          <details className="mb-6 max-w-measure">
            <summary className="t-ui text-marine-600 cursor-pointer min-h-11 inline-flex items-center">Tips for a question that gets good answers</summary>
            <ul className="t-body-sm mt-2">
              <li>Ask one thing, and say where and when.</li>
              <li>Say what you already found out, so people do not repeat it.</li>
              <li>Do not include phone numbers, booking references or other private details.</li>
              <li>For questions about visas, health or safety, also check official government advice.</li>
            </ul>
          </details>
          <QuestionForm id={null} initial={initial} topics={await topicOptions()} />
        </>
      )}
      <p className="t-body-sm text-ink-600 mt-8">By posting you agree to the <Link href="/community/guidelines" className="text-marine-600 underline">community rules</Link>.</p>
    </PageShell>
  );
}
