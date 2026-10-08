import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CardList } from "@/components/community/cards";
import { CommunityClosed, EmptyState, JsonLd, PageHeader, PageShell, Pagination, buttonClass } from "@/components/community/ui";
import { getCommunityTopic } from "@/lib/community/discovery";
import { getViewer } from "@/lib/community/next/session";
import { listPublished } from "@/lib/community/queries";
import { breadcrumbJsonLd } from "@/lib/community/seo";
import { canViewCommunity } from "@/lib/community/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const pageOf = (value: string | string[] | undefined) => Math.max(1, Math.floor(Number(Array.isArray(value) ? value[0] : value) || 1));

/**
 * Community posts tagged with a topic. Tag pages are kept out of search engines for now: there is
 * no review step yet that confirms a topic page has a distinct purpose and enough useful posts
 * (brief §14), and they are not in the sitemap.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return { title: "Community", robots: { index: false, follow: false } };
  const topic = await getCommunityTopic((await params).slug);
  if (!topic) return {};
  const page = pageOf((await searchParams).page);
  const base = `/community/topics/${topic.slug}`;
  return {
    title: page > 1 ? `${topic.name} – community posts, page ${page}` : `${topic.name} – community posts`,
    description: `Questions, trip reports and activities about ${topic.name.toLowerCase()} from the Travel Notes community.`,
    alternates: { canonical: page > 1 ? `${base}?page=${page}` : base },
    robots: { index: false, follow: true },
  };
}

export default async function CommunityTopicPage({ params, searchParams }: Props) {
  const viewer = await getViewer();
  if (!(await canViewCommunity(viewer.staff))) return <CommunityClosed />;
  const topic = await getCommunityTopic((await params).slug);
  if (!topic) notFound();
  const page = pageOf((await searchParams).page);
  const result = await listPublished({ topicId: topic.id, page });
  if (page > 1 && page > result.totalPages) notFound();
  const base = `/community/topics/${topic.slug}`;
  const crumbs = [{ label: "Community", href: "/community" }, { label: "Topics" }, { label: topic.name }];

  return (
    <PageShell>
      <JsonLd data={breadcrumbJsonLd([{ label: "Community", href: "/community" }, { label: topic.name, href: base }])} />
      <Breadcrumbs items={crumbs} />
      <PageHeader
        eyebrow="Community topic"
        title={topic.name}
        intro={<p className="m-0">{topic.introduction || `Posts from members about ${topic.name.toLowerCase()}.`} Community posts are written by members, not by the Travel Notes editorial team.</p>}
        actions={<Link href="/community/questions/new" className={buttonClass}>Ask a question</Link>}
      />
      {result.items.length ? (
        <CardList cards={result.items} label={`Community posts about ${topic.name}`} />
      ) : (
        <EmptyState title="No community posts on this topic yet." action={<Link href="/community/questions/new" className={buttonClass}>Ask the first question</Link>}>
          Posts appear here after a moderator approves them.
        </EmptyState>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} href={(p) => (p > 1 ? `${base}?page=${p}` : base)} />
    </PageShell>
  );
}
