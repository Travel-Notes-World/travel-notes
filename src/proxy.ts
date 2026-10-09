import { NextResponse, type NextRequest } from "next/server";

/**
 * Destination and topic addresses are lower case. "/destinations/Japan/Kyoto" is sent (308) to
 * "/destinations/japan/kyoto" here, before any page cache is consulted, so the redirect does not
 * depend on how a cache treats letter case. Old paths are redirected by the page itself.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lower = pathname.toLowerCase();
  if (lower === pathname) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = lower;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/destinations/:path+", "/topics/:path+"],
};
