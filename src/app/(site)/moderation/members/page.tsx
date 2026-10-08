import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, Field, PageHeader, describedBy, inputClass, secondaryButtonClass } from "@/components/community/ui";
import { findMembers } from "@/lib/community/moderation";
import { requireModeratorPage } from "@/lib/community/next/session";
import { memberStatusLabel } from "../format";

export const metadata: Metadata = { title: "Members" };

/** Find a member by handle, display name or email. A plain GET form, so it works without JavaScript. */
export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireModeratorPage();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const members = await findMembers(staff, query);
  return (
    <>
      <PageHeader title="Members" intro="Search by handle, display name or email address. Email addresses are shown to moderators only." />
      <form method="get" action="/moderation/members" role="search" className="max-w-measure mb-8">
        <Field id="member-q" label="Search members" hint="Part of a name, handle or email works.">
          <input {...describedBy("member-q", true)} name="q" type="search" defaultValue={query} maxLength={100} className={inputClass} />
        </Field>
        <div className="mt-3"><button type="submit" className={secondaryButtonClass}>Search</button></div>
      </form>
      <h2 className="t-heading-3 mt-0">{query ? `Results for “${query}”` : "Newest members"}</h2>
      {members.length ? (
        <ul className="list-none m-0 p-0 grid gap-2" aria-label="Members">
          {members.map((m) => (
            <li key={m.id} className="border border-line-500 rounded-md p-3 bg-paper-000 t-body-sm min-w-0 break-words">
              <Link href={`/moderation/members/${m.id}`} className="t-ui text-marine-600">{m.displayName}</Link> @{m.handle} · {m.email} · {memberStatusLabel(m.status)}
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No members found." />}
      {members.length === 50 && <p className="t-body-sm text-ink-600 mt-3">Showing the first 50. Narrow the search to find someone else.</p>}
    </>
  );
}
