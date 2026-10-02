import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Author" };
export default function Page() {
  return <ComingSoon area="Travel guides" title="Author profile" summary="Public biography, relevant experience, disclosures and published work for each writer." needs={["Real author profiles in the CMS (separate from staff logins)", "Verified external profile links"]} />;
}
