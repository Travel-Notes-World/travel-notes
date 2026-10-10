import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, Field, PageHeader, Pagination, describedBy, inputClass, secondaryButtonClass } from "@/components/community/ui";
import { MODERATION_ACTIONS } from "@/lib/community/constants";
import { auditLogFiltered } from "@/lib/community/moderation-extra";
import { requireModeratorPage } from "@/lib/community/next/session";
import { actionLabel, formatDateTime } from "../format";

export const metadata: Metadata = { title: "Audit log" };

const TARGETS = ["contribution", "reply", "revision", "member", "media", "report", "suggestion"] as const;
const ACTORS = [
  { value: "staff", label: "Staff" },
  { value: "member", label: "Member" },
  { value: "system", label: "System" },
] as const;

/** Where an audit entry's target can be looked at in the console. */
function targetHref(item: { targetType: string; targetId: string; contributionId: string | null }): string | null {
  if (item.targetType === "member") return `/moderation/members/${item.targetId}`;
  if (item.contributionId) return `/moderation/posts/${item.contributionId}`;
  return null;
}

/** Every moderation decision with who, what, why and when. Newest first. */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireModeratorPage();
  const params = await searchParams;
  const action = (MODERATION_ACTIONS as readonly string[]).includes(params.action ?? "") ? params.action! : "";
  const target = (TARGETS as readonly string[]).includes(params.target ?? "") ? params.target! : "";
  const actor = ACTORS.some((a) => a.value === params.actor) ? params.actor! : "";
  const post = /^[0-9a-f-]{36}$/i.test(params.post ?? "") ? params.post! : "";
  const log = await auditLogFiltered(staff, { page: Number(params.page) || 1, action, targetType: target, actorType: actor, contribution: post });
  const href = (p: number) => {
    const q = new URLSearchParams({ ...(action ? { action } : {}), ...(target ? { target } : {}), ...(actor ? { actor } : {}), ...(post ? { post } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return q ? `/moderation/log?${q}` : "/moderation/log";
  };
  return (
    <>
      <PageHeader title="Audit log" intro={`${log.totalDocs} ${log.totalDocs === 1 ? "entry" : "entries"}${action || target || actor || post ? " match the filter" : ""}. Entries are written in the same transaction as the change, and cannot be edited.`} />
      <form method="get" action="/moderation/log" className="mb-8 grid gap-x-4 sm:grid-cols-3 max-w-[900px]">
        {post && <input type="hidden" name="post" value={post} />}
        <Field id="log-action" label="Action">
          <select {...describedBy("log-action")} name="action" defaultValue={action} className={inputClass}>
            <option value="">Any action</option>
            {MODERATION_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
        </Field>
        <Field id="log-target" label="About">
          <select {...describedBy("log-target")} name="target" defaultValue={target} className={inputClass}>
            <option value="">Anything</option>
            {TARGETS.map((t) => <option key={t} value={t}>{actionLabel(t)}</option>)}
          </select>
        </Field>
        <Field id="log-actor" label="Done by">
          <select {...describedBy("log-actor")} name="actor" defaultValue={actor} className={inputClass}>
            <option value="">Anyone</option>
            {ACTORS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
        <div className="mt-4 flex flex-wrap items-center gap-3 sm:col-span-3">
          <button type="submit" className={secondaryButtonClass}>Filter</button>
          {(action || target || actor || post) && <Link href="/moderation/log" className="t-ui text-marine-600 underline min-h-11 inline-flex items-center">Clear filters</Link>}
          {post && <span className="t-body-sm text-ink-600">Showing one post only.</span>}
        </div>
      </form>
      {log.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full t-body-sm border-collapse min-w-[640px]">
            <caption className="sr-only">Audit log entries, newest first</caption>
            <thead>
              <tr className="text-left border-b border-line-500">
                <th scope="col" className="py-2 pr-3">When (UTC)</th>
                <th scope="col" className="py-2 pr-3">Action</th>
                <th scope="col" className="py-2 pr-3">By</th>
                <th scope="col" className="py-2 pr-3">About</th>
                <th scope="col" className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {log.items.map((item) => {
                const link = targetHref(item);
                return (
                  <tr key={item.id} className="border-b border-paper-200 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(item.at)}</td>
                    <td className="py-2 pr-3">{actionLabel(item.action)}</td>
                    <td className="py-2 pr-3">{item.actor}</td>
                    <td className="py-2 pr-3">{link ? <Link href={link} className="text-marine-600 underline">{item.targetType}</Link> : item.targetType}</td>
                    <td className="py-2 break-words">{item.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No entries." />}
      <Pagination page={log.page} totalPages={log.totalPages} href={href} />
    </>
  );
}
