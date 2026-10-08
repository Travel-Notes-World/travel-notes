import Link from "next/link";

import { signOutAction } from "@/lib/community/actions/account";

export type AccountSection = "dashboard" | "trips" | "saved" | "notifications" | "settings";

const ITEMS: { key: AccountSection; label: string; href: string }[] = [
  { key: "dashboard", label: "My posts", href: "/account" },
  { key: "trips", label: "Trip plans", href: "/account/trips" },
  { key: "saved", label: "Saved", href: "/account/saved" },
  { key: "notifications", label: "Notifications", href: "/account/notifications" },
  { key: "settings", label: "Settings", href: "/account/settings" },
];

/**
 * Sub-navigation for the private account pages. The current section is marked with aria-current
 * and an underline, so it is clear without colour. Wraps onto several lines on small phones.
 */
export function AccountNav({ current, unread }: { current?: AccountSection; unread?: number }) {
  return (
    <nav aria-label="Your account" className="mt-2 mb-8 border-b border-paper-200">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <ul className="flex flex-wrap gap-x-1 list-none m-0 p-0">
          {ITEMS.map((item) => {
            const active = item.key === current;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center min-h-11 px-3 t-ui no-underline border-b-2 -mb-px ${active ? "border-ink-900 text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900"}`}
                >
                  {item.label}
                  {item.key === "notifications" && unread ? <span className="ml-1 rounded-sm bg-marine-600 text-on-marine px-1.5 t-meta">{unread}<span className="sr-only"> unread</span></span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={signOutAction}>
          <button type="submit" className="min-h-11 px-3 t-ui text-marine-600 underline underline-offset-4 bg-transparent border-0 cursor-pointer">Sign out</button>
        </form>
      </div>
    </nav>
  );
}
