import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Editorial policy" };
export default function Page() {
  return <ComingSoon area="About" title="Editorial policy" summary="How we choose, write, check and correct what we publish, and how sponsorship is handled." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
