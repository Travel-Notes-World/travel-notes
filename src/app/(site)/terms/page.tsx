import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Terms of use" };
export default function Page() {
  return <ComingSoon area="About" title="Terms of use" summary="The terms for reading the site and, later, taking part in the community." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
