import type { Metadata } from "next";

import { NewsletterForm } from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "Weekly travel newsletter",
  description: "One email a week from Travel Notes: new destination guides, checked travel updates and one practical tip.",
  alternates: { canonical: "/newsletter" },
};

export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-16">
      <p className="t-meta text-ink-400 m-0">Newsletter</p>
      <h1 className="t-heading-1 mt-2 m-0">One useful travel email a week</h1>
      <p className="t-deck mt-3 max-w-measure">New guides, checked travel updates and one practical tip, in a short weekly email. No spam, and you can leave with one click.</p>
      <div className="prose-tn mt-6">
        <ul>
          <li><strong>New guides</strong> written from real trips.</li>
          <li><strong>Travel updates</strong> that matter: entry rules, new routes and closures, each with a link to the official source.</li>
          <li><strong>One practical tip</strong> to save time or money.</li>
        </ul>
      </div>
      <div className="mt-6">
        <NewsletterForm source="/newsletter" />
      </div>
    </div>
  );
}
