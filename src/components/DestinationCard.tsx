import Link from "next/link";
import type { Destination } from "@/content/sample";
import { Placeholder } from "./Placeholder";

/** Photo on top, the destination's signature colour as a solid band underneath carrying the name. */
export function DestinationCard({ d }: { d: Destination }) {
  return (
    <Link href={`/destinations/${d.slug}`} className="block rounded-lg overflow-hidden no-underline group" style={{ boxShadow: `0 0 0 2px ${d.accent}` }}>
      <div className="relative aspect-[4/3]">
        <Placeholder tone={d.tone} alt={d.alt} image={d.image} className="absolute inset-0 w-full h-full" />
      </div>
      <span className="block p-4 text-[#faf7f2]" style={{ background: d.accent }}>
        <span className="block t-meta opacity-85">{d.parent}, {d.guides} {d.guides === 1 ? "guide" : "guides"}</span>
        <span className="block t-heading-3 group-hover:underline decoration-ochre-500 underline-offset-4">{d.name}</span>
      </span>
    </Link>
  );
}
