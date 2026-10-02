import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "About Travel Notes" };
export default function Page() {
  return <ComingSoon area="About" title="About Travel Notes" summary="Who publishes Travel Notes, why, and how to reach us." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
