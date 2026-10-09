import type { Metadata } from "next";

import { ContactForm } from "@/components/ContactForm";
import { CONTACT_TOPICS } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact Travel Notes",
  description: "Send Travel Notes a question, a correction, an article pitch or an advertising enquiry. We reply by email.",
  alternates: { canonical: "/contact" },
};

/** Other pages can link here with ?topic=correction&page=<article address> to fill in the form. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const topic = typeof params.topic === "string" && params.topic in CONTACT_TOPICS ? params.topic : "";
  const page = typeof params.page === "string" && /^https?:\/\//.test(params.page) && params.page.length <= 500 ? params.page : "";

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12 pb-12">
      <p className="t-meta text-ink-400 m-0">Work with us</p>
      <h1 className="t-heading-1 mt-2 m-0">Contact us</h1>
      <p className="t-deck mt-3 max-w-measure">
        Questions, corrections, article pitches and advertising enquiries all come through this form. A real person reads every message and replies by email.
      </p>
      <div className="prose-tn mt-6">
        <ul>
          <li><strong>Found a mistake?</strong> Choose “Correction to an article” and paste the link. Tell us what is wrong and, if you can, where you found the right information.</li>
          <li><strong>Want to write for us?</strong> Choose “Guest article pitch” and send a short outline and the places you have been.</li>
          <li><strong>A business?</strong> Choose “Advertising or partnership”. Paid content is always labelled.</li>
        </ul>
      </div>
      <div className="mt-4">
        <ContactForm defaultTopic={topic} defaultPageUrl={page} />
      </div>
    </div>
  );
}
