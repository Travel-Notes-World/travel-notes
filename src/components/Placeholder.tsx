import Image from "next/image";
import type { CommonsImage } from "@/lib/content/images";

/**
 * A licensed photo, or a colour block until one exists. Photos go through next/image, so they come from this
 * site in AVIF/WebP at the width the screen needs. `priority` loads the photo first (for the main image of a
 * page) without a preload hint: a hint would travel in the page's prefetch data and make every page that links
 * here download the photo too.
 */
export function Placeholder({ tone, alt, image, className = "", priority = false, sizes = "(min-width: 1024px) 60vw, 100vw" }:
  { tone: string; alt: string; image?: CommonsImage; className?: string; priority?: boolean; sizes?: string }) {
  if (image) {
    return (
      <Image
        src={image.src}
        sizes={sizes}
        alt={image.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={`${className} object-cover`}
        style={{ background: tone }}
      />
    );
  }
  // With no description the colour block is decoration, so it is hidden from screen readers rather than announced as an unnamed image.
  if (!alt) return <div aria-hidden="true" className={className} style={{ background: tone }} />;
  return <div role="img" aria-label={alt} className={className} style={{ background: tone }} />;
}

export function Credit({ image, caption }: { image?: CommonsImage; caption?: string }) {
  if (!image) return <>{caption}</>;
  return (
    <>
      {caption ? `${caption} ` : ""}Photo: {image.author}, via Wikimedia Commons,{" "}
      <a href={image.licenseUrl} className="text-marine-600 underline" rel="license">{image.license}</a>.
    </>
  );
}
