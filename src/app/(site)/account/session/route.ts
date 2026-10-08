import { NextResponse } from 'next/server'

import { getViewer } from '@/lib/community/next/session'
import { unreadCount } from '@/lib/community/notifications'

/**
 * Tells the site header who is signed in, after the page has loaded. Keeping this out of the
 * shared layout lets guide pages stay static and cached; this answer itself is never cached.
 * It returns only what the header shows: a display name and an unread count.
 */
export async function GET() {
  const { member, staff } = await getViewer()
  const body = member
    ? { signedIn: true as const, kind: 'member' as const, displayName: member.displayName, unread: await unreadCount(member.id) }
    : staff
      ? { signedIn: true as const, kind: 'staff' as const, displayName: staff.name, moderator: staff.canModerate }
      : { signedIn: false as const }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
}
