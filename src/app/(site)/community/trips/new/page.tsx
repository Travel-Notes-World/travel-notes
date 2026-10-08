import type { Metadata } from "next";
import Link from "next/link";

import { TripForm } from "@/components/community/trip-form";
import { CommunityClosed, Notice, PageHeader, PageShell } from "@/components/community/ui";
import { destinationsByIds } from "@/lib/community/destinations";
import { formInitial, topicOptions } from "@/lib/community/next/form-initial";
import { getViewer, requireMemberPage } from "@/lib/community/next/session";
import { canViewCommunity, getSettings } from "@/lib/community/settings";

export const metadata: Metadata = { title: "Share a trip", robots: { index: false, follow: false } };

export default async function NewTripPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { destination } = await searchParams;
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  await requireMemberPage("/community/trips/new");
  const settings = await getSettings();
  const initial = await formInitial(null);
  // Arriving from a destination page pre-selects it; the member can remove it.
  if (destination) initial.destinations = (await destinationsByIds([destination])).map((d) => ({ id: d.id, label: d.label }));
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community" title="Share a trip" intro="Tell other travellers how your trip really went: where you went, what it cost and what you would do differently. A moderator checks every report before it appears." />
      {!settings.submissionsOpen ? (
        <Notice tone="warning" title="Posting is paused">Please try again later.</Notice>
      ) : (
        <>
          <details className="mb-6 max-w-measure">
            <summary className="t-ui text-marine-600 cursor-pointer min-h-11 inline-flex items-center">Tips for a useful trip report</summary>
            <ul className="t-body-sm mt-2">
              <li>Write about a trip you have taken yourself.</li>
              <li>Give real costs in the currency you paid, and say whether they are per person or for everyone.</li>
              <li>Say what you would do differently. Mistakes help others most.</li>
              <li>Do not include booking references, phone numbers or other private details.</li>
              <li>You can save a draft at any time. Photos can be added once the draft is saved.</li>
            </ul>
          </details>
          <TripForm id={null} initial={initial} topics={await topicOptions()} />
        </>
      )}
      <p className="t-body-sm text-ink-600 mt-8">By posting you agree to the <Link href="/community/guidelines" className="text-marine-600">community rules</Link>.</p>
    </PageShell>
  );
}
