import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Privacy policy" };
export default function Page() {
  return <ComingSoon area="About" title="Privacy policy" summary="What data we collect, why, and your choices — including newsletter and community data." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
