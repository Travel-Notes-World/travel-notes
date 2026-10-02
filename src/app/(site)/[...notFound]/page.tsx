import { notFound } from "next/navigation";

/**
 * Catch-all for URLs that match no other route.
 * The app has two root layouts ((site) and (payload)), so there is no single
 * root not-found. This sends unmatched URLs to (site)/not-found.tsx with a 404.
 */
export default function CatchAllNotFound() {
  notFound();
}
