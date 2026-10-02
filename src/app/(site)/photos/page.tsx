import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Photos" };
export default function Page() {
  return <ComingSoon area="Travel guides" title="Photos" summary="Curated photo essays and galleries from our own trips." needs={["Original photography with rights and alt text", "The media pipeline (private originals, approved derivatives)"]} />;
}
