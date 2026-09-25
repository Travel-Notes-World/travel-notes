import Link from "next/link";

/** Visual only for now: the submit action (Resend + abuse protection) lands in Phase 3. */
export function NewsletterForm() {
  return (
    <section aria-labelledby="newsletter-heading" className="bg-paper-100 rounded-lg p-8 max-w-[560px]">
      <h2 id="newsletter-heading" className="t-heading-2 m-0 mb-2">One good trip idea a week</h2>
      <p className="t-body-sm text-ink-600 m-0 mb-4">Guides and itineraries, no daily deals. Unsubscribe any time.</p>
      <label htmlFor="newsletter-email" className="block t-ui mb-2">Email address</label>
      <div className="flex flex-wrap gap-2">
        <input
          id="newsletter-email" type="email" autoComplete="email" placeholder="you@example.com" disabled
          className="flex-1 basis-[220px] min-h-11 px-4 rounded-sm border border-line-500 bg-paper-000 text-ink-900 t-body-sm placeholder:text-ink-400"
        />
        <button type="button" disabled className="min-h-11 px-6 rounded-md bg-marine-600 text-on-marine t-ui opacity-50 cursor-not-allowed">
          Subscribe
        </button>
      </div>
      <p className="t-meta text-ink-400 mt-3 m-0 normal-case tracking-normal">
        Signups open at launch. <Link href="/privacy" className="text-marine-600">Privacy</Link>
      </p>
    </section>
  );
}
