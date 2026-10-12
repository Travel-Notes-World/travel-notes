import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingSteps } from "@/components/community/listing-steps";
import { buttonClass, JsonLd, secondaryButtonClass } from "@/components/community/ui";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { currentListingFee, formatAud } from "@/lib/community/listings";
import { getViewer } from "@/lib/community/next/session";
import { siteUrl } from "@/lib/site";


const TITLE = "List your tour, class or activity";
const DESCRIPTION =
  "Tour operators, guides and local businesses can list a dated activity on Travel Notes. Every listing is checked by a person, shown on the places it is in, and marked up for search engines.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/activities/list-your-activity" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/activities/list-your-activity", type: "website" },
};

const QUESTIONS = [
  {
    q: "Who can list an activity?",
    a: "Anyone with a free Travel Notes account. Member meet-ups and public events (a festival, a market) are free to list. A tour, class or paid experience run by a business is a business listing, which has a listing fee.",
  },
  {
    q: "What can I list?",
    a: "One dated activity that travellers can join: a tour, a class, a tasting, a guided walk, a workshop or an online session. Each date is its own listing. It must happen at a public venue or meeting point, or online.",
  },
  {
    q: "When does my listing go live?",
    a: "After a moderator checks it. We check that it is complete, honest and relevant to travellers. If something is missing, we ask you to change it, and you do not pay again.",
  },
  {
    q: "What if my listing is not approved?",
    a: "The listing fee is refunded in full, automatically, to the card you paid with. The same happens if you delete the listing before it is published.",
  },
  {
    q: "Can I change the date or cancel?",
    a: "Yes. You can edit the listing at any time. If the event is postponed or cancelled, mark it in your account and people who said they are interested are told.",
  },
  {
    q: "Do you sell tickets or take bookings?",
    a: "No. People book with you, through the booking link you add. Travel Notes does not take a commission on your bookings.",
  },
  {
    q: "Is my listing shown as an advertisement?",
    a: "Business listings always carry a clear note that a business is involved. You must also say if you are connected to the business or if a link earns money.",
  },
];

export default async function ListYourActivityPage() {
  const [fee, viewer] = await Promise.all([currentListingFee(), getViewer()]);
  const price = formatAud(fee.amountMinor);
  const signedIn = Boolean(viewer.member);
  const crumbs = [{ label: "Home", href: "/" }, { label: "Activities", href: "/activities" }, { label: "List your activity" }];

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: `${siteUrl}/activities/list-your-activity`,
          isPartOf: { "@type": "WebSite", name: "Travel Notes", url: siteUrl },
        }}
      />
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 max-w-measure">
        <p className="t-eyebrow m-0">For tour operators, guides and local businesses</p>
        <h1 className="t-display-1 mt-3 m-0">{TITLE}</h1>
        <p className="t-deck mt-4 mb-0">
          Reach travellers who are planning a trip to your area. Your listing is checked by a person, shown on the pages of the places it is in, and described to search engines as an event.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {signedIn ? (
            <Link href="/activities/new" className={buttonClass}>Start your listing</Link>
          ) : (
            <>
              <Link href="/account/sign-up" className={buttonClass}>Create a free account</Link>
              <Link href="/account/sign-in?next=%2Factivities%2Fnew" className={secondaryButtonClass}>I have an account</Link>
            </>
          )}
        </div>
      </header>

      <section aria-labelledby="price-heading" className="mt-12 max-w-measure rounded-lg border border-paper-200 bg-paper-100 p-5 md:p-6">
        <h2 id="price-heading" className="t-heading-2 m-0">Price</h2>
        {fee.charge ? (
          <>
            <p className="t-heading-3 mt-3 mb-0">
              {fee.label ? <span className="t-meta text-marine-600 block mb-1">{fee.label}</span> : null}
              {price} <span className="t-body-sm font-normal text-ink-600">AUD per listing{fee.gstRegistered ? `, including GST` : ""}</span>
            </p>
            <p className="t-body-sm mt-3 mb-0">One payment per listing, by card on Stripe’s secure page. Refunded in full if we do not approve it. No subscription and no commission on your bookings.</p>
          </>
        ) : (
          <p className="t-body mt-3 mb-0">Business listings are <strong>free</strong> while we open this service. We will update this page before any fee starts, and a fee never applies to a listing you already sent.</p>
        )}
        <p className="t-body-sm text-ink-600 mt-3 mb-0">Member meet-ups and public events are always free to list.</p>
      </section>

      <section aria-labelledby="steps-heading" className="mt-12">
        <h2 id="steps-heading" className="t-heading-2 m-0 mb-4">How it works</h2>
        <ListingSteps />
      </section>

      <section aria-labelledby="get-heading" className="mt-12 max-w-measure">
        <h2 id="get-heading" className="t-heading-2 m-0">What your listing includes</h2>
        <ul className="t-body mt-4 mb-0 pl-5 list-disc grid gap-2">
          <li>A page for your activity with the date and time in the local time zone, the place or online link, the price and your booking link.</li>
          <li>A place on the <Link href="/activities" className="text-marine-600 underline">Activities</Link> list and on the community pages of the destinations you choose.</li>
          <li>Event details in a format search engines read (schema.org Event), including the date, place, price and whether it is cancelled or moved.</li>
          <li>A button for travellers to say they are interested or going, and a notice to them if you postpone or cancel.</li>
          <li>Edits at any time from your account.</li>
        </ul>
      </section>

      <section aria-labelledby="rules-heading" className="mt-12 max-w-measure">
        <h2 id="rules-heading" className="t-heading-2 m-0">Before you start</h2>
        <ul className="t-body mt-4 mb-0 pl-5 list-disc grid gap-2">
          <li>Have the date, start time and time zone ready, plus a public venue or meeting point (never a private home address).</li>
          <li>Have a booking or information link that starts with https://.</li>
          <li>Use your own photos, or photos you have permission to use.</li>
          <li>Follow the <Link href="/community/guidelines" className="text-marine-600 underline">community guidelines</Link> and the <Link href="/terms#paid-listings" className="text-marine-600 underline">terms for paid listings</Link>.</li>
        </ul>
      </section>

      <section aria-labelledby="faq-heading" className="mt-12 max-w-measure">
        <h2 id="faq-heading" className="t-heading-2 m-0">Questions</h2>
        <div className="mt-4 grid gap-3">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="rounded-md border border-paper-200 bg-paper-000 p-4">
              <summary className="t-ui cursor-pointer min-h-11 flex items-center">{item.q}</summary>
              <p className="t-body mt-2 mb-0">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12 max-w-measure border-t border-paper-200 pt-8">
        <h2 className="t-heading-3 m-0">Ready?</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {signedIn ? (
            <Link href="/activities/new" className={buttonClass}>Start your listing</Link>
          ) : (
            <>
              <Link href="/account/sign-up" className={buttonClass}>Create a free account</Link>
              <Link href="/account/sign-in?next=%2Factivities%2Fnew" className={secondaryButtonClass}>I have an account</Link>
            </>
          )}
          <Link href="/contact" className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Questions? Contact us</Link>
        </div>
      </section>
    </div>
  );
}
