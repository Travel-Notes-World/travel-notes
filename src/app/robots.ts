import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * robots.txt. Until launch (NEXT_PUBLIC_INDEXABLE is not "true") every crawler is asked to stay out,
 * matching the site-wide noindex in the (site) layout.
 *
 * After launch, private and utility areas are disallowed. Private pages are also protected by
 * sign-in; this file is not access control. Public low-value pages (thin hubs, filtered lists)
 * are NOT listed here: they carry a noindex tag, and crawlers must be allowed in to read it.
 * Search results are not blocked here: the page itself carries "noindex", and a crawler can only
 * obey that if it is allowed to fetch the page.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_INDEXABLE !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/moderation", "/admin", "/api", "/cron"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
