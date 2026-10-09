import Link from "next/link";
import type { CommonsImage } from "@/content/sample";
import { Placeholder } from "./Placeholder";

/** Cards sit in a 1/2/3-column grid (md:grid-cols-2 lg:grid-cols-3). */
const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** The fields a card needs. Both sample articles and CMS stories satisfy this shape. */
export type CardArticle = {
  slug: string; type: string; title: string; excerpt: string; readMinutes: number; updated: string;
  author: { name: string }; heroTone: string; accent: string; image?: CommonsImage;
};

/** `heading` is the card title's level: h2 when the list sits directly under the page h1, h3 under a section h2. */
export function ArticleCard({ article, hero = false, heading: Heading = "h3" }: { article: CardArticle; hero?: boolean; heading?: "h2" | "h3" }) {
  const href = `/stories/${article.slug}`;
  return (
    <article className={hero ? "grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-end" : "flex flex-col gap-3"}>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="block">
        <Placeholder tone={article.heroTone} alt="" image={article.image} priority={hero} sizes={hero ? undefined : CARD_SIZES} className={`aspect-[3/2] w-full ${hero ? "rounded-lg" : "rounded-md"}`} />
        <span aria-hidden="true" className="block h-1 rounded-full mt-2" style={{ background: article.accent, width: hero ? 96 : 56 }} />
      </Link>
      <div className="flex flex-col gap-3">
        <p className="t-meta text-ink-400 m-0">
          <span className="text-ochre-700">{article.type}</span>
          <span className="ml-3">{article.readMinutes} min read</span>
        </p>
        <Heading className={`m-0 ${hero ? "t-display-1" : "t-card-title"}`}>
          <Link href={href} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">
            {article.title}
          </Link>
        </Heading>
        <p className={`m-0 text-ink-600 ${hero ? "t-deck" : "t-body-sm"}`}>{article.excerpt}</p>
        <p className="t-meta text-ink-400 m-0">
          By {article.author.name}<span className="ml-3">Updated {fmt(article.updated)}</span>
        </p>
      </div>
    </article>
  );
}
