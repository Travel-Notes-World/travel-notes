import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { type TopicPage, getTopic, getTopicPage, topicRobots } from "@/lib/content/topics";

/**
 * A topic page from the CMS, for example /topics/budget: the editor's introduction, their featured
 * articles, then every other published guide on the topic. Published topics and guides only.
 * Built on first visit and cached; publishing a topic or a guide expires it.
 */
type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

async function load(slug: string): Promise<TopicPage | null> {
  const topic = await getTopic(decodeURIComponent(slug));
  return topic ? getTopicPage(topic) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).slug);
  if (!page) return {};
  const robots = topicRobots(page);
  return {
    // The editor wrote the search title in full, so the layout does not add "| Travel Notes".
    title: { absolute: page.seo.title },
    description: page.seo.description,
    alternates: { canonical: `/topics/${page.slug}` },
    ...(robots ? { robots } : {}),
    openGraph: { title: page.seo.title, description: page.seo.description, url: `/topics/${page.slug}` },
  };
}

export default async function TopicRoute({ params }: Props) {
  const page = await load((await params).slug);
  if (!page) notFound();
  const { name, introduction, featured, guides } = page;

  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
      <Breadcrumbs items={[{ label: "Travel guides", href: "/guides" }, { label: name }]} />
      <header className="mt-6 max-w-measure">
        <h1 className="t-heading-1 m-0">{name}</h1>
        {introduction.split(/\n\s*\n/).map((p, i) => <p key={i} className="t-deck mt-3 mb-0">{p}</p>)}
      </header>

      {featured.length > 0 && (
        <section className="mt-12" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="t-heading-2 m-0 mb-6">Editors’ picks</h2>
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">{featured.map((g) => <ArticleCard key={g.id} article={g} />)}</div>
        </section>
      )}

      <section className="mt-12" aria-labelledby="guides-heading">
        <h2 id="guides-heading" className="t-heading-2 m-0 mb-6">{featured.length ? `More ${name.toLowerCase()} guides` : `${name} guides`}</h2>
        {guides.length ? (
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">{guides.map((g) => <ArticleCard key={g.id} article={g} />)}</div>
        ) : (
          <p className="t-body-sm text-ink-600 m-0">
            {featured.length ? "No other guides on this topic yet." : "No guides on this topic yet."} <Link href="/guides" className="text-marine-600 underline">Browse all guides</Link>
          </p>
        )}
      </section>
    </div>
  );
}
