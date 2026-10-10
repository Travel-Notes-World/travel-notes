import type { Metadata } from "next";
import Link from "next/link";

import { AccountNav } from "@/components/community/account-nav";
import { SuggestDestinationForm } from "@/components/community/account-forms";
import { PageHeader, PageShell } from "@/components/community/ui";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suggest a destination", robots: { index: false, follow: false } };

export default async function SuggestDestinationPage() {
  const member = await requireMemberPage("/account/suggest-destination");
  const unread = await unreadCount(member.id);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Your account"
        title="Suggest a destination"
        intro="Can’t find a place when you tag a post? Tell us about it. A moderator checks the name and where it is, then adds it so everyone can use it."
      />
      <AccountNav unread={unread} />
      <SuggestDestinationForm />
      <p className="t-body-sm text-ink-600 mt-8 max-w-measure">
        While you wait, you can save your post as a draft and add the place later. Find your drafts on <Link href="/account" className="text-marine-600 underline">your account page</Link>.
      </p>
    </PageShell>
  );
}
