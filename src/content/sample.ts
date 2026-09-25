/**
 * SAMPLE CONTENT ONLY.
 * These entries exist so the templates can be reviewed before Payload CMS
 * is connected. Nothing here is real editorial content or real travel advice.
 * Replace via the content repository in src/lib/content once the CMS lands.
 */

export type ArticleType = "Destination guide" | "Itinerary" | "Practical advice" | "Gear review" | "Sponsored feature";

export type Stop = { time: string; name: string; note: string };
export type Day = { number: number; title: string; stops: Stop[] };

export type Article = {
  slug: string;
  type: ArticleType;
  title: string;
  deck: string;
  excerpt: string;
  author: { name: string; slug: string };
  readMinutes: number;
  firstPublished: string; // ISO
  updated: string; // ISO
  destination: { name: string; path: string[] }; // e.g. ["japan","kyoto"]
  sponsoredBy?: string;
  takeaways: string[];
  heroAlt: string;
  heroTone: string; // placeholder gradient until real photography exists
  body: { heading: string; paragraphs: string[] }[];
  days?: Day[];
};

export type Destination = { name: string; parent: string; slug: string; guides: number; tone: string; alt: string };

export const destinations: Destination[] = [
  { name: "Kyoto", parent: "Japan", slug: "japan/kyoto", guides: 3, tone: "linear-gradient(135deg,#8fa9a6,#4e6f74 55%,#2e4a50)", alt: "Placeholder for Kyoto photography" },
  { name: "Marrakech", parent: "Morocco", slug: "morocco/marrakech", guides: 2, tone: "linear-gradient(135deg,#d6a56a,#a25d2a 60%,#5d2e0f)", alt: "Placeholder for Marrakech photography" },
  { name: "Tasmania", parent: "Australia", slug: "australia/tasmania", guides: 2, tone: "linear-gradient(135deg,#9fc3d6,#4f7f9a 60%,#244a5e)", alt: "Placeholder for Tasmania photography" },
  { name: "Lisbon", parent: "Portugal", slug: "portugal/lisbon", guides: 1, tone: "linear-gradient(135deg,#e6c9a8,#c27a4b 60%,#7a3f1e)", alt: "Placeholder for Lisbon photography" },
  { name: "Hoi An", parent: "Vietnam", slug: "vietnam/hoi-an", guides: 1, tone: "linear-gradient(135deg,#e9d38a,#b58a2a 60%,#5e4410)", alt: "Placeholder for Hoi An photography" },
  { name: "Queenstown", parent: "New Zealand", slug: "new-zealand/queenstown", guides: 1, tone: "linear-gradient(135deg,#b8c8d8,#5f7e9c 60%,#2b4560)", alt: "Placeholder for Queenstown photography" },
];

const kyotoBody = [
  { heading: "Getting there and around", paragraphs: [
    "Sample paragraph. This text stands in for an editor-written section so the article template can be reviewed at a realistic length. It is not travel advice.",
    "A second sample paragraph keeps the rhythm of a real guide: a sentence of context, a practical detail, and a short sentence to close.",
  ]},
  { heading: "Where to stay", paragraphs: [
    "Sample paragraph about neighbourhoods. Real articles will name specific areas, explain trade-offs, and link to the destination hub.",
  ]},
  { heading: "What it costs", paragraphs: [
    "Sample paragraph. Prices, opening hours and transport details go through the content review queue described in the implementation plan before publication.",
  ]},
];

export const articles: Article[] = [
  {
    slug: "three-slow-days-in-kyoto",
    type: "Itinerary",
    title: "Three slow days in Kyoto without a car",
    deck: "Temples early, tea houses late, and the train timings that make it work.",
    excerpt: "Temples early, tea houses late, and the train timings that make it work.",
    author: { name: "Sample Author", slug: "sample-author" },
    readMinutes: 9,
    firstPublished: "2026-08-20",
    updated: "2026-09-12",
    destination: { name: "Kyoto", path: ["japan", "kyoto"] },
    takeaways: [
      "Sample takeaway one — editors write three to five of these per article.",
      "Sample takeaway two — short, specific, no marketing language.",
      "Sample takeaway three.",
    ],
    heroAlt: "Placeholder image standing in for a Kyoto photograph",
    heroTone: "linear-gradient(135deg,#8fa9a6,#4e6f74 55%,#2e4a50)",
    body: kyotoBody,
    days: [
      { number: 1, title: "Higashiyama on foot", stops: [
        { time: "07:30", name: "Sample stop", note: "Sample note explaining why this time." },
        { time: "10:00", name: "Sample stop", note: "Sample note." },
        { time: "13:00", name: "Sample lunch", note: "Sample note." },
      ]},
      { number: 2, title: "Arashiyama and the bamboo grove", stops: [
        { time: "07:30", name: "Sample stop", note: "Sample note." },
        { time: "11:00", name: "Sample stop", note: "Sample note." },
      ]},
      { number: 3, title: "Fushimi and the north", stops: [
        { time: "08:00", name: "Sample stop", note: "Sample note." },
        { time: "12:30", name: "Sample stop", note: "Sample note." },
      ]},
    ],
  },
  {
    slug: "the-carry-on-we-kept-for-a-year",
    type: "Gear review",
    title: "The carry-on we actually kept for a year",
    deck: "Tested on 14 flights and one very wet bus. Here is what wore out first.",
    excerpt: "Tested on 14 flights and one very wet bus. Here is what wore out first.",
    author: { name: "Sample Author", slug: "sample-author" },
    readMinutes: 6,
    firstPublished: "2026-07-02",
    updated: "2026-09-03",
    destination: { name: "Tasmania", path: ["australia", "tasmania"] },
    takeaways: ["Sample takeaway.", "Sample takeaway.", "Sample takeaway."],
    heroAlt: "Placeholder image standing in for a product photograph",
    heroTone: "linear-gradient(135deg,#c9a97a,#8a5a2b 60%,#4d3016)",
    body: [
      { heading: "How we tested", paragraphs: ["Sample methodology paragraph. Gear reviews always state how the product was used before any verdict."] },
      { heading: "Verdict", paragraphs: ["Sample verdict paragraph."] },
    ],
  },
  {
    slug: "a-weekend-on-the-great-ocean-road",
    type: "Sponsored feature",
    title: "A weekend on the Great Ocean Road",
    deck: "Where we stopped, stayed and ate on a partner-supported trip.",
    excerpt: "Where we stopped, stayed and ate on a partner-supported trip.",
    author: { name: "Sample Author", slug: "sample-author" },
    readMinutes: 5,
    firstPublished: "2026-09-01",
    updated: "2026-09-01",
    destination: { name: "Tasmania", path: ["australia", "tasmania"] },
    sponsoredBy: "Sample Partner",
    takeaways: ["Sample takeaway.", "Sample takeaway."],
    heroAlt: "Placeholder image standing in for a coastal photograph",
    heroTone: "linear-gradient(135deg,#a8b8a0,#5d7a5a 60%,#2f4a34)",
    body: [{ heading: "The drive", paragraphs: ["Sample paragraph. The disclosure banner above the hero is rendered automatically whenever sponsoredBy is set."] }],
  },
];

export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
