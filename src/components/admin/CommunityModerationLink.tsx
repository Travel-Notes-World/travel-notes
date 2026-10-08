import Link from "next/link";

import { userCanModerate } from "../../access/community";

/**
 * A link from the CMS dashboard to the community moderation console. Shown only to staff who can
 * moderate; the console itself checks the session again on every page and action.
 */
export default function CommunityModerationLink({ user }: { user?: unknown }) {
  if (!userCanModerate(user)) return null;
  return (
    <div style={{ marginBottom: "var(--base, 20px)", padding: "calc(var(--base, 20px) * 0.75)", border: "1px solid var(--theme-elevation-150)", borderRadius: "var(--style-radius-m, 4px)", background: "var(--theme-elevation-50)" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>Community moderation</p>
      <p style={{ margin: "0.25rem 0 0.5rem" }}>Review submissions, replies, reports and members, and see the community dashboard.</p>
      <Link href="/moderation">Open the moderation console</Link>
    </div>
  );
}
