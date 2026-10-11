"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Session = { signedIn: false } | { signedIn: true; kind: "member"; displayName: string; unread: number } | { signedIn: true; kind: "staff"; displayName: string; moderator?: boolean };

/**
 * The account link in the header. It is filled in after the page loads, so pages stay cacheable.
 * Without JavaScript it is a plain link to the account area, which asks for sign-in if needed.
 */
export function HeaderAccount() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/account/session", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((s: Session) => { if (!cancelled) setSession(s); })
      .catch(() => { if (!cancelled) setSession({ signedIn: false }); });
    return () => { cancelled = true; };
  }, []);
  const base = "inline-flex items-center min-h-11 t-ui text-ink-600 hover:text-ink-900 no-underline whitespace-nowrap";
  if (session?.signedIn && session.kind === "staff") {
    return session.moderator ? <Link href="/moderation" className={base}>Moderation</Link> : <Link href="/admin" className={base}>Admin</Link>;
  }
  if (session?.signedIn && session.kind === "member") {
    return (
      <Link href="/account" className={base} aria-label={session.unread ? `My account, ${session.unread} unread notifications` : "My account"}>
        My account{session.unread > 0 && <span aria-hidden="true" className="ml-1 inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-ochre-500 text-ink-900 text-[12px]">{session.unread}</span>}
      </Link>
    );
  }
  return <Link href="/account" className={base}>Sign in</Link>;
}
