import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/ComingSoon";

const groups: Record<string, string> = { japan: "Japan", australia: "Australia", "solo-travel": "Solo travel", "budget-travel": "Budget travel", "trip-advice": "Trip advice" };

export function generateStaticParams() { return Object.keys(groups).map((group) => ({ group })); }
export async function generateMetadata({ params }: { params: Promise<{ group: string }> }): Promise<Metadata> {
  const { group } = await params;
  return { title: `${groups[group] ?? "Group"} — Community`, robots: { index: false, follow: true } };
}
export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const name = groups[group];
  if (!name) notFound();
  return <ComingSoon area="Community discussion" title={name} summary={`Questions, trip reports and experiences from members travelling to or interested in ${name}.`} needs={["Member accounts and sign-in", "Posting, comments, voting and reporting", "Moderation tools and a named moderator", "Community guidelines and legal review"]} />;
}
