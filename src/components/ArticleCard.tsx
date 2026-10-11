import Link from "next/link";
import type { Photo as PhotoData } from "@/lib/content/photos";

import { Photo } from "./destination/Photo";
import { Placeholder } from "./Placeholder";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** The fields a card needs; a CMS story (src/lib/content/stories.ts) satisfies this shape. */
export type CardArticle = {
  slug: string; type: string; title: string; excerpt: string; readMinutes: number; updated: string;
  author: { name: string }; heroTone: string; accent: string; photo?: PhotoData | null;
};

export function ArticleCard({ article, hero = false }: { article: CardArticle; hero?: boolean }) {
  const href = `/stories/${article.slug}`;
  return (
    <article className={hero ? "grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-end" : "flex flex-col gap-3"}>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="block">
        {article.photo ? (
          // The link is hidden from screen readers (the title link follows), so the photo needs no description here.
          <Photo photo={{ ...article.photo, alt: "" }} priority={hero} sizes={hero ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"} className={`block aspect-[3/2] w-full ${hero ? "rounded-lg" : "rounded-md"}`} />
        ) : (
          <Placeholder tone={article.heroTone} alt="" priority={hero} className={`aspect-[3/2] w-full ${hero ? "rounded-lg" : "rounded-md"}`} />
        )}
        <span aria-hidden="true" className="block h-1 rounded-full mt-2" style={{ background: article.accent, width: hero ? 96 : 56 }} />
      </Link>
      <div className="flex flex-col gap-3">
        <p className="t-meta text-ink-400 m-0">
          <span className="text-ochre-700">{article.type}</span>
          <span className="ml-3">{article.readMinutes} min read</span>
        </p>
        <h3 className={`m-0 ${hero ? "t-display-1" : "t-card-title"}`}>
          <Link href={href} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">
            {article.title}
          </Link>
        </h3>
        <p className={`m-0 text-ink-600 ${hero ? "t-deck" : "t-body-sm"}`}>{article.excerpt}</p>
        <p className="t-meta text-ink-400 m-0">
          By {article.author.name}<span className="ml-3">Updated {fmt(article.updated)}</span>
        </p>
      </div>
    </article>
  );
}
