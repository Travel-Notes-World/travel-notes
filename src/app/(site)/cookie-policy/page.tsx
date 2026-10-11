import type { Metadata } from "next";

import { ContactLine, PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "The only cookies Travel Notes uses: sign-in cookies for members and staff. No analytics, advertising or tracking cookies.",
  alternates: { canonical: "/cookie-policy" },
};

const UPDATED = "2026-10-11";

const th = "text-left";
const sections: PolicySection[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <p>
        Travel Notes uses only cookies that are strictly needed to keep you signed in. We do not use analytics, advertising,
        social media or tracking cookies, so there is nothing to accept or decline. If you never sign in, we set no cookies at all.
      </p>
    ),
  },
  {
    id: "list",
    title: "Cookies we use",
    body: (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Cookies we use">
        <table>
          <thead>
            <tr>
              <th className={th} scope="col">Name</th>
              <th className={th} scope="col">What it does</th>
              <th className={th} scope="col">How long it lasts</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>payload-token</code></td>
              <td>Keeps you signed in to your community account, or a staff member signed in to the editing system.</td>
              <td>Up to 14 days for members, 8 hours for staff, or until you sign out</td>
            </tr>
            <tr>
              <td><code>payload-totp</code></td>
              <td>Staff only: records that a staff member has entered their two-step sign-in code.</td>
              <td>Up to 8 hours</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "storage",
    title: "Saved drafts in your browser",
    body: (
      <p>
        When you write a community post, your browser keeps a copy of the unfinished text on your device (in its &ldquo;local
        storage&rdquo;), so you do not lose your work if the page closes. It never leaves your device unless you submit the post,
        private organiser contact details are never kept, and the copy is cleared when you submit or discard the draft.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "Other websites",
    body: (
      <p>
        Maps on destination pages load from OpenStreetMap only when you click &ldquo;Show map&rdquo;. Links to other websites take
        you to sites with their own cookie policies.
      </p>
    ),
  },
  {
    id: "control",
    title: "Your choices",
    body: (
      <p>
        You can block or delete cookies in your browser settings. If you block them, you can still read everything on Travel Notes,
        but you will not be able to sign in.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and questions",
    body: (
      <>
        <p>
          If we ever add cookies that are not strictly needed, such as analytics, we will update this page first and ask for your
          consent before setting them.
        </p>
        <ContactLine />
      </>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <PolicyPage
      title="Cookie policy"
      updated={UPDATED}
      summary={<p>Only sign-in cookies. No analytics, no advertising, no tracking.</p>}
      sections={sections}
      related={[
        { href: "/privacy", label: "Privacy policy" },
        { href: "/terms", label: "Terms of use" },
      ]}
    />
  );
}
