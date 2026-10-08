import type { Metadata } from "next";
import Link from "next/link";

import { SuggestionForm } from "@/components/community/moderation-ui";
import { EmptyState, PageHeader, UserText } from "@/components/community/ui";
import { listSuggestions } from "@/lib/community/moderation";
import { requireModeratorPage } from "@/lib/community/next/session";
import { formatDateTime } from "../format";

export const metadata: Metadata = { title: "Destination suggestions" };

/**
 * Places members asked to add. Accepting links the suggestion to a published destination record,
 * which an editor creates in the CMS (or which already exists: that is a merge).
 */
export default async function SuggestionsPage() {
  const staff = await requireModeratorPage();
  const items = await listSuggestions(staff);
  return (
    <>
      <PageHeader
        title="Destination suggestions"
        intro={<>Members suggest places that are not in the destination list. Check the place exists and is not already listed under another name. To add a new place, <Link href="/admin/collections/destinations/create" className="text-marine-600">create and publish it in the CMS</Link> first, then accept the suggestion here.</>}
      />
      {items.length ? (
        <ol className="list-none m-0 p-0 grid gap-4" aria-label="Suggestions waiting">
          {items.map((s) => (
            <li key={s.id} className="border border-line-500 rounded-md p-4 bg-paper-000 min-w-0">
              <p className="t-card-title m-0 break-words">{s.name}{s.country ? `, ${s.country}` : ""}</p>
              <p className="t-body-sm text-ink-600 m-0 mt-1">Suggested by {s.memberName} · {formatDateTime(s.createdAt)}</p>
              {s.details && <UserText text={s.details} className="t-body-sm mt-2" />}
              <div className="mt-3"><SuggestionForm id={s.id} /></div>
            </li>
          ))}
        </ol>
      ) : <EmptyState title="No suggestions are waiting." />}
    </>
  );
}
