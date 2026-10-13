import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using Travel Notes: reading the site, community accounts, what you post, travel information and our responsibilities.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "2026-10-12";

const sections: PolicySection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          Travel Notes (travelnotesworld.com) is run by Jeevarasa (Jeeva) Palasundram as trustee for The Palasundram Family
          Trust, ABN 99 253 199 401, based in the Australian Capital Territory (&ldquo;we&rdquo;, &ldquo;us&rdquo;). These terms apply when you use the website, including the newsletter and the traveller community.
        </p>
        <p>
          By using the site you agree to these terms, our <Link href="/privacy">privacy policy</Link> and, if you take part in the
          community, the <Link href="/community/guidelines">community guidelines</Link>. If you do not agree, please do not use the site.
        </p>
      </>
    ),
  },
  {
    id: "travel-info",
    title: "Travel information is general, not advice for your trip",
    body: (
      <>
        <p>
          We research our guides carefully, show when details were last checked, and link to our sources. But prices, timetables,
          opening hours, entry rules and safety conditions change, sometimes without notice.
        </p>
        <ul>
          <li>Our content is general information. It is not legal, medical, financial, immigration or safety advice for your situation.</li>
          <li>Before you book or travel, check important details with the official source, such as the airline, operator, embassy or <a href="https://www.smartraveller.gov.au/">Smartraveller</a>.</li>
          <li>Community posts are written by members, not by our editors. They share personal experience, which may not apply to you.</li>
        </ul>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Community accounts",
    body: (
      <ul>
        <li>You must be 16 or older to create an account.</li>
        <li>Give a real email address and keep your password private. You are responsible for what happens in your account.</li>
        <li>One person, one account. Do not pretend to be someone else or to represent a business you do not.</li>
        <li>Tell us straight away if you think someone else is using your account.</li>
        <li>You can delete your account at any time in <Link href="/account/settings">Settings</Link>.</li>
      </ul>
    ),
  },
  {
    id: "your-content",
    title: "What you post",
    body: (
      <>
        <p>You keep ownership of what you write and the photos you upload. When you post, you:</p>
        <ul>
          <li>
            give us a non-exclusive, worldwide, royalty-free licence to show, store, copy, adapt for display (for example resizing a
            photo) and share your post on Travel Notes and in our emails, for as long as it is on the site;
          </li>
          <li>confirm that it is your own work, or that you have permission to share it, including from people who appear in your photos;</li>
          <li>confirm that it is true to your own experience and does not break the <Link href="/community/guidelines">community guidelines</Link> or the law;</li>
          <li>disclose any business connection to what you write about, such as being paid, employed or given something for free.</li>
        </ul>
        <p>
          You can edit or remove your posts. Published posts that you edit are checked again before the changes appear. If you delete
          your account, your published posts stay as &ldquo;Deleted member&rdquo; unless you choose to remove them too.
        </p>
      </>
    ),
  },
  {
    id: "moderation",
    title: "Moderation",
    body: (
      <>
        <p>
          A moderator checks a new member&apos;s first posts, every activity, and any post our automatic spam checks flag, before it appears. Other posts are published straight away. A post reported by several members is hidden automatically until a moderator checks it. We may approve, ask for changes to, decline, hide or remove posts, decide whether
          search engines can index a page, and limit or close accounts that break these terms or the community guidelines.
        </p>
        <p>
          We are not able to check every fact in members&apos; posts. If something is wrong or harmful, please use the report button
          or <Link href="/contact">contact us</Link>. If you disagree with a decision about your post or account, contact us and a
          person will look at it again.
        </p>
      </>
    ),
  },
  {
    id: "not-allowed",
    title: "What you must not do",
    body: (
      <ul>
        <li>Break the law, or help anyone else to.</li>
        <li>Post spam, advertising without disclosure, fake reviews or misleading information.</li>
        <li>Harass, threaten or share private information about anyone.</li>
        <li>Post sexual or sexually suggestive content, nudity, or offers of adult services.</li>
        <li>Upload anything that infringes someone else&apos;s copyright or other rights.</li>
        <li>Try to get around moderation, rate limits or security, or use automated tools to collect content or create accounts.</li>
      </ul>
    ),
  },
  {
    id: "our-content",
    title: "Our content",
    body: (
      <p>
        Our articles, guides, photos and site design belong to us or the people who licensed them to us. You may read them and share
        links. Please do not copy or republish them without our written permission, except as the law allows. Photos credited to
        others are used under the licence shown with them.
      </p>
    ),
  },
  {
    id: "paid-listings",
    title: "Paid business listings",
    body: (
      <>
        <p>
          A commercial activity (a tour, class or paid experience run by a business) may have a listing fee. Member meet-ups and
          public events are free to list. The price is shown before you pay and includes GST where GST applies.
        </p>
        <ul>
          <li>You pay by card on Stripe&apos;s secure checkout page. We do not see or store your card number.</li>
          <li>One fee covers one listing: our review of it and, if approved, its publication until the activity ends.</li>
          <li>If we do not approve your listing, or you delete it before it is published, we refund the fee in full to the same card.</li>
          <li>If we ask you to change a listing, you can edit it and send it again without paying again.</li>
          <li>
            Once a listing is published, the fee is not refunded if you remove it yourself or we remove it because it breaks these
            terms or the <Link href="/community/guidelines">community guidelines</Link>, except where the Australian Consumer Law
            gives you a right to a refund.
          </li>
          <li>We do not promise any number of views, bookings or a position in search engines.</li>
          <li>A change of price never affects a listing you have already paid for.</li>
          <li>A tax invoice or receipt is available in your account straight after you pay.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ai-plans",
    title: "Trip Planner and AI plans",
    body: (
      <>
        <p>
          The Trip Planner is free to use. Members can also ask the AI helper to fill in the days of a saved plan. The AI uses Travel
          Notes content first; any stop it suggests on its own is labelled &ldquo;AI idea&rdquo; because we have not checked it.
          AI suggestions can be wrong or out of date. Check opening times, prices, bookings and entry rules with the official source
          before you rely on them.
        </p>
        <ul>
          <li>Each member gets a number of free AI plans, shown in your account. After that, an AI plan has a price, shown before you pay, including GST where GST applies.</li>
          <li>One payment covers one plan: AI suggestions for that plan and printing or saving it as a PDF.</li>
          <li>You pay by card on Stripe&apos;s secure checkout page. We do not see or store your card number.</li>
          <li>If the AI cannot finish your plan, nothing is used from your free allowance or your payment, and you can try again.</li>
          <li>Payments are not refunded once the AI has written the plan, except where the Australian Consumer Law gives you a right to a refund.</li>
          <li>AI plans may pause for a while when demand is high. A tax invoice or receipt is available in your account straight after you pay.</li>
        </ul>
      </>
    ),
  },
  {
    id: "links",
    title: "Links and other businesses",
    body: (
      <p>
        We link to other websites, including official sources and, in future, businesses that may pay us a commission. We will always
        label these (see our <Link href="/affiliate-disclosure">affiliate disclosure</Link>). We are not responsible for other
        websites, their content or what they sell. Any booking you make is between you and that business.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    body: (
      <>
        <p>
          Nothing in these terms limits your rights under the Australian Consumer Law or any other law that cannot be excluded.
        </p>
        <p>
          The site is free to use. To the extent the law allows, we provide it &ldquo;as is&rdquo;, we do not promise it will
          always be available or error-free, and we are not liable for loss that comes from relying on travel information on the
          site, from members&apos; posts, or from other websites we link to.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to the site and these terms",
    body: (
      <p>
        We may change or stop features. If we change these terms in a way that matters, we will update this page and the date at the
        top, and tell members by email before the change takes effect.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the law of the Australian Capital Territory, Australia. Courts in the ACT have jurisdiction over any dispute.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <ContactLine />,
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of use"
      updated={UPDATED}
      summary={
        <p>
          Plain-language terms for reading Travel Notes and taking part in the community: check important travel details with
          official sources, post only your own honest experience, and treat other travellers with respect.
        </p>
      }
      sections={sections}
      related={[
        { href: "/privacy", label: "Privacy policy" },
        { href: "/community/guidelines", label: "Community guidelines" },
        { href: "/cookie-policy", label: "Cookie policy" },
      ]}
    />
  );
}
