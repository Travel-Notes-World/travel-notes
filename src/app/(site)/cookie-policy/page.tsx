import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Cookie policy" };
export default function Page() {
  return <ComingSoon area="About" title="Cookie policy" summary="Which cookies and consent settings the site uses, and how to change them." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
