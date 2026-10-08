import { NextResponse } from 'next/server'

import { isCommunityError } from '@/lib/community/errors'
import { exportAccount } from '@/lib/community/members'
import { getViewer } from '@/lib/community/next/session'

export const dynamic = 'force-dynamic'

const PRIVATE = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' }

/**
 * Download everything the signed-in member created or set, as a JSON file. Only the member's own
 * data: the service reads by the session's member id. Never cached by the browser or any proxy.
 */
export async function GET(request: Request) {
  // Only when opened from this site or typed in: another site linking here could otherwise use up
  // the member's daily export allowance.
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return new NextResponse('Open this link from your account settings.', { status: 403, headers: PRIVATE })
  const { member } = await getViewer()
  if (!member) return NextResponse.redirect(new URL('/account/sign-in?next=%2Faccount%2Fsettings%23data', request.url), { status: 303, headers: PRIVATE })
  try {
    const data = await exportAccount(member)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        ...PRIVATE,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="travel-notes-data-${date}.json"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (isCommunityError(error) && error.code === 'rate_limited') {
      return new NextResponse(error.message, { status: 429, headers: { ...PRIVATE, 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    console.error('[community] export failed', error)
    return new NextResponse('Your data could not be prepared just now. Please try again in a moment.', { status: 500, headers: { ...PRIVATE, 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
