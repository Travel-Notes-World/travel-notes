import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Community guidelines", robots: { index: false, follow: true } };
export default function Page() {
  return <ComingSoon area="Community" title="Community guidelines" summary="The rules members agree to, how reporting works, and what moderators do." needs={["Owner-approved guidelines text", "Legal review of terms of use and takedown process for member content"]} />;
}
