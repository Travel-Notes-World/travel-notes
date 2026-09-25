import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles, getArticle } from "@/content/sample";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SummaryBox } from "@/components/SummaryBox";
import { DisclosureBanner } from "@/components/DisclosureBanner";
import { ItineraryDay } from "@/components/ItineraryDay";
import { AdSlot } from "@/components/AdSlot";
import { ArticleCard } from "@/components/ArticleCard";
import { Placeholder } from "@/components/Placeholder";
import { siteUrl } from "@/lib/site";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.deck,
    alternates: { canonical: `/stories/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.deck, publishedTime: a.firstPublished, modifiedTime: a.updated },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();

  const sections = a.body.map((s) => ({ id: slugify(s.heading), title: s.heading }));
  const related = articles.filter((x) => x.slug !== a.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.deck,
    datePublished: a.firstPublished,
    dateModified: a.updated,
    author: { "@type": "Person", name: a.author.name, url: `${siteUrl}/authors/${a.author.slug}` },
    publisher: { "@type": "Organization", name: "Travel Notes" },
    mainEntityOfPage: `${siteUrl}/stories/${a.slug}`,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Destinations", item: `${siteUrl}/destinations` },
      { "@type": "ListItem", position: 2, name: a.destination.name, item: `${siteUrl}/destinations/${a.destination.path.join("/")}` },
      { "@type": "ListItem", position: 3, name: a.title },
    ],
  };

  return (
    <article className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]) }} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div>
          <Breadcrumbs items={[
            { label: "Destinations", href: "/destinations" },
            { label: a.destination.name, href: `/destinations/${a.destination.path.join("/")}` },
            { label: a.title },
          ]} />

          <header className="mt-6 max-w-measure">
            <p className="t-meta text-ink-400 m-0"><span className="text-ochre-700">{a.type}</span><span className="ml-3">{a.readMinutes} min read</span></p>
            <h1 className="t-heading-1 mt-2 mb-3">{a.title}</h1>
            <p className="t-deck m-0">{a.deck}</p>
            <div className="mt-5 flex items-center gap-3">
              <div aria-hidden="true" className="w-10 h-10 rounded-full bg-paper-200" />
              <p className="t-body-sm m-0">
                <Link href={`/authors/${a.author.slug}`} className="text-ink-900 font-medium no-underline hover:underline">{a.author.name}</Link>
                <span className="block text-ink-400">Published {fmt(a.firstPublished)}{a.updated !== a.firstPublished && `, updated ${fmt(a.updated)}`}</span>
              </p>
            </div>
          </header>

          {a.sponsoredBy && <div className="mt-6"><DisclosureBanner sponsor={a.sponsoredBy} /></div>}

          <figure className="mt-8 m-0">
            <Placeholder tone={a.heroTone} alt={a.heroAlt} className="aspect-[4/5] md:aspect-[3/2] w-full rounded-lg" />
            <figcaption className="t-body-sm text-ink-600 mt-2">Placeholder until original photography is added. Caption and credit render here.</figcaption>
          </figure>

          <div className="mt-8"><SummaryBox takeaways={a.takeaways} sections={sections} /></div>

          <div className="prose-tn mt-8">
            {a.body.map((s, i) => (
              <section key={i}>
                <h2 id={slugify(s.heading)}>{s.heading}</h2>
                {s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
                {i === 0 && <AdSlot placement="article-inline-1" />}
              </section>
            ))}
          </div>

          {a.days && (
            <div className="mt-12 space-y-8">
              <h2 className="t-heading-2 m-0">The itinerary</h2>
              {a.days.map((d) => <ItineraryDay key={d.number} day={d} />)}
            </div>
          )}

          <section className="mt-12 max-w-measure border-t border-paper-200 pt-6" aria-labelledby="corrections-heading">
            <h2 id="corrections-heading" className="t-meta text-ink-400 m-0">Corrections and references</h2>
            <p className="t-body-sm text-ink-600 mt-2 m-0">No corrections have been made to this article. <Link href="/corrections" className="text-marine-600">How we handle corrections</Link></p>
          </section>
        </div>

        <aside className="hidden lg:block" aria-label="Sidebar">
          <div className="sticky top-24"><AdSlot placement="sidebar-1" /></div>
        </aside>
      </div>

      <section className="mt-16" aria-labelledby="related-heading">
        <h2 id="related-heading" className="t-heading-2 m-0 mb-6">Related stories</h2>
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => <ArticleCard key={r.slug} article={r} />)}
        </div>
      </section>
    </article>
  );
}
