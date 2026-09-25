import Link from "next/link";

export function DisclosureBanner({ sponsor }: { sponsor: string }) {
  return (
    <div role="note" className="flex gap-3 items-start bg-ochre-100 rounded-md p-4 max-w-measure t-body-sm text-ink-900">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0 text-ochre-700" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" />
      </svg>
      <p className="m-0">
        <strong className="text-ochre-700 font-semibold">Sponsored feature.</strong> This trip was supported by {sponsor}. They did not review the article before publication.{" "}
        <Link href="/affiliate-disclosure" className="text-ochre-700">How we handle sponsorship</Link>
      </p>
    </div>
  );
}
