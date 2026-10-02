import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articles } from "@/content/sample";
import { ArticleCard } from "@/components/ArticleCard";

const topics: Record<string, { name: string; intro: string; types: string[] }> = {
  itineraries: { name: "Itineraries", intro: "Day-by-day plans you can follow or adapt.", types: ["Itinerary"] },
  tips: { name: "Practical tips", intro: "Transport, money, timing and the small things that make trips easier.", types: ["Practical advice"] },
  budget: { name: "Budget travel", intro: "Going further for less without losing the good bits.", types: ["Practical advice"] },
  gear: { name: "Gear", intro: "Reviews of what we actually carried, with the wear and tear included.", types: ["Gear review"] },
};

export function generateStaticParams() { return Object.keys(topics).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const t = topics[slug];
  return t ? { title: t.name, description: t.intro } : {};
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const t = topics[slug];
  if (!t) notFound();
  const list = articles.filter((a) => t.types.includes(a.type));
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-8 md:pt-12">
      <p className="t-meta text-ink-400 m-0">Travel guides</p>
      <h1 className="t-heading-1 mt-2 m-0">{t.name}</h1>
      <p className="t-deck mt-3 max-w-measure">{t.intro}</p>
      {list.length ? (
        <div className="mt-10 grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArticleCard key={a.slug} article={a} />)}</div>
      ) : (
        <p className="t-body-sm text-ink-600 mt-8">No guides in this topic yet. Sample content only until the CMS is connected.</p>
      )}
    </div>
  );
}
