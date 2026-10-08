import type { Metadata } from "next";
import Link from "next/link";

import { AccountNav } from "@/components/community/account-nav";
import { ChangePasswordForm, DeleteAccountForm, EmailPrefsForm, ProfileForm } from "@/components/community/account-forms";
import { formatDay, PageHeader, PageShell, secondaryButtonClass } from "@/components/community/ui";
import { getOwnAccount } from "@/lib/community/account-view";
import { requireMemberPage } from "@/lib/community/next/session";
import { unreadCount } from "@/lib/community/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account settings", robots: { index: false, follow: false } };

const sectionClass = "mt-12 border-t border-paper-200 pt-8";

export default async function SettingsPage() {
  const member = await requireMemberPage("/account/settings");
  const [account, unread] = await Promise.all([getOwnAccount(member), unreadCount(member.id)]);
  return (
    <PageShell>
      <PageHeader eyebrow="Your account" title="Settings" />
      <AccountNav current="settings" unread={unread} />

      <nav aria-label="On this page" className="mb-2">
        <ul className="flex flex-wrap gap-x-5 list-none m-0 p-0 t-body-sm">
          <li><a href="#profile" className="text-marine-600">Profile</a></li>
          <li><a href="#email" className="text-marine-600">Email</a></li>
          <li><a href="#password" className="text-marine-600">Password</a></li>
          <li><a href="#data" className="text-marine-600">Your data</a></li>
          <li><a href="#delete" className="text-marine-600">Delete account</a></li>
        </ul>
      </nav>

      <section id="profile" aria-labelledby="profile-heading" className="mt-8">
        <h2 id="profile-heading" className="t-heading-2 m-0">Public profile</h2>
        <p className="t-body-sm text-ink-600 mt-2 max-w-measure">
          Other travellers see these on your posts and on <Link href={`/travellers/${account.handle}`} className="text-marine-600">your profile page</Link>. Your email address is never shown.
        </p>
        <dl className="t-body-sm mt-4 grid gap-1 max-w-measure">
          <div className="flex flex-wrap gap-x-2"><dt className="t-ui">Profile address:</dt><dd className="m-0 break-all">/travellers/{account.handle}</dd></div>
          <div className="flex flex-wrap gap-x-2"><dt className="t-ui">Member since:</dt><dd className="m-0">{formatDay(account.createdAt)}</dd></div>
        </dl>
        <p className="t-body-sm text-ink-600 mt-2 max-w-measure">Your profile address was chosen when you joined and cannot be changed, so links to your posts keep working. It uses lowercase letters, numbers and hyphens.</p>
        <ProfileForm displayName={account.displayName} bio={account.bio} experience={account.experience} />
      </section>

      <section id="email" aria-labelledby="email-heading" className={sectionClass}>
        <h2 id="email-heading" className="t-heading-2 m-0">Email</h2>
        <p className="t-body-sm text-ink-600 mt-2 max-w-measure">We send email to <strong className="text-ink-900 break-all">{account.email}</strong>. To follow a destination, use the Follow button on its page; see <Link href="/account/saved" className="text-marine-600">what you follow</Link>.</p>
        <EmailPrefsForm prefs={account.emailPrefs} />
      </section>

      <section id="password" aria-labelledby="password-heading" className={sectionClass}>
        <h2 id="password-heading" className="t-heading-2 m-0">Change password</h2>
        <ChangePasswordForm />
      </section>

      <section id="data" aria-labelledby="data-heading" className={sectionClass}>
        <h2 id="data-heading" className="t-heading-2 m-0">Download your data</h2>
        <p className="t-body-sm mt-2 max-w-measure">
          A file (JSON format) with your profile, posts, replies, trip plans, bookmarks, follows, responses to activities, reports you sent, notifications and photo details. Moderators’ internal notes about your account and security logs are not included. You can download it a few times a day.
        </p>
        {/* A plain link: the address is a file download, not a page, so client-side navigation must not handle it. */}
        <a href="/account/export" download className={secondaryButtonClass}>Download my data</a>
      </section>

      <section id="delete" aria-labelledby="delete-heading" className={sectionClass}>
        <h2 id="delete-heading" className="t-heading-2 m-0">Delete your account</h2>
        <div className="t-body-sm mt-2 max-w-measure">
          <p className="mt-0">When you delete your account:</p>
          <ul className="pl-5">
            <li>your sign-in details, profile, trip plans, bookmarks, follows, activity responses and notifications are deleted;</li>
            <li>drafts and posts that were never published are deleted;</li>
            <li>you choose below whether your published posts and replies stay (shown as written by “Deleted member”) or are removed too;</li>
            <li>records of moderation decisions and reports are kept without your name or email, so the site stays safe.</li>
          </ul>
          <p>You may want to <a href="#data" className="text-marine-600">download your data</a> first. Deleting cannot be undone.</p>
        </div>
        <details className="mt-4">
          <summary className="t-ui text-signal-error cursor-pointer min-h-11 inline-flex items-center">I want to delete my account</summary>
          <DeleteAccountForm />
        </details>
      </section>
    </PageShell>
  );
}
