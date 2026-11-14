import Link from "next/link";

import { Photo } from "@/components/destination/Photo";
import { getAuthorPhoto } from "@/lib/content/authorPhoto";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

/**
 * The writer's small round photo, looked up by their slug, or their initials until they have one.
 * Decorative: the name always sits next to it, so screen readers skip the image.
 */
export async function AuthorPhoto({ author, size = 28 }: { author: { name: string; slug: string }; size?: number }) {
  const photo = await getAuthorPhoto(author.slug);
  if (photo) {
    return <Photo photo={{ ...photo, alt: "" }} sizes={`${size}px`} className="inline-block rounded-full shrink-0 object-cover align-middle" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className="inline-grid place-items-center rounded-full bg-marine-100 text-navy-900 font-semibold shrink-0 align-middle" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(author.name)}
    </span>
  );
}

/** "By [photo] Name" with the name linking to the author page. Pass `link={false}` inside another link. */
export function AuthorByline({ author, size = 28, prefix = "By", link = true, nameClassName = "text-ink-900 font-medium underline" }: { author: { name: string; slug: string }; size?: number; prefix?: string; link?: boolean; nameClassName?: string }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <AuthorPhoto author={author} size={size} />
      <span>
        {prefix && <>{prefix} </>}
        {link ? <Link href={`/authors/${author.slug}`} className={nameClassName}>{author.name}</Link> : <span className={nameClassName}>{author.name}</span>}
      </span>
    </span>
  );
}
