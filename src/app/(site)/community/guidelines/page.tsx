import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Notice, PageHeader, PageShell } from "@/components/community/ui";

/**
 * Community guidelines. DRAFT text for the owner and a legal reviewer; it makes no legal promises.
 * Kept out of search engines until the owner approves the final wording.
 */
export const metadata: Metadata = {
  title: "Community guidelines (draft)",
  description: "How the Travel Notes community works: what you can post, how moderation and reports work, and how pages appear in search engines.",
  alternates: { canonical: "/community/guidelines" },
  robots: { index: false, follow: true },
};

const SECTIONS = [
  { id: "purpose", title: "What the community is for" },
  { id: "allowed", title: "What you can post" },
  { id: "not-allowed", title: "What is not allowed" },
  { id: "first-hand", title: "Share first-hand experience" },
  { id: "promotion", title: "Businesses, promotion and disclosure" },
  { id: "privacy", title: "Respect other people’s privacy" },
  { id: "moderation", title: "How moderation works" },
  { id: "reports", title: "Reporting a problem" },
  { id: "decisions", title: "If you disagree with a decision" },
  { id: "search", title: "How community pages appear in search engines" },
  { id: "your-content", title: "Your posts and your account" },
] as const;

function Section({ id, children }: { id: (typeof SECTIONS)[number]["id"]; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-10 scroll-mt-24">
      <h2 id={`${id}-heading`} className="t-heading-2 m-0">{title}</h2>
      <div className="prose-tn t-body mt-3 [&_ul]:pl-5 [&_li]:mt-1">{children}</div>
    </section>
  );
}

