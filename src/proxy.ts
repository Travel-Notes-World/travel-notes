import { NextResponse, type NextRequest } from "next/server";

import { findRedirect } from "@/lib/redirects/loader";

/**
 * Runs before every page (see `config.matcher`; Next.js files, the API and static files are skipped):
 *
 * - Redirect rules from the CMS (Redirects collection): an old address is sent on with 308 or 307,
 *   keeping the visitor's query string, or answered with 410 when the content was removed for good.
 *   Rules are kept in memory for a minute. If they cannot be loaded the request passes through
 *   unchanged: the proxy never errors or blocks the site.
 * - /destinations/… and /topics/…: addresses are lower case. "/destinations/Japan/Kyoto" is sent
 *   (308) to "/destinations/japan/kyoto" here, before any page cache is consulted, so the redirect does not
 *   depend on how a cache treats letter case. Old paths are redirected by the page itself.
 * - /admin…: passes the CMS page address to the server, which the staff two-step login
 *   (payload-totp) needs to send people to the "set up" or "enter your code" page without a
 *   redirect loop.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-pathname", pathname);
    return response;
  }

  const rule = await findRedirect(pathname, search);
  if (rule?.status === 410) return NextResponse.rewrite(new URL("/gone", request.url), { status: 410 });
  if (rule) return NextResponse.redirect(new URL(rule.location, request.url), rule.status);

  if (pathname.startsWith("/destinations/") || pathname.startsWith("/topics/")) {
    const lower = pathname.toLowerCase();
    if (lower === pathname) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = lower;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Every page address except Next.js files, the API and files with an extension (robots.txt, images…).
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
