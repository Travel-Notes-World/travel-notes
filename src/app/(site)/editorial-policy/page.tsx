import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Editorial policy",
  description: "How Travel Notes researches, writes, checks, dates and corrects its travel guides and updates, and how we keep editorial and commercial content apart.",
  alternates: { canonical: "/editorial-policy" },
};

const sections: PolicySection[] = [
  {
    id: "purpose",
    title: "What we aim for",
    body: <p>Every page should help a traveller make a better decision: clear writing, reliable information and honest experience. We would rather publish less than publish something we cannot stand behind.</p>,
  },
  {
    id: "sources",
    title: "Research and sources",
    body: (
      <>
        <p>We check facts that matter against the source best placed to know them:</p>
        <ul>
          <li>Entry rules and travel advice: government sites such as Smartraveller, immigration authorities and embassies.</li>
          <li>Transport: the airline, rail or ferry operator.</li>
          <li>Opening hours, prices and bookings: the attraction, park authority or operator itself.</li>
          <li>Background: official tourism bodies and reliable local reporting.</li>
        </ul>
        <p>Sources are listed on each guide and each travel update links to its official source. Traveller stories help us understand experiences, but one person&apos;s trip is never treated as a fact for everyone.</p>
      </>
    ),
  },
  {
    id: "dates",
    title: "Dates you can trust",
    body: (
      <ul>
        <li><strong>Published</strong>: when the page first appeared.</li>
        <li><strong>Updated</strong>: only after a real change to the content, not a typo fix.</li>
        <li><strong>Details checked</strong>: when prices, transport and opening details were last checked against their sources.</li>
      </ul>
    ),
  },
  {
    id: "experience",
    title: "Honest about experience",
    body: (
      <p>
        We only write &ldquo;we visited&rdquo;, &ldquo;we stayed&rdquo; or &ldquo;we tried&rdquo; when the author really did. Research
        is presented as research, and suggested itineraries are not described as tested unless they were. We never invent trips,
        quotes, reviews or statistics.
      </p>
    ),
  },
  {
    id: "tools",
    title: "How we use AI tools",
    body: (
      <p>
        We use AI tools to help with research, first drafts and checking. A human editor checks every fact against its source,
        edits the text and approves it before anything is published, and the named author is responsible for the result.
      </p>
    ),
  },
  {
    id: "independence",
    title: "Independence",
    body: (
      <ul>
        <li>No business can pay to be included in, or to change, an editorial guide.</li>
        <li>Sponsored articles, affiliate links and ads are always labelled. See our <Link href="/affiliate-disclosure">affiliate and sponsorship disclosure</Link>.</li>
        <li>Community posts are written by members and labelled as such; they are moderated but are not editorial content.</li>
      </ul>
    ),
  },
  {
    id: "photos",
    title: "Photos",
    body: <p>Every photo is credited with who took it and its licence. We do not present stock or AI-generated images as proof that we visited a place, or as a picture of current conditions.</p>,
  },
  {
    id: "corrections",
    title: "Corrections",
    body: <p>When we get something wrong, we fix it and add a dated note to the page saying what changed. See our <Link href="/corrections">corrections policy</Link>.</p>,
  },
  {
    id: "contact",
    title: "Questions",
    body: <ContactLine />,
  },
];

export default function EditorialPolicyPage() {
  return (
    <PolicyPage
      title="Editorial policy"
      updated="2026-10-11"
      summary={<p>How we research, write, check, date and correct what we publish, and how we keep it independent.</p>}
      sections={sections}
      related={[
        { href: "/corrections", label: "Corrections" },
        { href: "/affiliate-disclosure", label: "Affiliate and sponsorship disclosure" },
        { href: "/about", label: "About Travel Notes" },
      ]}
    />
  );
}
