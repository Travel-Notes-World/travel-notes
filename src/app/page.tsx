import Link from "next/link";
import { articles, destinations } from "@/content/sample";
import { ArticleCard } from "@/components/ArticleCard";
import { DestinationCard } from "@/components/DestinationCard";
import { NewsletterForm } from "@/components/NewsletterForm";

const topics = [
  ["/topics/itineraries", "Itineraries"], ["/topics/tips", "Practical tips"],
  ["/topics/budget", "Budget travel"], ["/topics/gear", "Gear"],
];

export default function HomePage() {
  const [lead, ...rest] = articles;
  return (
    <div className="mx-auto max-w-container px-4 md:px-6 lg:px-8">
      <section className="pt-8 md:pt-12" aria-label="Lead story">
        <ArticleCard article={lead} hero />
      </section>

      <section className="mt-12 md:mt-16" aria-labelledby="destinations-heading">
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <h2 id="destinations-heading" className="t-heading-2 m-0">Where to next</h2>
          <Link href="/destinations" className="t-ui text-marine-600">All destinations</Link>
        </div>
        <div className="grid gap-6 md:gap-8 grid-cols-2 lg:grid-cols-3">
          {destinations.map((d) => <DestinationCard key={d.slug} d={d} />)}
        </div>
      </section>

      <section className="mt-12 md:mt-16" aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="t-heading-2 m-0 mb-6">Latest guides</h2>
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => <ArticleCard key={a.slug} article={a} />)}
        </div>
      </section>

      <section className="mt-12 md:mt-16" aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="sr-only">Topics</h2>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 list-none m-0 p-0">
          {topics.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="block bg-paper-100 rounded-md p-4 t-ui text-ink-900 no-underline hover:text-marine-600">{label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 md:mt-16">
        <NewsletterForm />
      </section>
    </div>
  );
}
