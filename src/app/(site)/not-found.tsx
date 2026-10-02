import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-measure px-4 pt-16 pb-24">
      <h1 className="t-heading-1 m-0">This page doesn&apos;t exist</h1>
      <p className="t-body text-ink-600 mt-4">The link may be out of date, or the story may have moved.</p>
      <p className="mt-6"><Link href="/" className="t-ui text-marine-600">Back to the homepage</Link></p>
    </div>
  );
}
