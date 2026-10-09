import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before two kinds of page only (see `config.matcher`):
 *
 * - /destinations/…: addresses are lower case. "/destinations/Japan/Kyoto" is sent (308) to
 *   "/destinations/japan/kyoto" here, before any page cache is consulted, so the redirect does not
 *   depend on how a cache treats letter case. Old paths are redirected by the page itself.
 * - /admin…: passes the CMS page address to the server, which the staff two-step login
 *   (payload-totp) needs to send people to the "set up" or "enter your code" page without a
 *   redirect loop.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/destinations/")) {
    const lower = pathname.toLowerCase();
    if (lower === pathname) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = lower;
    return NextResponse.redirect(url, 308);
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/destinations/:path+", "/admin", "/admin/:path*"],
};
