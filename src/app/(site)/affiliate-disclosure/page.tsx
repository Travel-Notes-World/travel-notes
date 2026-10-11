import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Affiliate and sponsorship disclosure",
  description: "How Travel Notes labels affiliate links, sponsored articles and ads, and why they never decide what we recommend.",
  alternates: { canonical: "/affiliate-disclosure" },
};

const sections: PolicySection[] = [
  {
    id: "now",
    title: "Right now",
    body: <p>Travel Notes currently has no affiliate links, no advertising and no sponsored articles. No business has paid for coverage. This page explains how we will label them if that changes.</p>,
  },
  {
    id: "affiliate",
    title: "Affiliate links",
    body: (
      <p>
        An affiliate link earns us a small commission if you book or buy through it, at no extra cost to you. Any article with
        affiliate links shows an <strong>Affiliate links</strong> notice at the top, and those links are marked for search engines
        as sponsored.
      </p>
    ),
  },
  {
    id: "sponsored",
    title: "Sponsored articles",
    body: <p>An article paid for or supported by a business shows a <strong>Sponsored feature</strong> notice that names the sponsor. Sponsors do not review or approve the article before it is published.</p>,
  },
  {
    id: "ads",
    title: "Advertising",
    body: <p>Any ads will sit in clearly labelled &ldquo;Advertisement&rdquo; spaces, never inside article text, comments or navigation.</p>,
  },
  {
    id: "community",
    title: "Community posts",
    body: <p>Members who write about a business they are connected to must say so when they post. Those posts are labelled and their links are marked as sponsored. See the <Link href="/community/guidelines#promotion">community guidelines</Link>.</p>,
  },
  {
    id: "independence",
    title: "Money never decides what we recommend",
    body: <p>We choose what to recommend first, and only then look for a way to earn from it. A business cannot pay to be included in, or to change, an editorial guide. See our <Link href="/editorial-policy">editorial policy</Link>.</p>,
  },
  {
    id: "contact",
    title: "Questions",
    body: <ContactLine />,
  },
];

export default function AffiliateDisclosurePage() {
  return (
    <PolicyPage
      title="Affiliate and sponsorship disclosure"
      updated="2026-10-11"
      summary={<p>How we label affiliate links, sponsored articles and ads, so you always know when money is involved.</p>}
      sections={sections}
      related={[
        { href: "/editorial-policy", label: "Editorial policy" },
        { href: "/advertise", label: "Advertise with us" },
      ]}
    />
  );
}
