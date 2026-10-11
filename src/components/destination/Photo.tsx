import type { Photo as PhotoData } from "@/lib/content/destinations";

/**
 * An editorial photo at the size the screen needs, picked by the browser from the sizes stored at
 * upload (480, 960, 1600 px and the original). A plain <img> on purpose: the files are already
 * resized and converted to WebP once, so they skip the image optimiser and its monthly quota.
 */
export function Photo({ photo, sizes, priority = false, className = "" }: { photo: PhotoData; sizes: string; priority?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP files with srcset; see the comment above.
    <img
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={`object-cover bg-paper-200 ${className}`}
      style={{ objectPosition: `${photo.focus.x}% ${photo.focus.y}%` }}
    />
  );
}

/** "CC BY-SA 4.0" from a Creative Commons licence address, or a plain name. */
export function licenceName(photo: Pick<PhotoData, "licence" | "licenceUrl">): string {
  if (photo.licence === "own") return "";
  if (photo.licence === "permission") return "used with permission";
  if (photo.licence === "cc0") return "public domain";
  const m = photo.licenceUrl?.match(/creativecommons\.org\/licenses\/([a-z-]+)\/(\d+(?:\.\d+)?)/i);
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
  return photo.licence === "cc-by-sa" ? "CC BY-SA" : "CC BY";
}

/** The credit line under a photo: caption, who took it, where it came from and its licence. */
export function PhotoCredit({ photo, className = "" }: { photo: PhotoData; className?: string }) {
  const licence = licenceName(photo);
  const host = photo.sourceUrl ? sourceHost(photo.sourceUrl) : "";
  return (
    <p className={`t-body-sm text-ink-600 m-0 ${className}`}>
      {photo.caption && <>{photo.caption}. </>}
      Photo: {photo.credit}
      {host && (
        <>
          , via{" "}
          <a href={photo.sourceUrl!} className="text-marine-600 underline" rel="noopener">{host}</a>
        </>
      )}
      {licence && (
        <>
          {" "}(
          {photo.licenceUrl && photo.licence !== "permission" ? (
            <a href={photo.licenceUrl} className="text-marine-600 underline" rel="license noopener">{licence}</a>
          ) : (
            licence
          )}
          )
        </>
      )}
      .
    </p>
  );
}

const KNOWN_HOSTS: Record<string, string> = { "commons.wikimedia.org": "Wikimedia Commons", "flickr.com": "Flickr", "unsplash.com": "Unsplash" };

function sourceHost(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return KNOWN_HOSTS[host] ?? host;
  } catch {
    return "";
  }
}
