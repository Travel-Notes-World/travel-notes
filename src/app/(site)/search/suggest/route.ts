import { cms } from "@/lib/community/db";
import { clientIp } from "@/lib/community/next/session";
import { hashSubject, hit } from "@/lib/community/ratelimit";
import { cleanQuery, suggest, SUGGEST_MIN } from "@/lib/content/suggest";

/**
 * Suggestions as you type: GET /search/suggest?q=kyo → up to 8 places, guides and travel updates.
 * Published content only. Answers are small and cached briefly at the edge; each address may make
 * a limited number of uncached requests a minute. A failure gives an empty list, never an error page.
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number, cache: string) =>
  Response.json(body, { status, headers: { "Cache-Control": cache, "X-Robots-Tag": "noindex" } });

export async function GET(request: Request) {
  const q = cleanQuery(new URL(request.url).searchParams.get("q"));
  if (q.replace(/[^\p{L}\p{N}]/gu, "").length < SUGGEST_MIN) return json({ query: q, items: [] }, 200, "public, max-age=300, s-maxage=3600");

  const ip = await clientIp();
  if (ip && !(await hit("suggest_ip", hashSubject(ip))).allowed) return json({ query: q, items: [], error: "Too many searches. Please wait a minute." }, 429, "no-store");

  try {
    const items = await suggest(await cms(), q);
    return json({ query: q, items }, 200, "public, max-age=60, s-maxage=300");
  } catch (error) {
    console.error("[search] suggestions failed.", error instanceof Error ? error.message : error);
    return json({ query: q, items: [] }, 200, "no-store");
  }
}
