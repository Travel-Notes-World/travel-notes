import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "About Travel Notes",
  description: "Who runs Travel Notes, what we publish, how we check it, how the site is funded, and how to reach us.",
  alternates: { canonical: "/about" },
};

const sections: PolicySection[] = [
  {
    id: "what",
    title: "What Travel Notes is",
    body: (
      <>
        <p>Travel Notes is an independent travel publication and traveller community. We publish:</p>
        <ul>
          <li><Link href="/destinations">Destination pages</Link> with when to go and key facts checked against official sources.</li>
          <li><Link href="/guides">Travel guides</Link>: itineraries and practical advice, each showing when it was last checked and its sources.</li>
          <li><Link href="/updates">Travel updates</Link>: short, dated reports of changes to entry rules, fees, closures and routes, each linked to its official source.</li>
          <li>The <Link href="/community">traveller community</Link>, where members ask questions and share trip reports and activities. Moderators check new members’ first posts, every activity and anything our spam checks flag.</li>
        </ul>
      </>
    ),
  },
  {
    id: "who",
    title: "Who runs it",
    body: (
      <p>
        Travel Notes is run by Jeeva Palasundram, from Australia, who writes as <Link href="/authors/jeeva-p">Jeeva P</Link>. Every
        article names its author, and author pages explain their relevant experience.
      </p>
    ),
  },
  {
    id: "how",
    title: "How we work",
    body: (
      <>
        <p>
          We write for travellers, starting with travellers from Australia, and focus on information you can act on. Facts that
          change, such as prices, entry rules and timetables, are checked against official sources and dated. When we get something
          wrong, we fix it and record the correction on the page.
        </p>
        <p>
          Read our <Link href="/editorial-policy">editorial policy</Link> and <Link href="/corrections">corrections policy</Link> for the details.
        </p>
      </>
    ),
  },
  {
    id: "money",
    title: "How the site is funded",
    body: (
      <p>
        Travel Notes is free to read. At the moment it carries no advertising and no affiliate links, and no business has paid for
        coverage. If that changes, every ad, affiliate link and sponsored article will be clearly labelled, and money will never
        decide what we recommend. See our <Link href="/affiliate-disclosure">affiliate and sponsorship disclosure</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: <ContactLine />,
  },
];

export default function AboutPage() {
  return (
    <PolicyPage
      title="About Travel Notes"
      updated="2026-10-11"
      summary={<p>Travel knowledge you can check: dated, sourced guides from our editors, and first-hand experience from a moderated community of travellers.</p>}
      sections={sections}
      related={[
        { href: "/editorial-policy", label: "Editorial policy" },
        { href: "/corrections", label: "Corrections" },
        { href: "/contact", label: "Contact" },
      ]}
    />
  );
}
