import Link from "next/link";

import { activityCategoryLabel } from "@/lib/community/seo";
import type { Card } from "@/lib/community/queries";
import { formatMoney } from "@/lib/community/money";
import { formatEventTime, formatYearMonth } from "@/lib/community/time";
import { AuthorName, formatDay, StatusBadge, styleLabel } from "./ui";

const TYPE_LABEL = { question: "Question", trip: "Trip report", activity: "Activity" } as const;

export function priceText(a: { priceState: string | null; priceMinor: number | null; priceCurrency: string | null }): string {
  if (a.priceState === "free") return "Free";
  if (a.priceState === "paid") return a.priceMinor !== null && a.priceCurrency ? formatMoney(a.priceMinor, a.priceCurrency) : "Paid";
  return "Price not known";
}

/** One community post in a list. The type is written out, so posts are never mistaken for editorial guides. */
export function ContributionCard({ card }: { card: Card }) {
  const meta: string[] = [];
  if (card.type === "question") meta.push(card.replyCount === 1 ? "1 answer" : `${card.replyCount} answers`);
  if (card.type === "trip" && card.trip) {
    if (card.trip.travelMonth) meta.push(formatYearMonth(card.trip.travelMonth));
    if (card.trip.durationDays) meta.push(`${card.trip.durationDays} days`);
  }
  if (card.style) meta.push(styleLabel(card.style));
  return (
    <article className="flex flex-col gap-2 border-t border-paper-200 pt-4">
      <p className="t-meta text-ink-400 m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ochre-700">{card.type === "activity" && card.activity ? activityCategoryLabel(card.activity.category) : TYPE_LABEL[card.type]}</span>
        {card.question?.resolved && <span className="text-signal-success">✓ Resolved</span>}
        {card.type === "question" && card.replyCount === 0 && <span>Unanswered</span>}
        {card.activity && card.activity.status !== "scheduled" && <StatusBadge state={card.activity.status} kind="event" />}
      </p>
      <h3 className="t-card-title m-0">
        <Link href={card.path} className="text-ink-900 no-underline hover:underline decoration-ochre-500 underline-offset-4">{card.title}</Link>
      </h3>
      {card.activity && (
        <p className="t-body-sm text-ink-900 m-0">
          {formatEventTime(card.activity)}
          {card.activity.venueName ? ` · ${card.activity.venueName}` : card.activity.format === "online" ? " · Online" : ""}
          {` · ${priceText(card.activity)}`}
        </p>
      )}
      {card.excerpt && <p className="t-body-sm text-ink-600 m-0">{card.excerpt}</p>}
      <p className="t-meta text-ink-400 m-0 normal-case tracking-normal flex flex-wrap gap-x-3">
        <span>By <AuthorName author={card.author} /></span>
        {card.destinations.length > 0 && <span>{card.destinations.map((d) => d.label).join(" · ")}</span>}
        {card.publishedAt && <span>{formatDay(card.publishedAt)}</span>}
        {meta.map((m) => <span key={m}>{m}</span>)}
      </p>
    </article>
  );
}

export function CardList({ cards, label }: { cards: Card[]; label: string }) {
  return (
    <ul className="list-none m-0 p-0 grid gap-6" aria-label={label}>
      {cards.map((c) => <li key={c.id}><ContributionCard card={c} /></li>)}
    </ul>
  );
}
