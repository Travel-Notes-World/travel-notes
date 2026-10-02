import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Corrections" };
export default function Page() {
  return <ComingSoon area="About" title="Corrections" summary="How to report an error and how corrections are recorded on articles." needs={["Owner-approved policy text", "Legal review before launch (plan §8, §10)"]} />;
}
