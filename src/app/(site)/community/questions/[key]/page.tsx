import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ResolvedToggle } from "@/components/community/post-actions";
import { PostMeta, PostToolbar, RelatedGuides, RepliesSection } from "@/components/community/post-parts";
import { CommunityClosed, CommunityLabel, JsonLd, Notice, PageShell, UserText, styleLabel } from "@/components/community/ui";
import { labelOf, PARTY_TYPES } from "@/lib/community/constants";
import { formatMoney } from "@/lib/community/money";
import { loadPostPage, postMetadata } from "@/lib/community/next/pages";
import { guidesForDestination } from "@/lib/community/queries";
import { breadcrumbJsonLd, questionJsonLd } from "@/lib/community/seo";
import { formatYearMonth } from "@/lib/community/time";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postMetadata("question", (await params).key, "Travel question");
}

export default async function QuestionPage({ params, searchParams }: Props) {
  const { key } = await params;
  const answersPage = Math.max(1, Number((await searchParams).answers) || 1);
  const page = await loadPostPage("question", key, answersPage);
  if ("closed" in page) return <CommunityClosed />;
  const { post, state } = page;
  const q = post.questionDetail!;
  const place = post.destinations[0];
  const crumbs = [{ label: "Community", href: "/community" }, ...(place ? [{ label: place.name, href: `/community/${place.path}` }] : []), { label: "Questions", href: "/community/questions" }, { label: post.title }];
  const context = [
    q.travelMonth && `Travelling ${formatYearMonth(q.travelMonth)}`,
    q.durationDays && `${q.durationDays} days`,
    q.partyType && labelOf(PARTY_TYPES, q.partyType),
    q.budgetMinor !== null && q.budgetCurrency && `Budget about ${formatMoney(q.budgetMinor, q.budgetCurrency)}`,
    post.style && styleLabel(post.style),
  ].filter(Boolean) as string[];
  const guides = place ? await guidesForDestination(place.id) : [];
  return (
    <PageShell>
      <JsonLd data={[questionJsonLd(post, page.replies.items), breadcrumbJsonLd(crumbs)].filter(Boolean)} />
      <Breadcrumbs items={crumbs} />
      <article className="mt-6 max-w-measure">
        <p className="t-meta text-ink-400 m-0 flex flex-wrap gap-x-3">
          <span className="text-ochre-700">Traveller question</span>
          {post.question?.resolved ? <span className="text-signal-success">✓ Resolved</span> : <span>Open</span>}
          {post.destinations.map((d) => <Link key={d.id} href={`/community/${d.path}`} className="text-ink-400 hover:text-marine-600">{d.label}</Link>)}
        </p>
        <h1 className="t-heading-1 mt-2 mb-0">{post.title}</h1>
        <PostMeta page={page} />
        <div className="mt-3"><CommunityLabel /></div>
        {q.duplicateOf && <div className="mt-6"><Notice tone="info" title="Answered elsewhere">An earlier thread covers this question: <Link href={q.duplicateOf.path} className="text-marine-600 underline">{q.duplicateOf.title}</Link>. The discussion here is kept as it was.</Notice></div>}
        {context.length > 0 && <ul className="mt-6 flex flex-wrap gap-2 list-none m-0 p-0" aria-label="Trip details">{context.map((c) => <li key={c} className="t-body-sm bg-paper-100 rounded-sm px-3 py-1">{c}</li>)}</ul>}
        <UserText text={post.body} className="mt-6" />
        <PostToolbar page={page} />
        {state?.isAuthor && !q.acceptedAnswerId && <div className="mt-3"><ResolvedToggle contributionId={post.id} resolved={Boolean(post.question?.resolved)} returnTo={page.returnTo} /></div>}
      </article>
      <RepliesSection page={page} answersPage={answersPage} kind="answer" />
      <RelatedGuides guides={guides} />
    </PageShell>
  );
}
