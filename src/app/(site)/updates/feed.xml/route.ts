import { FEED_SIZE, getUpdates, type UpdateView } from "@/lib/content/updates";
import { renderUpdatesFeed } from "@/lib/content/updatesFeed";

/**
 * RSS 2.0 feed of the newest travel updates: /updates/feed.xml. Feed readers, news aggregators and
 * the newsletter can follow it.
 */
export const revalidate = 3600;

export async function GET() {
  let items: UpdateView[] = [];
  try {
    items = (await getUpdates({ page: 1, pageSize: FEED_SIZE })).items;
  } catch (error) {
    // An outage gives an empty (still valid) feed for a moment rather than an error page.
    console.error("[updates] feed could not be built.", error instanceof Error ? error.message : error);
  }
  return new Response(renderUpdatesFeed(items), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
