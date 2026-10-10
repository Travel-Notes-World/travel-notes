import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SummaryBox } from "@/components/SummaryBox";
import { DisclosureBanner } from "@/components/DisclosureBanner";
import { ItineraryDay } from "@/components/ItineraryDay";
import { AdSlot } from "@/components/AdSlot";
import { ArticleCard } from "@/components/ArticleCard";
import { Placeholder, Credit } from "@/components/Placeholder";
import { RichBody } from "@/components/RichBody";
import { getLatestStories, getStory } from "@/lib/content/stories";
import { siteUrl } from "@/lib/site";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });
const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

/** Fallback regeneration (implementation plan §3: articles 60 minutes). Publishing expires the cache straight away. */
export const revalidate = 3600;

/** Stories are generated on first visit, then cached until they change. */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getStory(slug);
  if (!a) return {};
  const title = a.seo?.title ?? a.title;
  const description = a.seo?.description ?? a.deck;
  return {
    // `absolute` stops the layout from adding "| Travel Notes" to a search title an editor wrote in full.
    title: a.seo ? { absolute: title } : title,
    description,
    alternates: { canonical: `/stories/${a.slug}` },
    // The whole site stays noindex until launch (see layout). This adds a per-article opt-out on top.
    ...(a.seo?.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "article", title, description, url: `/stories/${a.slug}`, publishedTime: a.firstPublished, modifiedTime: a.updated },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getStory(slug);
  if (!a) notFound();

  const sections = a.body.headings;
  const related = (await getLatestStories(4)).filter((x) => x.slug !== a.slug).slice(0, 3);
  const inlineAd = a.showAds ? <AdSlot placement="article-inline-1" /> : null;

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
  // Breadcrumbs only include levels that exist. An article filed under a destination sits below it;
  // an article with no destination (practical advice, gear) sits directly below the homepage.
  const crumbs = a.destination
    ? [
        { label: "Destinations", href: "/destinations" },
        { label: a.destination.name, href: `/destinations/${a.destination.path}` },
        { label: a.title },
      ]
    : [{ label: "Home", href: "/" }, { label: a.title }];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...("href" in c && c.href ? { item: `${siteUrl}${c.href}` } : {}),
    })),
  };

  return (
    <article className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10">
      {/* "<" is escaped so text typed by an editor can never close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]).replace(/</g, "\\u003c") }} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div>
          <Breadcrumbs items={crumbs} />

          <header className="mt-6 max-w-measure">
            <p className="t-meta text-ink-400 m-0"><span className="text-ochre-700">{a.type}</span><span className="ml-3">{a.readMinutes} min read</span></p>
            <h1 className="t-heading-1 mt-2 mb-3">{a.title}</h1>
            <p className="t-deck m-0">{a.deck}</p>
            <div className="mt-5 flex items-center gap-3">
              <div aria-hidden="true" className="w-10 h-10 rounded-full bg-paper-200" />
              <p className="t-body-sm m-0">
                <Link href={`/authors/${a.author.slug}`} className="text-ink-900 font-medium no-underline hover:underline">{a.author.name}</Link>
                <span className="block text-ink-400">Published {fmt(a.firstPublished)}{!sameDay(a.updated, a.firstPublished) && `, updated ${fmt(a.updated)}`}</span>
              </p>
            </div>
          </header>

          {a.disclosure === "sponsored" && a.sponsoredBy && <div className="mt-6"><DisclosureBanner sponsor={a.sponsoredBy} /></div>}
          {a.disclosure === "affiliate" && <div className="mt-6"><DisclosureBanner kind="affiliate" /></div>}

          {/* CMS articles have no hero image until media uploads (Cloudflare R2) are set up, so no empty frame is shown. */}
          {a.image && (
            <figure className="mt-8 m-0 rounded-lg" style={{ boxShadow: `0 0 0 3px ${a.accent}` }}>
              <Placeholder tone={a.heroTone} alt={a.heroAlt} image={a.image} priority className="aspect-[4/5] md:aspect-[3/2] w-full rounded-lg" />
              <figcaption className="t-body-sm text-ink-600 mt-2"><Credit image={a.image} /></figcaption>
            </figure>
          )}

          {(a.takeaways.length > 0 || sections.length > 0) && (
            <div className="mt-8"><SummaryBox takeaways={a.takeaways} sections={sections} /></div>
          )}

          <div className="prose-tn mt-8">
            <RichBody data={a.body.data} afterFirstSection={inlineAd} />
          </div>

          {a.days && (
            <div className="mt-12 space-y-8">
              <h2 className="t-heading-2 m-0">The itinerary</h2>
              {a.days.map((d) => <ItineraryDay key={d.number} day={d} />)}
            </div>
          )}

          <section className="mt-12 max-w-measure border-t border-paper-200 pt-6" aria-labelledby="corrections-heading">
            <h2 id="corrections-heading" className="t-meta text-ink-400 m-0">Corrections and references</h2>
            <p className="t-body-sm text-ink-600 mt-2 m-0">No corrections have been made to this article. <Link href="/corrections" className="text-marine-600 underline">How we handle corrections</Link></p>
          </section>
        </div>

        {a.showAds && (
          <aside className="hidden lg:block" aria-label="Sidebar">
            <div className="sticky top-24"><AdSlot placement="sidebar-1" /></div>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="t-heading-2 m-0 mb-6">Related stories</h2>
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => <ArticleCard key={r.slug} article={r} />)}
          </div>
        </section>
      )}
    </article>
  );
}
