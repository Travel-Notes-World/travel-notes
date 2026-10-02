import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Affiliate disclosure" };
export default function Page() {
  return <ComingSoon area="About" title="Affiliate disclosure" summary="Which links earn us a commission, how they are labelled, and how that affects nothing about our recommendations." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
