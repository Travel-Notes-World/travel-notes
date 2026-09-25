import Link from "next/link";
import type { Article } from "@/content/sample";
import { Placeholder } from "./Placeholder";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

export function ArticleCard({ article, hero = false }: { article: Article; hero?: boolean }) {
  const href = `/stories/${article.slug}`;
  return (
    <article className={hero ? "grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-end" : "flex flex-col gap-3"}>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="block">
        <Placeholder tone={article.heroTone} alt="" className={`aspect-[3/2] w-full ${hero ? "rounded-lg" : "rounded-md"}`} />
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
