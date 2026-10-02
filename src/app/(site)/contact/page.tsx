import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
export const metadata: Metadata = { title: "Contact" };
export default function Page() {
  return <ComingSoon area="Work with us" title="Contact" summary="Advertising, guest-post pitches, corrections and general enquiries will come through one form here." needs={["Email delivery provider (Resend)", "Spam protection and rate limiting", "A published contact email address"]} />;
}
