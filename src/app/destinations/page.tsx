import type { Metadata } from "next";
import { destinations } from "@/content/sample";
import { DestinationCard } from "@/components/DestinationCard";

export const metadata: Metadata = { title: "Destinations", description: "Guides by country, region and city." };

export default function DestinationsPage() {
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12">
      <h1 className="t-display-1 m-0">Destinations</h1>
      <p className="t-deck mt-3 max-w-measure">Curated introductions to the places we have written about. Each hub is published only when it has an original introduction and enough supporting guides.</p>
      <div className="mt-10 grid gap-6 md:gap-8 grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => <DestinationCard key={d.slug} d={d} />)}
      </div>
    </div>
  );
}
