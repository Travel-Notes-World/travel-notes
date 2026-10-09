import type { Metadata } from "next";
import Link from "next/link";

/**
 * Shown with status 410 for an address marked "gone" in the Redirects collection: the proxy rewrites
 * the request here. Opened directly it is just an explanation, kept out of search engines.
 */
export const metadata: Metadata = { title: "Page removed", robots: { index: false, follow: false } };

export default function GonePage() {
  return (
    <div className="mx-auto max-w-measure px-4 pt-16 pb-24">
      <h1 className="t-heading-1 m-0">This page has been removed</h1>
      <p className="t-body text-ink-600 mt-4">The content that was here has been taken down for good and is not coming back.</p>
      <p className="mt-6"><Link href="/guides" className="t-ui text-marine-600 underline">Browse our travel guides</Link> or go <Link href="/" className="t-ui text-marine-600 underline">back to the homepage</Link>.</p>
    </div>
  );
}
