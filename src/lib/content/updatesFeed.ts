import { siteUrl } from '../site'
import type { UpdateView } from './updates'

/** XML text and attribute escaping: editor text can never break the feed. */
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** RSS 2.0 for the newest travel updates (served at /updates/feed.xml). */
export function renderUpdatesFeed(items: UpdateView[]): string {
  const entries = items
    .map(
      (u) => `<item>
<title>${xml(u.title)}</title>
<link>${xml(`${siteUrl}${u.path}`)}</link>
<guid isPermaLink="true">${xml(`${siteUrl}${u.path}`)}</guid>
<pubDate>${new Date(u.firstPublished).toUTCString()}</pubDate>
<category>${xml(u.categoryLabel)}</category>
<description>${xml(u.summary)}</description>
</item>`,
    )
    .join('\n')
  const built = items.length ? `<lastBuildDate>${new Date(items[0].updated ?? items[0].firstPublished).toUTCString()}</lastBuildDate>\n` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Travel Notes: travel updates</title>
<link>${xml(`${siteUrl}/updates`)}</link>
<atom:link href="${xml(`${siteUrl}/updates/feed.xml`)}" rel="self" type="application/rss+xml"/>
<description>Checked changes that affect travellers, each with its official source.</description>
<language>en-au</language>
${built}${entries}
</channel>
</rss>
`
}
