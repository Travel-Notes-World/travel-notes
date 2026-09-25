/** Stands in for photography until the media pipeline delivers real images. */
export function Placeholder({ tone, alt, className = "" }: { tone: string; alt: string; className?: string }) {
  return <div role="img" aria-label={alt} className={className} style={{ background: tone }} />;
}
