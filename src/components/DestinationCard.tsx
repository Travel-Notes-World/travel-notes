import Link from "next/link";
import type { Destination } from "@/content/sample";
import { Placeholder } from "./Placeholder";

export function DestinationCard({ d }: { d: Destination }) {
  return (
    <Link href={`/destinations/${d.slug}`} className="relative block aspect-[4/3] rounded-lg overflow-hidden no-underline group">
      <Placeholder tone={d.tone} alt={d.alt} image={d.image} className="absolute inset-0 w-full h-full" />
      <span className="absolute inset-x-0 bottom-0 p-4 bg-scrim text-[#faf7f2]">
        <span className="block t-meta opacity-90">{d.parent}, {d.guides} {d.guides === 1 ? "guide" : "guides"}</span>
        <span className="block t-heading-3 group-hover:underline decoration-ochre-500 underline-offset-4">{d.name}</span>
      </span>
    </Link>
  );
}
