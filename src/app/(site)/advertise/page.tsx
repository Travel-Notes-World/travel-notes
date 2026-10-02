import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Advertise with us", description: "Display advertising, sponsored content and partnerships with Travel Notes." };

export default function AdvertisePage() {
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12">
      <p className="t-meta text-ink-400 m-0">Work with us</p>
      <h1 className="t-heading-1 mt-2 m-0">Advertise with us</h1>
      <div className="prose-tn mt-6">
        <p>Travel Notes reaches readers planning real trips: destination guides, itineraries and gear reviews, plus a community of travellers comparing notes. We work with brands in three ways.</p>
        <h2 id="display">Display advertising</h2>
        <p>Fixed, clearly labelled advertising positions in guides and the community: a desktop sidebar, a limited number of spaces between article sections, and dedicated spaces between content blocks on mobile. Ads never sit inside comments, over text or in the way of navigation.</p>
        <h2 id="sponsored">Sponsored content</h2>
        <p>Paid features are labelled &ldquo;Sponsored&rdquo; from the first screen, reviewed by our editors before publication, and never influence the rest of our coverage. See the <Link href="/editorial-policy">editorial policy</Link>.</p>
        <h2 id="newsletter">Newsletter placements</h2>
        <p>Clearly labelled sponsor messages in our reader newsletter.</p>
        <h2 id="contact">Get in touch</h2>
        <p>Audience figures and rates are shared on request. <Link href="/contact">Contact us</Link> with the audience you want to reach and we will reply with options.</p>
      </div>
    </div>
  );
}