export default function GuidelinesPage() {
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community" title="Community guidelines" intro={<p className="m-0">Simple rules so that the community stays useful, honest and kind.</p>} />

      <Notice tone="warning" title="Draft – awaiting owner and legal review">
        <p>This text is a working draft. It has not yet been approved by the owner of Travel Notes or checked by a lawyer, and it may change. It does not replace the <Link href="/terms" className="text-marine-600">terms of use</Link> or the <Link href="/privacy" className="text-marine-600">privacy policy</Link>.</p>
      </Notice>

      <nav aria-labelledby="contents-heading" className="mt-8">
        <h2 id="contents-heading" className="t-ui m-0">On this page</h2>
        <ol className="t-body-sm mt-2 mb-0 pl-5 grid gap-1">
          {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-marine-600">{s.title}</a></li>)}
        </ol>
      </nav>

      <Section id="purpose">
        <p>The community is a place for travellers to ask questions, share trip reports and list activities, for anywhere in the world. Posts are written by members, not by the Travel Notes editorial team. They sit next to our editorial guides but are always labelled, so you can tell the two apart.</p>
      </Section>

      <Section id="allowed">
        <ul>
          <li><strong>Questions</strong> about a place, a route, costs, timing or practical details.</li>
          <li><strong>Answers</strong> that help the person who asked, based on what you know or have done.</li>
          <li><strong>Trip reports</strong> about trips you took: where you went, what it cost, what worked and what you would change.</li>
          <li><strong>Activities</strong>: meet-ups you organise, public events, or local experiences, with honest dates, prices and organiser details.</li>
          <li><strong>Photos</strong> you took yourself, or have permission to share.</li>
        </ul>
        <p>Write in plain language. Say when and where something happened, because prices, rules and opening times change.</p>
      </Section>

      <Section id="not-allowed">
        <ul>
          <li>Spam, repeated posts, or links that have nothing to do with the discussion.</li>
          <li>Hidden advertising, fake reviews, or posts written to sell something without saying so.</li>
          <li>Harassment, threats, hate, or personal attacks. Disagree with the idea, not the person.</li>
          <li>Other people’s private information (see below).</li>
          <li>Text or photos copied from somewhere else without permission.</li>
          <li>Anything illegal, or advice that would put people in danger.</li>
          <li>Pretending to be someone else, including a business or an official body.</li>
        </ul>
      </Section>

      <Section id="first-hand">
        <p>The most useful posts come from real experience. Tell readers what you saw and did yourself, and say clearly when something is second-hand, an estimate or out of date. In trip reports, costs are marked as either what you actually spent or your estimate.</p>
        <p>Do not invent experiences, prices or reviews. For visas, health, safety and laws, add a pointer to official government advice; member posts are not a substitute for it.</p>
        <p>An accepted answer means the person who asked found it helpful. It does not mean Travel Notes has checked that it is correct.</p>
      </Section>

      <Section id="promotion">
        <p>Businesses and organisers are welcome to take part, but readers must always know when someone has a commercial interest.</p>
        <ul>
          <li>If you work for, own or are paid by a business you mention, say so in the post. Activity listings have a field for this.</li>
          <li>Say when a link is an affiliate link or a listing is sponsored. These links are marked for search engines as well.</li>
          <li>Answer the question that was asked. Do not turn every answer into an advert.</li>
        </ul>
        <p>Undisclosed promotion is removed, and repeated promotion can lead to an account restriction.</p>
      </Section>

      <Section id="privacy">
        <ul>
          <li>Do not post anyone’s phone number, email, home address, booking details, or other personal information.</li>
          <li>Do not name or identify private people in a negative way, for example a guide or a host you had a problem with. Describe the situation instead.</li>
          <li>Ask before posting photos where people can be recognised, especially children.</li>
          <li>Keep your own details safe too. You never need to share your home address to take part.</li>
        </ul>
      </Section>

      <Section id="moderation">
        <p>A moderator checks every new question, trip report, activity, answer and photo before it is shown to the public. While it waits, you can see its status in your account.</p>
        <p>A moderator can:</p>
        <ul>
          <li><strong>approve</strong> a post, so it becomes public;</li>
          <li><strong>ask for changes</strong>, with a reason, so you can edit and send it again;</li>
          <li><strong>decline</strong> a post, with a reason;</li>
          <li><strong>hide</strong> or <strong>remove</strong> a public post that breaks these guidelines;</li>
          <li><strong>link a question</strong> to an earlier thread that already answers it;</li>
          <li><strong>restrict an account</strong> after serious or repeated problems.</li>
        </ul>
        <p>When you edit a published post, the change is checked first; the approved version stays visible until then. Moderation decisions are recorded, with who made them and why.</p>
      </Section>

      <Section id="reports">
        <p>If you see something that breaks these guidelines, use the <strong>Report</strong> link on the post, answer or profile, and choose the reason that fits best: spam, misleading promotion, harassment, private information, copyright, incorrect facts, a problem with an event, or something else. You need to be signed in to report.</p>
        <p>Reports go to the moderators, not to the person you reported. A moderator reviews each one and decides whether to act. Please report rather than reply in the thread.</p>
        <p>If an activity has been cancelled or changed, report it as an event problem so that the listing can be updated.</p>
      </Section>

      <Section id="decisions">
        <p>When a moderator declines, changes or removes your post, you are told the reason in your account notifications. If you think the decision was wrong, contact us through the <Link href="/contact" className="text-marine-600">contact page</Link> with a link to the post and a short explanation. Where we can, someone other than the original moderator will look at it again.</p>
      </Section>

      <Section id="search">
        <p>Approving a post makes it public. Whether search engines may list it is a separate decision:</p>
        <ul>
          <li>A question is shown to search engines once it has at least one approved answer. Until then it is public on Travel Notes but marked “do not index”.</li>
          <li>Trip reports and activities are offered to search engines only after a further quality check.</li>
          <li>Destination pages with no approved posts, search results and filtered lists are not indexed.</li>
          <li>Your traveller profile is indexed only once you have several approved posts or answers.</li>
          <li>Private pages, such as your saved trips, drafts and account settings, are never public and never indexed.</li>
        </ul>
        <p>These rules are set by the site owner and can change. Being indexed is never guaranteed, and we do not control how search engines show pages.</p>
      </Section>

      <Section id="your-content">
        <p>You keep ownership of what you write. By posting, you let Travel Notes show your post on the site, including next to editorial guides and in search results on the site. The final wording of this permission is part of the terms of use, which are still being reviewed.</p>
        <p>You can edit your posts (edits are checked first) and remove them from your account. If you delete your account, your private data is deleted. Your approved public posts stay on the site under the name “Deleted member” unless you choose to remove them as well when you delete the account.</p>
      </Section>

      <p className="t-body-sm text-ink-600 mt-12 mb-0">
        Questions about these guidelines? Use the <Link href="/contact" className="text-marine-600">contact page</Link>. <Link href="/community" className="text-marine-600">Back to the community</Link>
      </p>
    </PageShell>
  );
}
