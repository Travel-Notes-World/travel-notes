import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, PolicyPage, type PolicySection } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal information Travel Notes collects, why, where it is stored, who we share it with, and how to see, change or delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "2026-10-11";

/*
 * Every statement here describes what the site actually does in its code and set-up as of the date
 * above. Change this page whenever that changes (for example before adding analytics or ads).
 */
const sections: PolicySection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Travel Notes (travelnotesworld.com) is run by Jeeva Palasundram, an individual based in Australia. In this policy
          &ldquo;we&rdquo; and &ldquo;us&rdquo; mean Travel Notes.
        </p>
        <p>
          We handle personal information in line with the Australian Privacy Principles in the <em>Privacy Act 1988</em> (Cth).
          If you are in another country, you may have extra rights under your local law; contact us and we will help.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect and why",
    body: (
      <>
        <p>We only collect what we need for the feature you use.</p>
        <ul>
          <li>
            <strong>Reading the site:</strong> no account is needed. We do not use analytics, advertising or tracking cookies. Our
            hosting provider keeps short-term technical logs (such as the page requested and the network address) to run and
            protect the service.
          </li>
          <li>
            <strong>Newsletter:</strong> your email address and the date you confirmed. We only add you after you click the
            confirmation link we send. Every newsletter has an unsubscribe link.
          </li>
          <li>
            <strong>Contact form:</strong> your name, email address, topic and message, so we can reply.
          </li>
          <li>
            <strong>Community account:</strong> your email address and password (stored only as a secure hash), your public
            handle and display name, and anything you choose to add to your profile. We also keep your email settings and
            notifications.
          </li>
          <li>
            <strong>What you post:</strong> questions, answers, replies, trip reports, activities, photos, votes, bookmarks, follows,
            replies to activities and private trip plans. Posts are public once a moderator approves them; trip plans are private.
          </li>
          <li>
            <strong>Activity organiser contact:</strong> if you submit an activity, the contact details you give for the organiser
            are seen only by moderators and are never shown publicly.
          </li>
          <li>
            <strong>Photos:</strong> every photo you upload is re-encoded on our server, which removes hidden data such as the GPS
            location where it was taken.
          </li>
          <li>
            <strong>Security and abuse prevention:</strong> to limit spam and repeated sign-in attempts, we store a one-way code
            made from your network address (not the address itself) for a short time. Moderators&apos; decisions and reports are
            recorded in an audit log.
          </li>
        </ul>
        <p>
          You do not have to give us personal information to read Travel Notes. If you do not, you will not be able to use the
          newsletter, contact form or community.
        </p>
      </>
    ),
  },
  {
    id: "public",
    title: "What other people can see",
    body: (
      <>
        <ul>
          <li>Your handle, display name, profile text and approved posts are public, on your profile at /travellers/your-handle.</li>
          <li>Your email address is never shown to other members.</li>
          <li>Approved posts may appear in search engines. Moderators decide which pages search engines may index.</li>
          <li>Pending, rejected and draft posts, private trip plans and bookmarks are never public.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    body: (
      <ul>
        <li>To run the features you use: your account, posts, notifications, the newsletter and replies to your messages.</li>
        <li>To send emails you need, such as confirming your address, resetting your password and notifications you have turned on.</li>
        <li>To moderate the community and keep it safe, including dealing with reports, spam and breaches of the community rules.</li>
        <li>To meet legal obligations and respond to lawful requests.</li>
      </ul>
    ),
  },
  {
    id: "never",
    title: "What we do not do",
    body: (
      <ul>
        <li>We do not sell or rent your personal information.</li>
        <li>We do not send marketing email from your community account. The newsletter is separate and needs your confirmation.</li>
        <li>We do not use your location from your device. You choose places yourself.</li>
        <li>We do not currently run analytics or advertising. If that changes, we will update this page first and ask for your consent where the law requires it.</li>
      </ul>
    ),
  },
  {
    id: "providers",
    title: "Service providers and overseas storage",
    body: (
      <>
        <p>We use these providers to run the site. They process information only to provide their service to us.</p>
        <ul>
          <li><strong>Vercel</strong>: website hosting. Its servers may be in the United States and other countries.</li>
          <li><strong>Neon</strong>: our database, hosted in Sydney, Australia.</li>
          <li><strong>Cloudflare R2</strong>: storage for photos.</li>
          <li><strong>Resend</strong>: sending email and holding the newsletter list. It is based in the United States.</li>
          <li><strong>Zoho Mail</strong>: our mailbox for messages to {"hello@travelnotesworld.com"}, in Zoho&apos;s Australian data centre.</li>
        </ul>
        <p>
          Some of these providers may store or access information outside Australia, including in the United States. We choose
          established providers and use them only for the purposes above.
        </p>
        <p>
          If you open a map on a destination page, it loads from OpenStreetMap only after you click &ldquo;Show map&rdquo;.
          OpenStreetMap then receives your request like any website you visit.
        </p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep information",
    body: (
      <ul>
        <li><strong>Community account:</strong> until you delete it. See &ldquo;Deleting your account&rdquo; below.</li>
        <li><strong>Newsletter:</strong> until you unsubscribe.</li>
        <li><strong>Contact messages:</strong> for as long as we need them to deal with your message and any follow-up.</li>
        <li><strong>Network address codes for spam limits:</strong> only while the limit applies, then removed by a daily clean-up.</li>
        <li><strong>Unused photo uploads:</strong> removed by a daily clean-up.</li>
        <li><strong>Moderation records and reports:</strong> kept, because we need them to handle abuse and legal requests.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Seeing, correcting and deleting your information",
    body: (
      <>
        <ul>
          <li><strong>See and download:</strong> signed-in members can download a copy of their account data from <Link href="/account/settings">Settings</Link>.</li>
          <li><strong>Correct:</strong> you can change your profile and email settings at any time in <Link href="/account/settings">Settings</Link>.</li>
          <li><strong>Unsubscribe:</strong> use the link at the bottom of any newsletter or notification email.</li>
          <li><strong>Anything else:</strong> contact us and we will respond within 30 days.</li>
        </ul>
      </>
    ),
  },
  {
    id: "delete",
    title: "Deleting your account",
    body: (
      <>
        <p>You can delete your community account yourself in <Link href="/account/settings">Settings</Link>. When you do:</p>
        <ul>
          <li>Your email address, password, handle, name and profile are erased, and every signed-in session ends.</li>
          <li>Your private trip plans, bookmarks, follows, votes, notifications, drafts and unpublished posts are deleted.</li>
          <li>
            Your published posts stay, shown as by &ldquo;Deleted member&rdquo;, so conversations still make sense. If you tick
            &ldquo;remove my posts too&rdquo;, they are removed as well.
          </li>
          <li>Moderation records and reports are kept, without your contact details, to handle abuse and legal requests.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Passwords are stored only as secure hashes. The whole site uses encrypted connections (HTTPS). Staff who can see member
        information must sign in with a password and a code from an authenticator app. No system is perfectly secure; if we
        learn of a data breach that is likely to cause you serious harm, we will tell you and the Office of the Australian
        Information Commissioner as the law requires.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Community accounts are for people aged 16 and over. If you think a younger person has created an account, please tell us and we will remove it.</p>,
  },
  {
    id: "contact",
    title: "Questions and complaints",
    body: (
      <>
        <ContactLine />
        <p>
          We will reply within 30 days. If you are not happy with our answer, you can complain to the Office of the Australian
          Information Commissioner at <a href="https://www.oaic.gov.au/">oaic.gov.au</a>.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>When we change how we handle personal information, we update this page and the date at the top. If the change is significant, we will tell members by email before it takes effect.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      updated={UPDATED}
      summary={
        <p>
          We collect only what each feature needs, never sell it, and use no analytics or advertising cookies. You can download or
          delete your community data at any time.
        </p>
      }
      sections={sections}
      related={[
        { href: "/cookie-policy", label: "Cookie policy" },
        { href: "/terms", label: "Terms of use" },
        { href: "/community/guidelines", label: "Community guidelines" },
      ]}
    />
  );
}
