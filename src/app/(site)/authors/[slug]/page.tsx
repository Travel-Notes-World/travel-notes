import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getAuthor } from "@/lib/content/authors";
import { getStoriesByAuthor } from "@/lib/content/stories";
import { siteUrl } from "@/lib/site";

/** Fallback regeneration (implementation plan §3: author pages 15 minutes). Saving an author in the CMS expires the cache straight away. */
export const revalidate = 900;

/** No author pages are built ahead of time. Each one is generated on first visit, then cached until it changes. */
export function generateStaticParams() {
  return [];
}

const paragraphs = (text: string) => text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

/** Shorten a biography for the search description without cutting a word in half. */
function summarise(text: string, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 80 ? cut.slice(0, lastSpace) : cut}…`;
}

/** Profile links are checked in the CMS. This is a second check so nothing but an https address is ever rendered. */
const safeLinks = (links: { label: string; url: string }[]) => links.filter((l) => /^https:\/\/\S+$/.test(l.url));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) return {};
  const stories = await getStoriesByAuthor(author.id);
  const description = summarise(author.biography);
  return {
    title: author.name,
    description,
    alternates: { canonical: `/authors/${author.slug}` },
    // A profile with no published work is not useful to searchers yet, so it is kept out of search results.
    ...(stories.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "profile", title: author.name, description, url: `/authors/${author.slug}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) notFound();

  const stories = await getStoriesByAuthor(author.id);
  const links = safeLinks(author.links);
  const url = `${siteUrl}/authors/${author.slug}`;
  const crumbs = [{ label: "Home", href: "/" }, { label: author.name }];

  // Structured data only repeats what is visible on the page.
  const profileLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: {
      "@type": "Person",
      name: author.name,
      description: author.biography,
      url,
      ...(links.length ? { sameAs: links.map((l) => l.url) } : {}),
      worksFor: { "@type": "Organization", name: "Travel Notes" },
    },
  };
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
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8 pt-6 md:pt-10">
      {/* "<" is escaped so text typed by an editor can never close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([profileLd, breadcrumbLd]).replace(/</g, "\\u003c") }} />

      <Breadcrumbs items={crumbs} />

      <header className="mt-6 max-w-measure">
        <p className="t-meta text-ink-400 m-0">Author</p>
        <h1 className="t-heading-1 mt-2 m-0">{author.name}</h1>
        <div className="mt-4 flex flex-col gap-4">
          {paragraphs(author.biography).map((p, i) => <p key={i} className={`m-0 ${i === 0 ? "t-deck" : "t-body"}`}>{p}</p>)}
        </div>
      </header>

      {author.relevantExperience && (
        <section className="mt-10 max-w-measure" aria-labelledby="experience-heading">
          <h2 id="experience-heading" className="t-heading-3 m-0">Experience</h2>
          <div className="mt-3 flex flex-col gap-4">
            {paragraphs(author.relevantExperience).map((p, i) => <p key={i} className="t-body m-0">{p}</p>)}
          </div>
        </section>
      )}

      {links.length > 0 && (
        <section className="mt-10 max-w-measure" aria-labelledby="links-heading">
          <h2 id="links-heading" className="t-heading-3 m-0">Elsewhere</h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 list-none m-0 p-0">
            {links.map((l) => (
              <li key={l.url}>
                <a href={l.url} rel="me noopener noreferrer" className="t-ui text-marine-600">{l.label}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 md:mt-16" aria-labelledby="work-heading">
        <h2 id="work-heading" className="t-heading-2 m-0 mb-6">Published work</h2>
        {stories.length > 0 ? (
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => <ArticleCard key={s.slug} article={s} />)}
          </div>
        ) : (
          <p className="t-body-sm text-ink-600 m-0">{author.name} has no published articles yet.</p>
        )}
      </section>
    </div>
  );
}
