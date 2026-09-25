import Link from "next/link";
import type { Destination } from "@/content/sample";

export function DestinationCard({ d }: { d: Destination }) {
  return (
    <Link href={`/destinations/${d.slug}`} className="relative block aspect-[4/3] rounded-lg overflow-hidden no-underline group">
      <div role="img" aria-label={d.alt} className="absolute inset-0" style={{ background: d.tone }} />
      <span className="absolute inset-x-0 bottom-0 p-4 bg-scrim text-[#faf7f2]">
        <span className="block t-meta opacity-90">{d.parent}, {d.guides} {d.guides === 1 ? "guide" : "guides"}</span>
        <span className="block t-heading-3 group-hover:underline decoration-ochre-500 underline-offset-4">{d.name}</span>
      </span>
    </Link>
  );
}
