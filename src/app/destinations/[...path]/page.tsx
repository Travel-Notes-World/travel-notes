import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articles, destinations } from "@/content/sample";
import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Placeholder, Credit } from "@/components/Placeholder";

const find = (path: string[]) => destinations.find((d) => d.slug === path.join("/"));

export function generateStaticParams() { return destinations.map((d) => ({ path: d.slug.split("/") })); }
export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params; const d = find(path);
  return d ? { title: `${d.name} travel guides`, description: `Guides, itineraries and tips for ${d.name}, ${d.parent}.`, alternates: { canonical: `/destinations/${d.slug}` } } : {};
}
export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params; const d = find(path);
  if (!d) notFound();
  const guides = articles.filter((a) => a.destination.path.join("/") === d.slug);
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10">
      <Breadcrumbs items={[{ label: "Destinations", href: "/destinations" }, { label: d.parent }, { label: d.name }]} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-end">
        <div>
          <p className="t-meta text-ink-400 m-0">{d.parent}</p>
          <h1 className="t-display-1 mt-2 m-0">{d.name}</h1>
          <p className="t-deck mt-3 max-w-measure">Sample introduction. A real hub is published only when it has an original editor-written introduction, best-time-to-visit guidance and enough supporting guides (plan §4).</p>
        </div>
        <figure className="m-0"><Placeholder tone={d.tone} alt={d.alt} image={d.image} priority className="aspect-[3/2] w-full rounded-lg" /><figcaption className="t-body-sm text-ink-600 mt-2"><Credit image={d.image} /></figcaption></figure>
      </div>
      <section className="mt-12" aria-labelledby="guides-heading">
        <h2 id="guides-heading" className="t-heading-2 m-0 mb-6">Guides and itineraries</h2>
        {guides.length ? (
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">{guides.map((a) => <ArticleCard key={a.slug} article={a} />)}</div>
        ) : (
          <p className="t-body-sm text-ink-600">No published guides for {d.name} yet. Sample content only until the CMS is connected.</p>
        )}
      </section>
    </div>
  );
}
