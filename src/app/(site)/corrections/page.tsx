import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Corrections",
  description: "How to report a mistake on Travel Notes, and how we fix errors and record corrections on the page.",
  alternates: { canonical: "/corrections" },
};

const sections: PolicySection[] = [
  {
    id: "report",
    title: "Report a mistake",
    body: (
      <>
        <p>
          Use our <Link href="/contact">contact form</Link> and choose <strong>Correction to an article</strong>. Tell us the page, what is
          wrong and, if you can, a source that shows the right information. For a community post, use the
          <strong> Report</strong> button on the post instead, so a moderator sees it straight away.
        </p>
      </>
    ),
  },
  {
    id: "what-we-do",
    title: "What happens next",
    body: (
      <ol>
        <li>An editor checks your report against the source.</li>
        <li>If the page is wrong, we fix it.</li>
        <li>For anything more than a typo, we add a dated note to the <strong>Corrections</strong> list at the end of the page, saying what was wrong and what it now says.</li>
        <li>If the correction changes the advice, we also update the page&apos;s &ldquo;Updated&rdquo; date.</li>
        <li>We reply to tell you what we did.</li>
      </ol>
    ),
  },
  {
    id: "never",
    title: "What we never do",
    body: <p>We do not quietly change a fact that readers may have relied on. Correction notes are never deleted.</p>,
  },
  {
    id: "updates",
    title: "Travel updates",
    body: <p>Travel updates are reports of a change on a given date. If the situation changes again, we add an &ldquo;Update&rdquo; note to the same page rather than rewriting history.</p>,
  },
];

export default function CorrectionsPage() {
  return (
    <PolicyPage
      title="Corrections"
      updated="2026-10-11"
      summary={<p>Found something wrong? Tell us. We check it, fix it, and record the correction on the page so readers can see what changed.</p>}
      sections={sections}
      related={[
        { href: "/editorial-policy", label: "Editorial policy" },
        { href: "/contact", label: "Contact" },
      ]}
    />
  );
}
