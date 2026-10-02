import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Write for us", description: "Guest contributions to Travel Notes: what we accept and how to pitch." };

export default function WriteForUsPage() {
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12">
      <p className="t-meta text-ink-400 m-0">Work with us</p>
      <h1 className="t-heading-1 mt-2 m-0">Write for us</h1>
      <div className="prose-tn mt-6">
        <p>We accept a small number of guest contributions from people writing about places they have actually been. Every piece is edited and fact-checked before publication.</p>
        <h2 id="what">What we look for</h2>
        <ul>
          <li>Firsthand experience with specific, checkable detail</li>
          <li>Original photography you have the rights to</li>
          <li>Clear disclosure of any free travel, products or payment you received</li>
        </ul>
        <h2 id="paid">Paid placements</h2>
        <p>Articles paid for by a business are published as sponsored features, labelled as such, and follow the same editorial review. Undisclosed paid links are not accepted.</p>
        <h2 id="pitch">How to pitch</h2>
        <p>Submissions open at launch. Until then, <Link href="/contact">contact us</Link> with a short outline and where you have been. Read the <Link href="/editorial-policy">editorial policy</Link> first.</p>
      </div>
    </div>
  );
}
