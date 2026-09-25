import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Travel Community",
  description: "Ask questions, share trip reports and compare notes with other travellers.",
  robots: { index: false, follow: true }, // stays noindex until the community launches with real discussions
};

/** Placeholder groups agreed in the owner brief. Real groups come from the CMS in the community phase. */
const groups = [
  { slug: "japan", name: "Japan", kind: "Destination", blurb: "Rail passes, seasons, etiquette and where to stay." },
  { slug: "australia", name: "Australia", kind: "Destination", blurb: "Road trips, national parks and city breaks." },
  { slug: "solo-travel", name: "Solo travel", kind: "Topic", blurb: "Safety, hostels, meeting people and going at your own pace." },
  { slug: "budget-travel", name: "Budget travel", kind: "Topic", blurb: "Stretching a trip further without losing the good bits." },
  { slug: "trip-advice", name: "Trip advice", kind: "Topic", blurb: "Post your plan, get honest feedback from people who have been." },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12">
      <p className="t-meta text-ink-400 m-0">Community discussion</p>
      <h1 className="t-display-1 mt-2 m-0">Travel Community</h1>
      <p className="t-deck mt-3 max-w-measure">
        Questions, trip reports and experiences from members. Community posts are written by travellers, not by the Travel Notes editorial team, and are separate from our published guides.
      </p>

      <div role="note" className="mt-6 max-w-measure bg-marine-100 rounded-md p-4 t-body-sm">
        The community opens after the guides and newsletter launch. Groups below show the planned structure.
      </div>

      <h2 className="t-heading-2 mt-12 mb-6">Groups</h2>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
        {groups.map((g) => (
          <li key={g.slug} className="border border-paper-200 rounded-md p-4 bg-paper-000">
            <p className="t-meta text-ochre-700 m-0">{g.kind}</p>
            <h3 className="t-card-title mt-1 mb-1"><Link href={`/community/${g.slug}`} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">{g.name}</Link></h3>
            <p className="t-body-sm text-ink-600 m-0">{g.blurb}</p>
          </li>
        ))}
      </ul>

      <p className="t-body-sm text-ink-600 mt-8 max-w-measure">
        Every member post is subject to the <Link href="/community/guidelines" className="text-marine-600">community guidelines</Link> and can be reported to moderators.
      </p>
    </div>
  );
}
