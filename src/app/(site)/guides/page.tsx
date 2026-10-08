import type { Metadata } from "next";

import { ArticleCard } from "@/components/ArticleCard";
import { getLatestStories } from "@/lib/content/stories";

export const metadata: Metadata = {
  title: "Travel guides",
  description: "Destination guides, itineraries and practical travel advice from the Travel Notes editors.",
  alternates: { canonical: "/guides" },
};

/** Same cache rule as the homepage: publishing a guide also refreshes this list. */
export const revalidate = 300;

export default async function GuidesPage() {
  const stories = await getLatestStories(60);
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-16">
      <p className="t-eyebrow m-0">From the editors</p>
      <h1 className="t-heading-1 mt-2 m-0">Travel guides</h1>
      <p className="t-deck mt-3 max-w-measure">Destination guides, itineraries and practical advice. Every guide shows when it was published and last updated.</p>
      {stories.length ? (
        <div className="mt-10 grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">{stories.map((s) => <ArticleCard key={s.slug} article={s} />)}</div>
      ) : (
        <p className="t-body-sm text-ink-600 mt-8">No guides are published yet.</p>
      )}
    </div>
  );
}
