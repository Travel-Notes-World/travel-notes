import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ModerationNav } from "@/components/community/moderation-ui";
import { PageShell } from "@/components/community/ui";
import { requireModeratorPage } from "@/lib/community/next/session";

/** The console is private: never indexed, never followed, no referrer sent to linked sites. */
export const metadata: Metadata = {
  title: { default: "Moderation", template: "%s – Moderation" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function ModerationLayout({ children }: { children: ReactNode }) {
  // Each page checks again: a layout is not re-run on every navigation, so it is not the guard.
  await requireModeratorPage();
  return (
    <PageShell>
      <p className="t-meta text-ink-400 m-0">Moderation console · staff only</p>
      <div className="mt-4"><ModerationNav /></div>
      {children}
    </PageShell>
  );
}
