import type { Metadata } from "next";
import Link from "next/link";

import { ActivityForm } from "@/components/community/activity-form";
import { CommunityClosed, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { destinationsByIds } from "@/lib/community/destinations";
import { formInitial, topicOptions } from "@/lib/community/next/form-initial";
import { getViewer, requireMemberPage } from "@/lib/community/next/session";
import { canViewCommunity, getSettings } from "@/lib/community/settings";

export const metadata: Metadata = { title: "Submit an activity", robots: { index: false, follow: false } };

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { destination } = await searchParams;
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  await requireMemberPage("/activities/new");
  const settings = await getSettings();
  const initial = await formInitial(null);
  // Arriving from a destination page pre-selects it; the member can remove it.
  if (destination) initial.destinations = (await destinationsByIds([destination])).map((d) => ({ id: d.id, label: d.label }));
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Activities" title="Submit an activity" intro="Share a meet-up, a public event or an experience that travellers can join. A moderator checks every listing before it appears." />
      {!settings.submissionsOpen ? (
        <Notice tone="warning" title="Posting is paused">Please try again later.</Notice>
      ) : (
        <>
          <details className="mb-6 max-w-measure">
            <summary className="t-ui text-marine-600 cursor-pointer min-h-11 inline-flex items-center">What can be listed</summary>
            <ul className="t-body-sm mt-2">
              <li>One dated event at a time. For a repeat, submit each date separately.</li>
              <li>Use a public venue or meeting point. Never give a private home address.</li>
              <li>Enter the date and time as they are where the event happens, and choose that place’s time zone.</li>
              <li>If you run or work for the business, or a link earns money, say so in “Commercial interest”.</li>
              <li>A moderator checks that a listing is complete and relevant. That is not a check that the event is safe.</li>
              <li>Travel Notes does not sell tickets or take payments.</li>
            </ul>
          </details>
          <ActivityForm id={null} initial={initial} topics={await topicOptions()} />
        </>
      )}
      <p className="t-body-sm text-ink-600 mt-8">By posting you agree to the <Link href="/community/guidelines" className="text-marine-600 underline">community rules</Link>.</p>
    </PageShell>
  );
}
