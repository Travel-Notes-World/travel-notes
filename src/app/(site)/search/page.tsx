import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: false } };
export default function Page() {
  return <ComingSoon area="Travel guides" title="Search" summary="Search across guides, itineraries and destinations, with destination and type filters." needs={["Content stored in the CMS database", "The published-only search projection (plan §7)"]} />;
}
