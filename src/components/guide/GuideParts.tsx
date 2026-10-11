import Link from "next/link";

import { Photo } from "@/components/destination/Photo";
import type { Story } from "@/lib/content/stories";

export const fmtLong = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

/** The author's photo, or their initials in a circle until they have one. */
export function AuthorAvatar({ author, size = 40 }: { author: Story["author"]; size?: number }) {
  if (author.photo) {
    return <Photo photo={{ ...author.photo, alt: "" }} sizes={`${size}px`} className="rounded-full shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className="grid place-items-center rounded-full bg-marine-100 text-navy-900 font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(author.name)}
    </span>
  );
}

/** Who wrote the guide and why they are worth reading, with a link to everything they wrote. */
export function AuthorBox({ author }: { author: Story["author"] }) {
  return (
    <section aria-labelledby="author-heading" className="flex gap-4 items-start rounded-lg border border-paper-200 bg-paper-100 p-5">
      <AuthorAvatar author={author} size={56} />
      <div className="min-w-0">
        <p className="t-meta text-ink-400 m-0">About the author</p>
        <h2 id="author-heading" className="t-card-title text-navy-900 m-0 mt-1">{author.name}</h2>
        {author.biography && <p className="t-body-sm text-ink-600 mt-2 mb-0 whitespace-pre-line">{author.biography}</p>}
        <p className="t-body-sm mt-2 mb-0">
          <Link href={`/authors/${author.slug}`} className="inline-flex items-center min-h-11 text-marine-600 underline">More from {author.name}</Link>
        </p>
      </div>
    </section>
  );
}

/**
 * The end of every guide: its sources, when its practical details were last checked, and every
 * correction ever made. A guide with no corrections says so, with a link to report one.
 */
export function SourcesAndCorrections({ story }: { story: Story }) {
  return (
    <section aria-labelledby="sources-heading" className="max-w-measure border-t border-paper-200 pt-8">
      <h2 id="sources-heading" className="t-heading-3 m-0">Sources, checks and corrections</h2>
      {story.reviewedAt && (
        <p className="t-body-sm text-ink-600 mt-3 mb-0">
          Prices, transport and opening details last checked on <time dateTime={story.reviewedAt.slice(0, 10)}>{fmtLong(story.reviewedAt)}</time>. Details change: confirm with the official source before you book.
        </p>
      )}
      {story.sources.length > 0 && (
        <>
          <h3 className="t-meta text-ink-400 mt-5 mb-0">Sources</h3>
          <ol className="m-0 mt-2 pl-5 t-body-sm space-y-1.5">
            {story.sources.map((s) => (
              <li key={s.url + s.name}>
                <a href={s.url} className="text-marine-600 underline break-words" rel="noopener">{s.name}</a>
                {s.note && <span className="text-ink-600">: {s.note}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      <h3 className="t-meta text-ink-400 mt-5 mb-0">Corrections</h3>
      {story.corrections.length ? (
        <ul className="list-none m-0 mt-2 p-0 t-body-sm space-y-2">
          {story.corrections.map((c, i) => (
            <li key={i}>
              <time dateTime={c.date.slice(0, 10)} className="font-semibold text-ink-900">{fmtLong(c.date)}:</time> <span className="whitespace-pre-line">{c.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-body-sm text-ink-600 mt-2 mb-0">No corrections have been made to this guide.</p>
      )}
      <p className="t-body-sm mt-3 mb-0">
        <Link href="/corrections" className="text-marine-600 underline">Report a mistake</Link>
        <span className="text-ink-400" aria-hidden="true"> · </span>
        <Link href="/editorial-policy" className="text-marine-600 underline">How we research and check guides</Link>
      </p>
    </section>
  );
}
