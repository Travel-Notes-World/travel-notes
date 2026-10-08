import type { MetadataRoute } from "next";

import { communitySitemap } from "@/lib/community/sitemap";
import { editorialSitemap } from "@/lib/content/sitemap";
import { siteUrl } from "@/lib/site";

/**
 * sitemap.xml: canonical, indexable, public addresses only.
 *
 * Before launch (NEXT_PUBLIC_INDEXABLE is not "true") the whole site is noindex, so the sitemap is
 * empty rather than listing pages that tell search engines not to index them.
 *
 * Built on request and cached for an hour, so newly approved posts appear without a redeploy.
 * Dates are the last real content change; entries without a known date carry none.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.NEXT_PUBLIC_INDEXABLE !== "true") return [];
  const [editorial, community] = await Promise.all([
    editorialSitemap().catch((error: unknown) => {
      console.error("[sitemap] editorial entries failed.", error instanceof Error ? error.message : error);
      return [];
    }),
    communitySitemap().catch((error: unknown) => {
      console.error("[sitemap] community entries failed.", error instanceof Error ? error.message : error);
      return [];
    }),
  ]);
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [{ url: siteUrl }];
  for (const e of [...editorial, ...community]) {
    if (seen.has(e.path)) continue;
    seen.add(e.path);
    entries.push({ url: `${siteUrl}${e.path}`, ...(e.lastModified ? { lastModified: e.lastModified } : {}) });
  }
  return entries;
}
