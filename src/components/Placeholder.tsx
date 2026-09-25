import type { CommonsImage } from "@/content/sample";

/** Wikimedia Commons delivers a resized derivative at any width via Special:FilePath. Sample imagery only. */
export const commonsSrc = (file: string, width: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;

export function Placeholder({ tone, alt, image, className = "", priority = false }:
  { tone: string; alt: string; image?: CommonsImage; className?: string; priority?: boolean }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote sample imagery; next/image + R2 pipeline replaces this in Phase 1
      <img
        src={commonsSrc(image.file, 1200)}
        srcSet={`${commonsSrc(image.file, 480)} 480w, ${commonsSrc(image.file, 768)} 768w, ${commonsSrc(image.file, 1200)} 1200w, ${commonsSrc(image.file, 1800)} 1800w`}
        sizes="(min-width: 1024px) 60vw, 100vw"
        alt={image.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={`${className} object-cover`}
        style={{ background: tone }}
      />
    );
  }
  return <div role="img" aria-label={alt} className={className} style={{ background: tone }} />;
}

export function Credit({ image, caption }: { image?: CommonsImage; caption?: string }) {
  if (!image) return <>{caption}</>;
  return (
    <>
      {caption ? `${caption} ` : ""}Photo: {image.author}, via Wikimedia Commons,{" "}
      <a href={image.licenseUrl} className="text-marine-600" rel="license">{image.license}</a>. Sample imagery until original photography is added.
    </>
  );
}
