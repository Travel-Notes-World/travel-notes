import { NextResponse, type NextRequest } from 'next/server'

/**
 * Passes the CMS page address to the server, which the staff two-step login (payload-totp) needs
 * to send people to the "set up" or "enter your code" page without a redirect loop.
 * Runs only for /admin pages; public pages are not touched.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-pathname', request.nextUrl.pathname)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('x-pathname', request.nextUrl.pathname)
  return response
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
